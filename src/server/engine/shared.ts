/**
 * Server-authoritative 1v1 match engine.
 *
 * Advances both snakes on a fixed tick and resolves all collisions
 * per the Phase 2 spec resolution order.
 */

import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_1_SPAWN,
  PLAYER_1_INITIAL_DIRECTION,
  PLAYER_2_SPAWN,
  PLAYER_2_INITIAL_DIRECTION,
} from "../config";
import type { Position } from "../../game/types";
import type { Direction } from "../../game/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWallCollision(
  pos: Position,
  width: number,
  height: number,
): boolean {
  return pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height;
}

function randomFreePosition(
  bodies: Position[][],
  width: number,
  height: number,
): Position {
  const occupied = new Set(bodies.flat().map((p) => `${p.x},${p.y}`));
  let pos: Position;
  do {
    pos = { x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

// ---------------------------------------------------------------------------
// Match state
// ---------------------------------------------------------------------------

export interface PlayerSnapshot {
  player_id: string;
  alive: boolean;
  direction: Direction;
  body: Position[];
}

export interface MatchResult {
  winner_player_id: string | null;
  is_draw: boolean;
}

export interface StateSnapshot {
  match_id: string;
  tick: number;
  status: "running" | "finished";
  food: Position;
  players: PlayerSnapshot[];
  result?: MatchResult | null;
}

export class MatchState {
  readonly match_id: string;

  status: "waiting" | "running" | "finished" = "waiting";
  tickCount = 0;

  // Player 1
  player_1_id: string = "";
  body_1: Position[] = [];
  direction_1: Direction = { ...PLAYER_1_INITIAL_DIRECTION };

  // Player 2
  player_2_id: string = "";
  body_2: Position[] = [];
  direction_2: Direction = { ...PLAYER_2_INITIAL_DIRECTION };

  food: Position = { x: 22, y: 15 };

  // Locked inputs for the next tick
  input_1: Direction | null = null;
  input_2: Direction | null = null;

  result: MatchResult | null = null;

  constructor(match_id: string) {
    this.match_id = match_id;
  }

  initialize(player1: string, player2: string): void {
    this.player_1_id = player1;
    this.player_2_id = player2;

    this.body_1 = [
      { x: PLAYER_1_SPAWN.x, y: PLAYER_1_SPAWN.y },
      { x: PLAYER_1_SPAWN.x - 1, y: PLAYER_1_SPAWN.y },
      { x: PLAYER_1_SPAWN.x - 2, y: PLAYER_1_SPAWN.y },
    ];

    this.body_2 = [
      { x: PLAYER_2_SPAWN.x, y: PLAYER_2_SPAWN.y },
      { x: PLAYER_2_SPAWN.x + 1, y: PLAYER_2_SPAWN.y },
      { x: PLAYER_2_SPAWN.x + 2, y: PLAYER_2_SPAWN.y },
    ];

    this.direction_1 = { ...PLAYER_1_INITIAL_DIRECTION };
    this.direction_2 = { ...PLAYER_2_INITIAL_DIRECTION };
    this.food = randomFreePosition([this.body_1, this.body_2], ARENA_WIDTH, ARENA_HEIGHT);
  }

  /** Buffer a direction input for the next tick. */
  lockInput(player: 1 | 2, dir: Direction): void {
    if (player === 1) this.input_1 = dir;
    else this.input_2 = dir;
  }

  /**
   * Advance one server tick.
   *
   * Resolution order (per spec):
   *   1. lock inputs (caller responsibility — done before calling tick())
   *   2. compute both next head positions
   *   3. determine whether either head reaches current food
   *   4. build both next bodies simultaneously
   *   5. evaluate collisions on the resulting state
   *   6. emit the new snapshot or final result
   */
  tick(): MatchResult | null {
    if (this.status !== "running") return null;

    this.tickCount++;

    // Resolve directions (use locked input)
    const finalDir1 = this.input_1 ?? this.direction_1;
    const finalDir2 = this.input_2 ?? this.direction_2;
    this.input_1 = null;
    this.input_2 = null;

    // Compute next heads
    const head1 = this.body_1[0];
    const head2 = this.body_2[0];
    const nextHead1: Position = { x: head1.x + finalDir1.x, y: head1.y + finalDir1.y };
    const nextHead2: Position = { x: head2.x + finalDir2.x, y: head2.y + finalDir2.y };

    // Check food reach
    const p1Eats = nextHead1.x === this.food.x && nextHead1.y === this.food.y;
    const p2Eats = nextHead2.x === this.food.x && nextHead2.y === this.food.y;

    // Build next bodies simultaneously
    const nextBody1 = [nextHead1, ...this.body_1];
    const nextBody2 = [nextHead2, ...this.body_2];
    if (!p1Eats) nextBody1.pop();
    if (!p2Eats) nextBody2.pop();

    // Evaluate collisions
    const death1 = this._evaluateDeath(
      nextHead1, nextBody1, nextHead2, nextBody2, finalDir1,
    );
    const death2 = this._evaluateDeath(
      nextHead2, nextBody2, nextHead1, nextBody1, finalDir2,
    );

    // Apply results
    if (death1 && death2) {
      this.result = { winner_player_id: null, is_draw: true };
    } else if (death1) {
      this.result = { winner_player_id: this.player_2_id, is_draw: false };
    } else if (death2) {
      this.result = { winner_player_id: this.player_1_id, is_draw: false };
    }

    // Apply movement if both alive
    if (!death1) { this.body_1 = nextBody1; this.direction_1 = finalDir1; }
    if (!death2) { this.body_2 = nextBody2; this.direction_2 = finalDir2; }

    // Respawn food if eaten
    if (p1Eats || p2Eats) {
      this.food = randomFreePosition([this.body_1, this.body_2], ARENA_WIDTH, ARENA_HEIGHT);
    }

    // Mark finished if result decided
    if (this.result) {
      this.status = "finished";
      return this.result;
    }

    return null;
  }

  /**
   * Determine if a player dies at their next head position.
   *
   * Checks: wall, self, head-to-head, opponent body (excluding opponent head).
   */
  private _evaluateDeath(
    myHead: Position,
    myBody: Position[],
    oppHead: Position,
    oppBody: Position[],
    _myDir: Direction,
  ): boolean {
    if (isWallCollision(myHead, ARENA_WIDTH, ARENA_HEIGHT)) return true;

    // Self collision (body only, tail already popped if not growing)
    for (let i = 1; i < myBody.length; i++) {
      if (myBody[i].x === myHead.x && myBody[i].y === myHead.y) return true;
    }

    // Head-to-head
    if (myHead.x === oppHead.x && myHead.y === oppHead.y) return true;

    // Opponent body (exclude opponent head)
    for (let i = 1; i < oppBody.length; i++) {
      if (oppBody[i].x === myHead.x && oppBody[i].y === myHead.y) return true;
    }

    return false;
  }

  /** Produce a snapshot for WebSocket broadcast. */
  toSnapshot(): StateSnapshot {
    return {
      match_id: this.match_id,
      tick: this.tickCount,
      status: this.status === "running" ? "running" : "finished",
      food: this.food,
      players: [
        {
          player_id: this.player_1_id,
          alive: this.status !== "finished",
          direction: this.direction_1,
          body: this.body_1,
        },
        {
          player_id: this.player_2_id,
          alive: this.status !== "finished",
          direction: this.direction_2,
          body: this.body_2,
        },
      ],
      result: this.result,
    };
  }
}
