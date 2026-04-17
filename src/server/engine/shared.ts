/**
 * Server-authoritative 1v1 match engine.
 *
 * Advances both snakes on a fixed tick and resolves all collisions
 * per the Phase 2 spec resolution order.
 *
 * Resolution order (per spec):
 *   1. lock the latest valid input for each player
 *   2. compute both next head positions
 *   3. determine whether either head reaches the current food cell
 *   4. build both next snake bodies simultaneously
 *   5. evaluate collisions on the resulting authoritative state
 *   6. emit the new snapshot or final result
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
import { DIRECTIONS } from "../../game/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWallCollision(pos: Position, width: number, height: number): boolean {
  return pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height;
}

function isCardinalDir(dir: Direction): boolean {
  return (
    (dir.x === DIRECTIONS.RIGHT.x && dir.y === DIRECTIONS.RIGHT.y) ||
    (dir.x === DIRECTIONS.LEFT.x && dir.y === DIRECTIONS.LEFT.y) ||
    (dir.x === DIRECTIONS.UP.x && dir.y === DIRECTIONS.UP.y) ||
    (dir.x === DIRECTIONS.DOWN.x && dir.y === DIRECTIONS.DOWN.y)
  );
}

function isReverse(a: Direction, b: Direction): boolean {
  return a.x === -b.x && a.y === -b.y;
}

function randomFreePosition(bodies: Position[][], width: number, height: number): Position {
  const occupied = new Set(bodies.flat().map((p) => `${p.x},${p.y}`));
  let pos: Position;
  do {
    pos = { x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// MatchState
// ---------------------------------------------------------------------------

export class MatchState {
  readonly match_id: string;
  status: "waiting" | "running" | "finished" = "waiting";
  tickCount = 0;

  player_1_id: string = "";
  body_1: Position[] = [];
  direction_1: Direction = { ...PLAYER_1_INITIAL_DIRECTION };

  player_2_id: string = "";
  body_2: Position[] = [];
  direction_2: Direction = { ...PLAYER_2_INITIAL_DIRECTION };

  food: Position = { x: 22, y: 15 };

  input_1: Direction | null = null;
  input_2: Direction | null = null;

  result: MatchResult | null = null;

  constructor(match_id: string) {
    this.match_id = match_id;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

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

  start(): void {
    if (this.status !== "waiting") return;
    this.status = "running";
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  /**
   * Validate and buffer an input direction.
   * @returns true if the direction was accepted, false if rejected
   */
  tryLockInput(player: 1 | 2, dir: Direction): boolean {
    if (this.status !== "running") return false;
    if (!isCardinalDir(dir)) return false;

    const currentDir = player === 1 ? this.direction_1 : this.direction_2;
    if (isReverse(dir, currentDir)) return false;
    // Reject if same as current direction or already queued
    if (isSameDirection(dir, currentDir)) return false;
    const queued = player === 1 ? this.input_1 : this.input_2;
    if (queued && isSameDirection(queued, dir)) return false;

    if (player === 1) this.input_1 = { ...dir };
    else this.input_2 = { ...dir };

    return true;
  }

  /** Reset inputs for the current tick (after tick() has consumed them). */
  clearInputs(): void {
    this.input_1 = null;
    this.input_2 = null;
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  tick(): MatchResult | null {
    if (this.status !== "running") return null;

    this.tickCount++;

    // 1. Resolve directions (use locked input, fall back to current)
    const finalDir1 = this.input_1 ?? this.direction_1;
    const finalDir2 = this.input_2 ?? this.direction_2;
    this.clearInputs();

    // 2. Compute next heads simultaneously
    const head1 = this.body_1[0];
    const head2 = this.body_2[0];
    const nextHead1: Position = { x: head1.x + finalDir1.x, y: head1.y + finalDir1.y };
    const nextHead2: Position = { x: head2.x + finalDir2.x, y: head2.y + finalDir2.y };

    // 3. Check food reach
    const p1Eats = nextHead1.x === this.food.x && nextHead1.y === this.food.y;
    const p2Eats = nextHead2.x === this.food.x && nextHead2.y === this.food.y;

    // 4. Build next bodies simultaneously
    const nextBody1 = [nextHead1, ...this.body_1];
    const nextBody2 = [nextHead2, ...this.body_2];
    if (!p1Eats) nextBody1.pop();
    if (!p2Eats) nextBody2.pop();

    // 5. Evaluate collisions on resulting state
    const death1 = this._evaluateDeath(nextHead1, nextBody1, nextHead2, nextBody2);
    const death2 = this._evaluateDeath(nextHead2, nextBody2, nextHead1, nextBody1);

    // 6. Apply results
    if (death1 && death2) {
      this.result = { winner_player_id: null, is_draw: true };
    } else if (death1) {
      this.result = { winner_player_id: this.player_2_id, is_draw: false };
    } else if (death2) {
      this.result = { winner_player_id: this.player_1_id, is_draw: false };
    }

    // Apply movement if both alive
    if (!death1) {
      this.body_1 = nextBody1;
      this.direction_1 = finalDir1;
    }
    if (!death2) {
      this.body_2 = nextBody2;
      this.direction_2 = finalDir2;
    }

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

  // -------------------------------------------------------------------------
  // Collision (per spec resolution order)
  // -------------------------------------------------------------------------

  /**
   * Determine if the player whose head is at myHead dies.
   *
   * Checks (per spec):
   *   - wall collision
   *   - self collision (body, tail already popped if not growing)
   *   - head-to-head (same cell → both die)
   *   - opponent body (exclude opponent head)
   */
  private _evaluateDeath(
    myHead: Position,
    myBody: Position[],
    oppHead: Position,
    oppBody: Position[],
  ): boolean {
    // Wall
    if (isWallCollision(myHead, ARENA_WIDTH, ARENA_HEIGHT)) return true;

    // Self (exclude tail if it moved away; already popped above)
    for (let i = 1; i < myBody.length; i++) {
      if (myBody[i].x === myHead.x && myBody[i].y === myHead.y) return true;
    }

    // Head-to-head (same cell on same tick)
    if (myHead.x === oppHead.x && myHead.y === oppHead.y) return true;

    // Opponent body (exclude opponent head per spec)
    for (let i = 1; i < oppBody.length; i++) {
      if (oppBody[i].x === myHead.x && oppBody[i].y === myHead.y) return true;
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function isSameDirection(a: Direction, b: Direction): boolean {
  return a.x === b.x && a.y === b.y;
}
