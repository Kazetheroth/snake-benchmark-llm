/**
 * Multiplayer Snake server — entry point.
 *
 * Wires together:
 *   transport   → WebSocket accept / dispatch
 *   session     → anonymous identity creation + tracking
 *   matchmaking → quick-match queue + private rooms
 *   engine      → authoritative match loop (T03)
 *   serialization → message contract (T04)
 *
 * Per T01, this bootstrap wires the module boundaries and provides
 * a working local development server. T02 implements session lifecycle,
 * quick-match queueing, and private room creation/join.
 */

import { WsTransport } from "./transport/ws";
import { SessionManager } from "./session/manager";
import { MatchQueue } from "./matchmaking/queue";
import { RoomRegistry } from "./matchmaking/rooms";
import {
  ClientEventType,
  type ErrorPayload,
  type HelloPayload,
  type MatchFoundPayload,
  type ServerMessage,
  type ClientMessage,
} from "./serialization/protocol";
import type { WebSocket } from "ws";
import { Session } from "./session/manager";

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

function broadcastMatchFound(
  matchId: string,
  displayName: string,
  p1Ws: WebSocket,
  p2Ws: WebSocket,
): void {
  const msg: MatchFoundPayload = {
    type: "match_found",
    match_id: matchId,
    displayName,
  };
  send(p1Ws, msg);
  send(p2Ws, msg);
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

  // Paired — create a private room and assign both players
  const room = roomRegistry.create();
  const slot1 = room.join(session);
  const slot2 = room.join(partner);

  session.match_id = room.match_id;
  session.player_slot = slot1;
  partner.match_id = room.match_id;
  partner.player_slot = slot2;

  const displayName1 = session.displayName ?? "Player 1";
  const displayName2 = partner.displayName ?? "Player 2";

  // Send each player info about their match + opponent
  send(session.ws, {
    type: "match_found",
    match_id: room.match_id,
    displayName: displayName2,
  } as ServerMessage);

  send(partner.ws, {
    type: "match_found",
    match_id: room.match_id,
    displayName: displayName1,
  } as ServerMessage);
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
  const room = roomRegistry.get(code);
  if (!room) {
    sendError(session.ws, `Room not found: ${code}`, "ROOM_NOT_FOUND");
    return;
  }

  if (room.status !== "waiting") {
    sendError(session.ws, "Room is no longer accepting players", "ROOM_FULL");
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

  send(session.ws, {
    type: "match_found",
    match_id: room.match_id,
    displayName,
  } as ServerMessage);

  send(opponent.ws, {
    type: "match_found",
    match_id: room.match_id,
    displayName: session.displayName ?? "Player 2",
  } as ServerMessage);
}

// ---------------------------------------------------------------------------
// Disconnect handler
// ---------------------------------------------------------------------------

function handleDisconnect(playerId: string): void {
  // Don't remove "(unassigned)" — no session to clean up
  if (playerId === "(unassigned)") return;

  const session = sessions.get(playerId);
  if (!session) return;

  // If in a room, notify the other player and remove the room
  if (session.match_id) {
    const room = roomRegistry.get(session.match_id);
    if (room && room.hasBothPlayers()) {
      const other = room.getOtherPlayer(session);
      send(other.ws, {
        type: "error",
        message: `Opponent ${playerId} disconnected`,
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
