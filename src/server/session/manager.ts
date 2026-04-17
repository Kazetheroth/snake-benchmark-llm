/**
 * Session manager — creates anonymous identities and tracks connected
 * players. Each session owns a WebSocket connection, a generated
 * player_id, and an optional match_id.
 */

import type { WebSocket } from "ws";
import { randomBytes } from "node:crypto";

export class Session {
  readonly player_id: string;
  match_id: string | null = null;
  player_slot: 1 | 2 | null = null;
  displayName: string | null = null;
  lastActivity: number = Date.now();

  ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.player_id = `p_${randomBytes(4).toString("hex")}`;
  }
}

let nextWsId = 0;

function getWsId(ws: WebSocket): number {
  const key = "__sid" as string;
  const stored = (ws as unknown as Record<string, unknown>)[key];
  if (stored !== undefined) return stored as number;
  (ws as unknown as Record<string, unknown>)[key] = nextWsId;
  return nextWsId++;
}

export class SessionManager {
  private byWs = new Map<number, Session>();
  private byId = new Map<string, Session>();

  create(ws: WebSocket): Session {
    const session = new Session(ws);
    this.byWs.set(getWsId(ws), session);
    this.byId.set(session.player_id, session);
    return session;
  }

  remove(playerId: string): Session | null {
    const s = this.byId.get(playerId) ?? null;
    this.byId.delete(playerId);
    if (s) this.byWs.delete(getWsId(s.ws));
    return s;
  }

  get(playerId: string): Session | undefined {
    return this.byId.get(playerId);
  }

  getOrNotFound(playerId: string): Session {
    const s = this.get(playerId);
    if (!s) throw new Error(`Unknown player_id: ${playerId}`);
    return s;
  }

  getActiveCount(): number {
    return this.byId.size;
  }
}
