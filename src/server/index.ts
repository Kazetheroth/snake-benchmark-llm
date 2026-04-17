/**
 * Multiplayer Snake server — entry point.
 *
 * Wires together:
 *   transport   → WebSocket accept / dispatch
 *   session     → anonymous identity creation + tracking
 *   matchmaking → quick-match queue + private rooms + tick loop
 *   engine      → authoritative match loop (T03)
 *   serialization → message contract (T04)
 *
 * T01: module boundaries + bootstrap
 * T02: session lifecycle, quick-match queue, private rooms
 * T03: authoritative tick engine, input handling, match_start/broadcast/round_end
 */

import { WsTransport } from "./transport/ws";
import { SessionManager } from "./session/manager";
import { MatchQueue } from "./matchmaking/queue";
import { RoomRegistry } from "./matchmaking/rooms";
import { serialize } from "./serialization/protocol";
import {
  ClientEventType,
  type ErrorPayload,
  type HelloPayload,
  type MatchFoundPayload,
  type MatchStartPayload,
  type StatePayload,
  type RoundEndPayload,
  type ServerMessage,
  type ClientMessage,
  type InputPayload,
} from "./serialization/protocol";
import type { MatchResult, StateSnapshot } from "./engine/shared";
import type { WebSocket } from "ws";
import { Session } from "./session/manager";
import type { Direction } from "../game/constants";

// ---------------------------------------------------------------------------
// Module wiring
// ---------------------------------------------------------------------------

const transport = new WsTransport();
const sessions = new SessionManager();
const matchQueue = new MatchQueue();
const roomRegistry = new RoomRegistry();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, msg: ServerMessage): void {
  transport.send(ws, msg);
}

function sendHello(ws: WebSocket, session: { player_id: string }): void {
  const payload: HelloPayload = { type: "hello", player_id: session.player_id };
  send(ws, payload);
}

function sendError(ws: WebSocket, message: string, code = "UNKNOWN"): void {
  const payload: ErrorPayload = { type: "error", message, code };
  send(ws, payload);
}

// ---------------------------------------------------------------------------
// Room → client event mapping
// ---------------------------------------------------------------------------

/**
 * Called whenever a room tick produces a result or snapshot.
 * Broadcasts to both players in the room.
 */
function onRoomTick(
  matchId: string,
  result: MatchResult,
  snapshot: StateSnapshot,
): void {
  const room = roomRegistry.get(matchId);
  if (!room) return;

  const stateMsg: StatePayload = {
    type: "state",
    match_id: snapshot.match_id,
    tick: snapshot.tick,
    status: snapshot.status,
    food: snapshot.food,
    players: snapshot.players,
    result: snapshot.result,
  };

  // Broadcast to both players
  const broadcastRoom = (session: Session) => send(session.ws, stateMsg);
  room.player_1 && broadcastRoom(room.player_1);
  room.player_2 && broadcastRoom(room.player_2);
}

function sendMatchStart(p1: Session, p2: Session, matchId: string): void {
  const msg: MatchStartPayload = { type: "match_start", match_id: matchId, player_id: p1.player_id, slot: 1 };
  send(p1.ws, msg);
  const msg2: MatchStartPayload = { type: "match_start", match_id: matchId, player_id: p2.player_id, slot: 2 };
  send(p2.ws, msg2);
}

function sendRoundEnd(room: Session[], matchId: string, result: { winner_player_id: string | null; is_draw: boolean }): void {
  const msg: RoundEndPayload = { type: "round_end", match_id: matchId, result };
  for (const s of room) {
    send(s.ws, msg);
  }
}

// ---------------------------------------------------------------------------
// Room lifecycle helpers
// ---------------------------------------------------------------------------

function startRoomMatch(room: import("./matchmaking/rooms").Room, p1: Session, p2: Session): void {
  sendMatchStart(p1, p2, room.match_id);
  room.onFinished = onRoomTick;
  room.startMatch();
}

// ---------------------------------------------------------------------------
// Quick-match handler
// ---------------------------------------------------------------------------

function handleQueueJoin(session: Session): void {
  const partner = matchQueue.enqueue(session);
  if (partner === null) {
    // Still waiting — send a waiting state (minimal)
    send(session.ws, {
      type: "state",
      tick: 0,
      status: "waiting",
      food: { x: 0, y: 0 },
      players: [],
    } as unknown as ServerMessage);
    return;
  }

  // Paired — create a room
  const room = roomRegistry.create();
  const slot1 = room.join(session);
  const slot2 = room.join(partner);

  session.match_id = room.match_id;
  session.player_slot = slot1;
  partner.match_id = room.match_id;
  partner.player_slot = slot2;

  const displayName1 = session.displayName ?? "Player 1";
  const displayName2 = partner.displayName ?? "Player 2";

  send(session.ws, { type: "match_found", match_id: room.match_id, displayName: displayName2 } as ServerMessage);
  send(partner.ws, { type: "match_found", match_id: room.match_id, displayName: displayName1 } as ServerMessage);

  // Auto-start the match
  startRoomMatch(room, session, partner);
}

