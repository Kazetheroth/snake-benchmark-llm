/**
 * Private room management — rooms identified by short codes.
 *
 * Lifecycle: waiting → running → finished
 */

import { randomInt } from "node:crypto";
import { Session } from "../session/manager";
import { ROOM_CODE_LENGTH, ROOM_CODE_CHARS } from "../config";

export type RoomStatus = "waiting" | "running" | "finished";

export class Room {
  readonly code: string;
  readonly match_id: string;
  status: RoomStatus = "waiting";
  player_1: Session | null = null;
  player_2: Session | null = null;
  tick: number = 0;

  constructor() {
    this.code = this._generateCode();
    this.match_id = `m_${this.code}`;
  }

  private _generateCode(): string {
    const chars = ROOM_CODE_CHARS;
    return Array.from({ length: ROOM_CODE_LENGTH }, () =>
      chars[randomInt(chars.length)]
    ).join("");
  }

  /**
   * Assign a session to the first available slot.
   * @returns player slot (1 or 2)
   */
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

  get(code: string): Room | undefined {
    return this.rooms.get(`m_${code}`);
  }

  getOrThrow(matchId: string): Room {
    const room = this.rooms.get(matchId);
    if (!room) throw new Error(`Unknown room: ${matchId}`);
    return room;
  }

  remove(matchId: string): void {
    this.rooms.delete(matchId);
  }

  get all(): Room[] {
    return Array.from(this.rooms.values());
  }
}
