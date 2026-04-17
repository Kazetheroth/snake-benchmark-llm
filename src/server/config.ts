/**
 * Multiplayer server configuration.
 *
 * All constants mirror browser/src/game/constants.ts for the arena
 * dimensions and tick rate, and add server-specific tuning knobs.
 */

// --- Arena (mirrors browser game constants) ---
export const ARENA_WIDTH = 45;
export const ARENA_HEIGHT = 30;

// --- Tick (mirrors browser game constants) ---
export const TICKS_PER_SECOND = 12;
export const TICK_INTERVAL_MS = 1000 / TICKS_PER_SECOND;

// --- Spawn ---
// Player 1: left side moving right.
// Player 2: right side moving left.
// Positions chosen to leave safe distance from walls and each other.
export const PLAYER_1_SPAWN = { x: 5, y: 15 };
export const PLAYER_1_INITIAL_DIRECTION = { x: 1, y: 0 };
export const PLAYER_2_SPAWN = { x: 39, y: 15 };
export const PLAYER_2_INITIAL_DIRECTION = { x: -1, y: 0 };

// --- Room lifecycle ---
export const MAX_MATCH_DURATION_SECS = 300;
export const MAX_IDLE_SECS = 60;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// --- Reconnection (reserved for T06) ---
export const RECONNECT_GRACE_SECS = 10;

// --- Server ---
export const WS_HOST = "127.0.0.1";
export const WS_PORT = 8765;

// --- Rate limiting ---
export const MAX_INPUTS_PER_TICK = 1;
export const MAX_CONNECTIONS_PER_IP = 5;