// ---------------------------------------------------------------------------
// Private room handlers
// ---------------------------------------------------------------------------

function handlePrivateMatchCreate(session: Session): void {
  const room = roomRegistry.create();
  const slot = room.join(session);
  session.match_id = room.match_id;
  session.player_slot = slot;
  session.displayName = "Player 1";

  send(session.ws, {
    type: "state",
    tick: 0,
    status: "waiting",
    food: { x: 0, y: 0 },
    players: [],
  } as unknown as ServerMessage);
}

function handlePrivateMatchJoin(
  session: Session,
  code: string,
): void {
  const room = roomRegistry.getCode(code);
  if (!room) {
    sendError(session.ws, `Room not found: ${code}`, "ROOM_NOT_FOUND");
    return;
  }

  if (room.hasBothPlayers()) {
    sendError(session.ws, "Room is full", "ROOM_FULL");
    return;
  }

  const slot = room.join(session);
  session.match_id = room.match_id;
  session.player_slot = slot;

  const opponent = room.getOtherPlayer(session);
  const displayName = opponent.displayName ?? "Player 1";

  send(session.ws, { type: "match_found", match_id: room.match_id, displayName } as ServerMessage);
  send(opponent.ws, { type: "match_found", match_id: room.match_id, displayName: session.displayName ?? "Player 2" } as ServerMessage);

  // Both players present — start the match
  startRoomMatch(room, session, opponent);
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function handleInput(session: Session, msg: InputPayload): void {
  // Validate: message must match session's player_id and match_id
  if (msg.player_id !== session.player_id) {
    sendError(session.ws, "player_id mismatch", "PLAYER_ID_MISMATCH");
    return;
  }

  if (msg.match_id !== session.match_id) {
    sendError(session.ws, "match_id mismatch", "MATCH_ID_MISMATCH");
    return;
  }

  if (!session.match_id) {
    sendError(session.ws, "Not in a match", "NOT_IN_MATCH");
    return;
  }

  const room = roomRegistry.get(session.match_id);
  if (!room) {
    sendError(session.ws, "Room not found", "ROOM_NOT_FOUND");
    return;
  }

  const accepted = room.submitInput(msg.player_id, msg.direction);
  if (!accepted) {
    sendError(session.ws, "Input rejected (invalid direction or already queued)", "INPUT_REJECTED");
  }
}

// ---------------------------------------------------------------------------
// Disconnect handler
// ---------------------------------------------------------------------------

function handleDisconnect(playerId: string): void {
  if (playerId === "(unassigned)") return;

  const session = sessions.get(playerId);
  if (!session) return;

  // If in a running match, opponent wins by forfeit
  if (session.match_id) {
    const room = roomRegistry.get(session.match_id);
    if (room && room.status === "running") {
      const other = room.getOtherPlayer(session);
      send(other.ws, {
        type: "error",
        message: `Opponent ${playerId} disconnected — you win!`,
        code: "OPPONENT_DISCONNECT",
      } as ServerMessage);
    }
    roomRegistry.remove(session.match_id);
  }

  // Remove from quick-match queue
  matchQueue.remove(session);

  sessions.remove(playerId);
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

function handleMessage(
  ws: WebSocket,
  _context: { player_id: string; match_id?: string; player_slot?: number },
  raw: string,
): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    sendError(ws, "Invalid JSON", "PARSE_ERROR");
    return;
  }

  // Assign session on first message from this WebSocket
  let session = sessions.getByWs(ws);
  if (!session) {
    session = sessions.create(ws);
    sendHello(ws, session);
  }

  switch (msg.type) {
    case ClientEventType.QUEUE_JOIN:
      handleQueueJoin(session);
      break;

    case ClientEventType.PRIVATE_MATCH_CREATE:
      handlePrivateMatchCreate(session);
      break;

    case ClientEventType.PRIVATE_MATCH_JOIN:
      handlePrivateMatchJoin(session, msg.code);
      break;

    case ClientEventType.INPUT:
      handleInput(session, msg as InputPayload);
      break;

    default:
      sendError(ws, `Unknown message type: ${(msg as { type: string }).type}`, "UNKNOWN_TYPE");
      break;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Starting Multiplayer Snake server...");
  await transport.start(handleMessage, handleDisconnect);

  const shutdown = async () => {
    console.log("Shutting down...");
    for (const room of roomRegistry.all) {
      room.shutdown();
    }
    roomRegistry.all.forEach((r) => roomRegistry.remove(r.match_id));
    await transport.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Exports for testing / composition
// ---------------------------------------------------------------------------

export {
  transport,
  sessions,
  matchQueue,
  roomRegistry,
  handleMessage,
  handleDisconnect,
};
