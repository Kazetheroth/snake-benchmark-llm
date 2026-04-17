/**
 * WebSocket transport — wraps the `ws` library for the server.
 *
 * Handles server lifecycle, rate-limiting per IP, and dispatching
 * incoming frames to a handler callback.
 */

import { WebSocketServer, WebSocket, type Server } from "ws";
import { serialize } from "../serialization/protocol";
import type { ServerMessage } from "../serialization/protocol";
import { WS_HOST, WS_PORT, MAX_CONNECTIONS_PER_IP } from "../config";

type Request = import("http").IncomingMessage & { socket?: { remoteAddress?: string } };

export type MessageHandler = (
  ws: WebSocket,
  context: {
    player_id: string;
    match_id?: string;
    player_slot?: number;
  },
  raw: string,
) => void;

export type DisconnectHandler = (playerId: string) => void;

let wsIdCounter = 0;

/**
 * Assign a unique numeric ID to a WebSocket for internal tracking.
 * Stored as a hidden property on the ws instance.
 */
export function getWsId(ws: WebSocket): number {
  const key = "__sid" as string;
  const stored = (ws as unknown as Record<string, unknown>)[key];
  if (stored !== undefined) return stored as number;
  (ws as unknown as Record<string, unknown>)[key] = wsIdCounter;
  return wsIdCounter++;
}

export class WsTransport {
  private wss!: Server;
  private handler!: MessageHandler;
  private onDisconnect?: DisconnectHandler;
  private ipCounts = new Map<string, number>();

  async start(
    handler: MessageHandler,
    onDisconnect?: DisconnectHandler,
  ): Promise<void> {
    this.handler = handler;
    this.onDisconnect = onDisconnect;
    this.wss = new WebSocketServer({ host: WS_HOST, port: WS_PORT });

    this.wss.on("connection", (ws, req) => {
      getWsId(ws); // ensure ws has an ID on connect
      const ip = (req as Request).socket?.remoteAddress ?? "unknown";

      const count = this.ipCounts.get(ip) ?? 0;
      if (count >= MAX_CONNECTIONS_PER_IP) {
        ws.close(1013, "Too many connections from this IP");
        return;
      }
      this.ipCounts.set(ip, count + 1);

      ws.on("message", (data) => {
        const raw = data.toString("utf-8");
        try {
          this.handler(ws, { player_id: "(unassigned)" }, raw);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.send(ws, { type: "error", message, code: "HANDLER_ERROR" });
        }
      });

      ws.on("close", () => {
        this.ipCounts.set(ip, Math.max(0, count - 1));
        this.onDisconnect?.("(unassigned)");
      });
    });

    console.log(`WebSocket server listening on ${WS_HOST}:${WS_PORT}`);
  }

  /** Send a message to a specific WebSocket. */
  send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialize(msg));
    }
  }

  /** Broadcast a message to all connected WebSocket sessions. */
  broadcast(msg: ServerMessage, exclude?: WebSocket): void {
    const payload = serialize(msg);
    this.wss.clients.forEach((client: WebSocket) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
