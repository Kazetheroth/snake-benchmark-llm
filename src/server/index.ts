/**
 * Multiplayer Snake server — entry point.
 *
 * Wires together:
 *   transport   → WebSocket accept / dispatch
 *   session     → anonymous identity creation
 *   matchmaking → quick-match queue + private rooms
 *   engine      → authoritative match loop
 *   serialization → message contract
 *
 * Per the T01 scope, this bootstrap wires the module boundaries and
 * provides a working local development server. Actual matchmaking and
 * tick loop logic are implemented in subsequent tickets.
 */

import { WsTransport } from "./transport/ws";
import { SessionManager } from "./session/manager";
import { MatchQueue } from "./matchmaking/queue";
import { RoomRegistry } from "./matchmaking/rooms";
import { serialize } from "./serialization/protocol";
import type { ServerMessage } from "./serialization/protocol";
import type { WebSocket } from "ws";

// Module wiring — each subsystem owns its own responsibility.
// T02/T03/T04 will fill in the handler logic here.

const transport = new WsTransport();
const sessions = new SessionManager();
const matchQueue = new MatchQueue();
const roomRegistry = new RoomRegistry();

// ---------------------------------------------------------------------------
// Message dispatch placeholder
// ---------------------------------------------------------------------------

async function handleMessage(
  ws: WebSocket,
  _session: { player_id: string },
  raw: string,
): Promise<void> {
  // T02: assign anonymous session, handle queue_join / private_match_create / private_match_join
  // T04: deserialize and route to matchmaking or engine
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Starting Multiplayer Snake server...");
  await transport.start(handleMessage);

  // Graceful shutdown
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

export { transport, sessions, matchQueue, roomRegistry, handleMessage };
