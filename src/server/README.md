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
│   └── rooms.ts           # Private rooms by code + RoomRegistry + tick loop
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

### T03: Authoritative Engine (implemented)

**Tick lifecycle:**
1. Room reaches 2 players → `match_found` sent to both
2. Match auto-starts → `match_start` sent with player_id and slot
3. Tick loop runs at 12 ticks/sec per room
4. Each tick: lock inputs → compute next heads → check food → build bodies → evaluate collisions → broadcast snapshot
5. On result: `round_end` event sent, tick loop stops, room transitions to `finished`

**Input validation:**
- Rejects non-cardinal directions (diagonals, zero vector)
- Rejects reverse directions (can't go left when moving right)
- Rejects same-as-current direction (no-op)
- Rejects duplicate queued input per tick
- Validates player_id and match_id match the session

**Collision resolution** (per spec order):
- Wall collision → player dies
- Self collision → player dies
- Head-to-head (same cell) → both die → draw
- Head into opponent body → attacker dies, defender wins
- Same-tick double death → draw

### T04: Remaining

- `input` message: fully wired (input validation + engine locking done in T03)
- T04: browser client WebSocket integration, state rendering, game menu

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
# Run all tests (single-player engine + multiplayer engine)
npm test

# Run only server tests
npm test -- tests/server/
```

### Stopping

Press `Ctrl+C` in either terminal. The server handles SIGINT/SIGTERM for clean shutdown.
