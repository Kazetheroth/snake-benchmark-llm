## Server Module Boundaries

```
server/
├── config.ts              # Shared constants (arena, tick, spawn) — mirrors browser game constants
├── index.ts               # Entrypoint — wires modules, handles connection lifecycle + matchmaking
├── serialization/
│   └── protocol.ts        # WebSocket event types and payload shapes (client↔server)
├── session/
│   └── manager.ts         # Anonymous session identities + WebSocket binding
├── matchmaking/
│   ├── queue.ts           # Quick-match FIFO pairing
│   └── rooms.ts           # Private rooms by code + RoomRegistry
├── engine/
│   └── shared.ts          # Authoritative 1v1 match engine — deterministic tick + collision
└── transport/
    └── ws.ts              # WebSocket server lifecycle + send/broadcast helpers
```

### Design Decisions

- **Shared game engine**: The server has its own `engine/shared.ts` for 1v1 multiplayer (two snakes, shared food, head-to-opponent-body collision). The browser's single-player `game/engine.ts` handles one snake. Both share `config.ts` for arena dimensions and tick rate. This keeps the single-player and multiplayer engines independent while staying in sync on constants.
- **Server-authoritative**: The server owns all game state. Clients only send inputs and render snapshots.
- **Anonymous**: No accounts. Each connection gets a `player_id` from the server.
- **TypeScript everywhere**: Server runs with `tsx` (no build step), sharing type definitions with the browser game via relative imports.

### T02: Session & Matchmaking (implemented)

**Connection lifecycle:**
1. Client connects → server creates anonymous `Session` with `player_id`
2. Server sends `hello` event with the `player_id`
3. Client sends one of: `queue_join`, `private_match_create`, `private_match_join`

**Quick match flow:**
1. Client A sends `queue_join` → added to FIFO queue
2. Client B sends `queue_join` → paired, a private room is created behind the scenes
3. Both receive `match_found` with the match_id and opponent's display name

**Private match flow:**
1. Client A sends `private_match_create` → room created, given a 6-char code
2. Client A sees room code (sent via `state` event placeholder; browser integration handles display)
3. Client B sends `private_match_join` with the code
4. Both receive `match_found`

**Disconnect handling:**
- Before match starts: player is removed from queue/room, other player gets error
- Room is cleaned up from `RoomRegistry`

### T03/T04: Remaining

- T03: Engine tick loop wired into match rooms (start/stop tick on match start/end)
- T04: `input` message handling, state broadcast loop, reconnect

## Local Development

### Prerequisites

- Node.js ≥ 20
- `npm install` in the `browser/` directory

### Running

```bash
# Terminal 1 — game client (single-player)
npm run dev

# Terminal 2 — multiplayer server
npm run server:dev
```

The WebSocket server listens on `ws://127.0.0.1:8765`.

### Testing

```bash
# Run existing single-player engine tests (unchanged by T02)
npm test
```

### Stopping

Press `Ctrl+C` in either terminal. The server handles SIGINT/SIGTERM for clean shutdown.
