/**
 * Private room management — rooms identified by short codes.
 *
 * Lifecycle: waiting → running → finished
 *
 * Each room owns a MatchState engine. When both players are present,
 * the room transitions to running and a tick loop is started.
 */

import { randomInt } from "node:crypto";
import { Session } from "../session/manager";
import { MatchState, type MatchResult, type StateSnapshot } from "../engine/shared";
import { ROOM_CODE_LENGTH, ROOM_CODE_CHARS } from "../config";
import type { Direction } from "../../game/constants";

export type RoomStatus = "waiting" | "running" | "finished";

/**
 * Callback invoked when a room's tick produces a new snapshot.
 */
export type MatchFinishedCallback = (
  matchId: string,
  result: MatchResult,
  snapshot: StateSnapshot,
) => void;

export class Room {
  readonly code: string;
  readonly match_id: string;
  status: RoomStatus = "waiting";
  player_1: Session | null = null;
  player_2: Session | null = null;
  tick: number = 0;

  /** The authoritative engine for this room. */
  readonly engine: MatchState;

  /** Interval ID for the tick loop, null when not running. */
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  /** Callback fired when a tick produces a new state. */
  onFinished?: MatchFinishedCallback;

  constructor() {
    this.code = this._generateCode();
    this.match_id = `m_${this.code}`;
    this.engine = new MatchState(this.match_id);
  }

  private _generateCode(): string {
    const chars = ROOM_CODE_CHARS;
    return Array.from({ length: ROOM_CODE_LENGTH }, () =>
      chars[randomInt(chars.length)]
    ).join("");
  }

  join(session: Session): 1 | 2 {
    if (this.status !== "waiting") {
      throw new Error("Room is not accepting players");
    }
    if (this.player_1 === null) {
      this.player_1 = session;
      return 1;
    }
    if (this.player_2 === null) {
      this.player_2 = session;
      return 2;
    }
    throw new Error("Room is full");
  }

  hasBothPlayers(): boolean {
    return this.player_1 !== null && this.player_2 !== null;
  }

  getOtherPlayer(session: Session): Session {
    const other =
      session.player_slot === 1 ? this.player_2 : this.player_1;
    if (!other) throw new Error("Opponent not found");
    return other;
  }

  /**
   * Start the match — initialize engine and begin the tick loop.
   * Must be called after both players are assigned.
   */
  startMatch(): void {
    if (!this.player_1 || !this.player_2) return;
    if (this.status !== "waiting") return;

    this.engine.initialize(this.player_1.player_id, this.player_2.player_id);
    this.engine.start();
    this.status = "running";
    this.tick = 0;

    // Start the server tick loop (12 ticks/sec)
    this._intervalId = setInterval(() => this._onTick(), 1000 / 12);
  }

  /** Stop the tick loop and mark room finished. */
  stopMatch(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.status = "finished";
  }

  /** Submit an input direction for the given player. */
  submitInput(playerId: string, dir: Direction): boolean {
    if (this.status !== "running") return false;
    const slot = this._playerToSlot(playerId);
    if (slot === null) return false;
    return this.engine.tryLockInput(slot, dir);
  }

  /** Process one tick and notify the callback. */
  _onTick(): void {
    if (this.status !== "running") return;
    this.tick++;

    const result = this.engine.tick();

    if (this.onFinished) {
      this.onFinished(this.match_id, result!, this.engine.toSnapshot());
    }

    if (result) {
      this.stopMatch();
    }
  }

  getSnapshot(): StateSnapshot {
    return this.engine.toSnapshot();
  }

  getResult(): MatchResult | null {
    return this.engine.result;
  }

  /** Shutdown the room and clean up the tick interval. */
  shutdown(): void {
    this.stopMatch();
    this.onFinished = undefined;
  }

  private _playerToSlot(playerId: string): 1 | 2 | null {
    if (this.player_1?.player_id === playerId) return 1;
    if (this.player_2?.player_id === playerId) return 2;
    return null;
  }
}

/**
 * RoomRegistry tracks all active rooms (both waiting and running).
 */
export class RoomRegistry {
  private rooms = new Map<string, Room>();

  create(): Room {
    const room = new Room();
    this.rooms.set(room.match_id, room);
    return room;
  }

  /** Look up room by match_id directly. */
  get(matchId: string): Room | undefined {
    return this.rooms.get(matchId);
  }

  /** Look up room by 6-char code (auto-prefixed with `m_`). */
  getCode(code: string): Room | undefined {
    return this.rooms.get(`m_${code}`);
  }

  getOrThrow(matchId: string): Room {
    const room = this.rooms.get(matchId);
    if (!room) throw new Error(`Unknown room: ${matchId}`);
    return room;
  }

  remove(matchId: string): void {
    const room = this.rooms.get(matchId);
    room?.shutdown();
    this.rooms.delete(matchId);
  }

  get all(): Room[] {
    return Array.from(this.rooms.values());
  }
}
