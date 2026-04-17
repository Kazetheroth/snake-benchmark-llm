## Server Module Boundaries

```
server/
├── config.ts              # Shared constants (arena, tick, spawn) — mirrors browser game constants
├── index.ts               # Entrypoint — wires modules together
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

### Stopping

Press `Ctrl+C` in either terminal. The server handles SIGINT/SIGTERM for clean shutdown.
