/**
 * WebSocket message contract — every event type and payload shape
 * defined in the Phase 2 spec.
 */

import type { Position } from "../../game/types";
import type { Direction } from "../../game/constants";

// ---------------------------------------------------------------------------
// Event type registry
// ---------------------------------------------------------------------------

export const ServerEventType = {
  HELLO: "hello",
  MATCH_FOUND: "match_found",
  MATCH_START: "match_start",
  STATE: "state",
  ROUND_END: "round_end",
  PLAYER_DISCONNECTED: "player_disconnected",
  ERROR: "error",
} as const;

export const ClientEventType = {
  QUEUE_JOIN: "queue_join",
  PRIVATE_MATCH_CREATE: "private_match_create",
  PRIVATE_MATCH_JOIN: "private_match_join",
  INPUT: "input",
} as const;

// ---------------------------------------------------------------------------
// Client → Server payloads
// ---------------------------------------------------------------------------

export interface QueueJoinPayload {
  type: typeof ClientEventType.QUEUE_JOIN;
}

export interface PrivateMatchCreatePayload {
  type: typeof ClientEventType.PRIVATE_MATCH_CREATE;
  displayName?: string;
}

export interface PrivateMatchJoinPayload {
  type: typeof ClientEventType.PRIVATE_MATCH_JOIN;
  code: string;
}

export interface InputPayload {
  type: typeof ClientEventType.INPUT;
  match_id: string;
  player_id: string;
  direction: Direction;
  client_input_seq: number;
}

export type ClientMessage =
  | QueueJoinPayload
  | PrivateMatchCreatePayload
  | PrivateMatchJoinPayload
  | InputPayload;

// ---------------------------------------------------------------------------
// Server → Client payloads
// ---------------------------------------------------------------------------

export interface HelloPayload {
  type: typeof ServerEventType.HELLO;
  player_id: string;
}

export interface ErrorPayload {
  type: typeof ServerEventType.ERROR;
  message: string;
  code?: string;
}

export interface MatchFoundPayload {
  type: typeof ServerEventType.MATCH_FOUND;
  match_id: string;
  displayName: string;
}

export interface MatchStartPayload {
  type: typeof ServerEventType.MATCH_START;
  match_id: string;
  player_id: string;
  slot: number;
}

export interface StatePayload {
  type: typeof ServerEventType.STATE;
  match_id: string;
  tick: number;
  status: "running" | "finished";
  food: Position;
  players: ServerPlayerState[];
  result?: MatchResult | null;
}

export interface ServerPlayerState {
  player_id: string;
  alive: boolean;
  direction: Direction;
  body: Position[];
}

export interface MatchResult {
  winner_player_id: string | null;
  is_draw: boolean;
}

export interface RoundEndPayload {
  type: typeof ServerEventType.ROUND_END;
  match_id: string;
  result: MatchResult;
}

export interface PlayerDisconnectedPayload {
  type: typeof ServerEventType.PLAYER_DISCONNECTED;
  match_id: string;
  remaining_player_id: string;
  forfeit: boolean;
}

export type ServerMessage =
  | HelloPayload
  | ErrorPayload
  | MatchFoundPayload
  | MatchStartPayload
  | StatePayload
  | RoundEndPayload
  | PlayerDisconnectedPayload;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function serialize(msg: ServerMessage): string {
  return JSON.stringify(msg);
}

export function deserialize(raw: string): ServerMessage {
  return JSON.parse(raw) as ServerMessage;
}
