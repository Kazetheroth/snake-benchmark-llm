import { describe, it, expect } from "vitest";
import { MatchState } from "../../src/server/engine/shared";
import type { Direction } from "../../src/game/constants";

// Helper: create a match state with dummy player IDs
function createMatch(): MatchState {
  const m = new MatchState("m_test");
  m.initialize("p_1", "p_2");
  m.start();
  return m;
}

// Helper: run N ticks with given directions
function runTicks(
  match: MatchState,
  dir1: Direction,
  dir2: Direction,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    match.tryLockInput(1, dir1);
    match.tryLockInput(2, dir2);
    match.tick();
  }
}

describe("MatchState — initialization", () => {
  it("should spawn two snakes at configured positions", () => {
    const m = createMatch();
    expect(m.body_1).toHaveLength(3);
    expect(m.body_1[0]).toEqual({ x: 5, y: 15 });
    expect(m.body_2).toHaveLength(3);
    expect(m.body_2[0]).toEqual({ x: 39, y: 15 });
  });

  it("should start with correct directions", () => {
    const m = createMatch();
    expect(m.direction_1).toEqual({ x: 1, y: 0 });
    expect(m.direction_2).toEqual({ x: -1, y: 0 });
  });

  it("should place food on a free cell", () => {
    const m = createMatch();
    const allCells = [...m.body_1, ...m.body_2];
    expect(
      allCells.some((s) => s.x === m.food.x && s.y === m.food.y),
    ).toBe(false);
  });

  it("should start in running status", () => {
    const m = createMatch();
    expect(m.status).toBe("running");
  });

  it("should produce a valid initial snapshot", () => {
    const m = createMatch();
    const snap = m.toSnapshot();
    expect(snap.match_id).toBe("m_test");
    expect(snap.tick).toBe(0);
    expect(snap.status).toBe("running");
    expect(snap.players).toHaveLength(2);
    expect(snap.players[0].alive).toBe(true);
    expect(snap.players[1].alive).toBe(true);
    expect(snap.result).toBeNull();
  });
});

describe("MatchState — simultaneous movement", () => {
  it("should advance both snakes on each tick", () => {
    const m = createMatch();
    const head1Before = { ...m.body_1[0] };
    const head2Before = { ...m.body_2[0] };

    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    expect(m.body_1[0].x).toBe(head1Before.x + 1);
    expect(m.body_1[0].y).toBe(head1Before.y);
    expect(m.body_2[0].x).toBe(head2Before.x - 1);
    expect(m.body_2[0].y).toBe(head2Before.y);
  });

  it("should use default direction when no input is locked", () => {
    const m = createMatch();
    m.tick();
    expect(m.body_1[0].x).toBe(5 + 1);
    expect(m.body_1[0].y).toBe(15);
    expect(m.body_2[0].x).toBe(39 - 1);
    expect(m.body_2[0].y).toBe(15);
  });

  it("should process one buffered direction per tick", () => {
    const m = createMatch();
    const initialHead = { ...m.body_1[0] };
    // Queue a direction, then queue the SAME direction again
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tick();
    // Only one directional change should apply
    expect(m.body_1[0].y).toBe(initialHead.y - 1);
  });
});

describe("MatchState — food consumption", () => {
  it("should grow a snake when eating food", () => {
    const m = createMatch();
    const startLen = m.body_1.length;

    m.food = { x: 6, y: 15 }; // adjacent to P1's head (5, 15)

    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    expect(m.body_1.length).toBe(startLen + 1);
    expect(m.body_2.length).toBe(3);
  });

  it("should not grow when not eating", () => {
    const m = createMatch();
    const startLen = m.body_1.length;
    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();
    expect(m.body_1.length).toBe(startLen);
  });

  it("should respawn food after eating", () => {
    const m = createMatch();
    m.food = { x: 6, y: 15 };

    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    expect(m.food.x).toBeGreaterThan(0);
    expect(m.food.y).toBeGreaterThan(0);
  });
});

describe("MatchState — wall collision", () => {
  it("should kill a player hitting the right wall", () => {
    const m = new MatchState("m_test");
    m.player_1_id = "p_1";
    m.player_2_id = "p_2";
    // P1 near right wall (x=40), P2 far left (x=20)
    // Both start moving UP, then P1 turns right toward wall, P2 turns left away
    m.body_1 = [
      { x: 40, y: 15 },
      { x: 40, y: 14 },
      { x: 40, y: 13 },
    ];
    m.body_2 = [
      { x: 20, y: 15 },
      { x: 20, y: 14 },
      { x: 20, y: 13 },
    ];
    m.direction_1 = { x: 0, y: -1 }; // up
    m.direction_2 = { x: 0, y: -1 }; // up
    m.status = "running";
    m.food = { x: 5, y: 5 };

    // Tick 1: P1 turns right (→x=41), P2 turns left (→x=19)
    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    // P1 needs 4 more right ticks to hit wall (41+4=45)
    for (let i = 0; i < 4; i++) {
      m.tryLockInput(1, { x: 1, y: 0 });
      m.tryLockInput(2, { x: -1, y: 0 });
      m.tick();
    }
    expect(m.status).toBe("finished");
    expect(m.result?.winner_player_id).toBe("p_2");
  });

  it("should kill a player hitting the left wall", () => {
    const m = new MatchState("m_test");
    m.player_1_id = "p_1";
    m.player_2_id = "p_2";
    // P2 near left wall (x=3), P1 far right (x=40)
    // Both start moving UP, then P2 turns left toward wall, P1 turns right away
    m.body_1 = [
      { x: 40, y: 15 },
      { x: 40, y: 14 },
      { x: 40, y: 13 },
    ];
    m.body_2 = [
      { x: 3, y: 15 },
      { x: 3, y: 14 },
      { x: 3, y: 13 },
    ];
    m.direction_1 = { x: 0, y: -1 }; // up
    m.direction_2 = { x: 0, y: -1 }; // up
    m.status = "running";
    m.food = { x: 22, y: 15 };

    // Tick 1: P2 turns left (→ x=2), P1 turns right (→ x=41)
    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    // P2 at x=2, needs 3 more left ticks to hit wall
    for (let i = 0; i < 3; i++) {
      m.tryLockInput(1, { x: 1, y: 0 });
      m.tryLockInput(2, { x: -1, y: 0 });
      m.tick();
    }
    // P2 at x=-1 on last tick → dies
    expect(m.status).toBe("finished");
    expect(m.result?.winner_player_id).toBe("p_1");
  });

  it("should kill a player hitting the top wall", () => {
    const m = createMatch();
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tick();
    runTicks(m, { x: 0, y: -1 }, { x: 0, y: -1 }, 16);
    expect(m.status).toBe("finished");
  });

  it("should kill a player hitting the bottom wall", () => {
    const m = createMatch();
    m.tryLockInput(1, { x: 0, y: 1 });
    m.tick();
    runTicks(m, { x: 0, y: 1 }, { x: 0, y: 1 }, 16);
    expect(m.status).toBe("finished");
  });
});

describe("MatchState — self collision", () => {
  it("should kill when a snake runs into its own body", () => {
    const m = new MatchState("m_test");
    m.player_1_id = "p_1";
    m.player_2_id = "p_2";

    // 5-segment P1, long enough to loop back into itself.
    // P1 starts at (10,10) moving right, then: RIGHT, UP, LEFT, LEFT, DOWN, RIGHT
    // On the final RIGHT tick, head lands on its own body.
    //
    // Initial: head=(10,10), body=[(10,10),(9,10),(8,10),(7,10),(6,10)]
    // tick 1 (RIGHT):  head=(11,10), body=[(11,10),(10,10),(9,10),(8,10),(7,10)]
    // tick 2 (UP):     head=(11,9),  body=[(11,9),(11,10),(10,10),(9,10),(8,10)]
    // tick 3 (LEFT):   head=(10,9),  body=[(10,9),(11,9),(11,10),(10,10),(9,10)]
    // tick 4 (LEFT):   head=(9,9),   body=[(9,9),(10,9),(11,9),(11,10),(10,10)]
    // tick 5 (DOWN):   head=(9,10),  body=[(9,10),(9,9),(10,9),(11,9),(11,10)]
    // tick 6 (RIGHT):  head=(10,10), body=[(10,10),(9,10),(9,9),(10,9),(11,9)]
    //   Check: (10,10) in body[1..]? body[2]=(9,9), body[3]=(10,9), body[4]=(11,9) → NO!
    //
    // Need to adjust. Let me try: RIGHT, UP, LEFT, LEFT, LEFT, DOWN, RIGHT
    // Initial: (10,10),(9,10),(8,10),(7,10),(6,10)
    // tick 1 (R):  (11,10),(10,10),(9,10),(8,10),(7,10)
    // tick 2 (U):  (11,9),(11,10),(10,10),(9,10),(8,10)
    // tick 3 (L):  (10,9),(11,9),(11,10),(10,10),(9,10)
    // tick 4 (L):  (9,9),(10,9),(11,9),(11,10),(10,10)
    // tick 5 (L):  (8,9),(9,9),(10,9),(11,9),(11,10)
    // tick 6 (D):  (8,10),(8,9),(9,9),(10,9),(11,9)
    // tick 7 (R):  (9,10),(8,10),(8,9),(9,9),(10,9)
    //   Check: (9,10) in body[1..]? body[1]=(8,10), body[2]=(8,9), body[3]=(9,9), body[4]=(10,9) → NO!
    //
    // Simpler approach: set body so that the snake's path is pre-placed
    // and the head just needs to enter it. Use 5 segments in a U-shape:
    // head=(10,8), body=[(10,8),(10,9),(10,10),(9,10),(8,10)]
    // Move DOWN to (10,9) → collides with body[1]=(10,9)!
    m.body_1 = [
      { x: 10, y: 8 },
      { x: 10, y: 9 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    m.body_2 = [
      { x: 30, y: 10 },
      { x: 31, y: 10 },
      { x: 32, y: 10 },
    ];
    m.direction_1 = { x: 0, y: 1 }; // currently moving DOWN
    m.direction_2 = { x: -1, y: 0 };
    m.status = "running";
    m.food = { x: 22, y: 15 };

    // Try to lock DOWN again (same as current direction) — should be rejected
    // Then lock DOWN again after tick. Let me just tick with DOWN.
    m.tryLockInput(1, { x: 0, y: 1 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    // P1 next head at (10,9) — in body at index 1! Self collision.
    expect(m.status).toBe("finished");
    expect(m.result?.winner_player_id).toBe("p_2");
  });

  it("should NOT kill a 3-segment snake doing a simple turn", () => {
    const m = createMatch();
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tick();
    m.tryLockInput(1, { x: -1, y: 0 });
    m.tick();
    m.tryLockInput(1, { x: 0, y: 1 });
    m.tick();
    expect(m.status).toBe("running");
  });
});

describe("MatchState — head into opponent body", () => {
  it("should kill the attacker when their head hits opponent body", () => {
    const m = new MatchState("m_test");
    m.player_1_id = "p_1";
    m.player_2_id = "p_2";

    // Both moving right. P1's head will land on P2's body.
    //
    // Before tick:
    //   P1: head=(10,10), body=[(10,10), (9,10)]  moving right
    //   P2: head=(13,10), body=[(13,10), (12,10), (11,10), (10,10)] moving right
    //
    // After tick (both move right):
    //   P1 next head=(11,10), body=[(11,10), (10,10), (9,10)]
    //   P2 next head=(14,10), body=[(14,10), (13,10), (12,10), (11,10)]
    //
    // P1 death check:
    //   - (11,10) in P2 body? YES at index 3 → P1 dies
    // P2 death check:
    //   - (14,10) in P1 body? body=[(11,10), (10,10), (9,10)] → NO → P2 survives
    m.body_1 = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ];
    m.body_2 = [
      { x: 13, y: 10 },
      { x: 12, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 10 },
    ];
    m.direction_1 = { x: 1, y: 0 };
    m.direction_2 = { x: 1, y: 0 };
    m.status = "running";
    m.food = { x: 5, y: 5 };

    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: 1, y: 0 });
    m.tick();

    expect(m.status).toBe("finished");
    expect(m.result?.winner_player_id).toBe("p_2");
    expect(m.result?.is_draw).toBe(false);
  });
});

describe("MatchState — head-to-head collision", () => {
  it("should end in a draw when both heads enter the same cell", () => {
    const m = new MatchState("m_test");
    m.player_1_id = "p_1";
    m.player_2_id = "p_2";
    m.body_1 = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    m.body_2 = [
      { x: 12, y: 10 },
      { x: 13, y: 10 },
      { x: 14, y: 10 },
    ];
    m.direction_1 = { x: 1, y: 0 };
    m.direction_2 = { x: -1, y: 0 };
    m.status = "running";
    m.food = { x: 0, y: 0 };

    m.tryLockInput(1, { x: 1, y: 0 });
    m.tryLockInput(2, { x: -1, y: 0 });
    m.tick();

    expect(m.status).toBe("finished");
    expect(m.result?.is_draw).toBe(true);
    expect(m.result?.winner_player_id).toBeNull();
  });
});

describe("MatchState — same-tick double death", () => {
  it("should end in a draw when both players die on the same tick", () => {
    const m = createMatch();
    // P1 at x=5, P2 at x=39, both moving toward walls
    // P1 hits right wall (x=45) at tick 41
    // P2 hits left wall (x=0) at tick 40
    // So P2 dies at tick 40, match already finished
    // Need them to hit simultaneously
    // Set P1 at x=5, P2 at x=39:
    // P1 right wall: 45-5 = 40 ticks
    // P2 left wall: 0-39 = 39 ticks
    // Not simultaneous. Adjust: P1 at x=5, P2 at x=40
    // P1: 40 ticks, P2: 40 ticks — simultaneous!
    // But P2 spawn is at x=39 by config. Set manually.
    m.body_1 = [{ x: 5, y: 15 }, { x: 4, y: 15 }, { x: 3, y: 15 }];
    m.body_2 = [{ x: 40, y: 15 }, { x: 41, y: 15 }, { x: 42, y: 15 }];
    m.direction_1 = { x: 1, y: 0 };
    m.direction_2 = { x: -1, y: 0 };
    m.status = "running";
    m.food = { x: 5, y: 5 };

    // 40 ticks: P1 at x=5+40=45 (wall!), P2 at x=40-40=0 (wall!)
    runTicks(m, { x: 1, y: 0 }, { x: -1, y: 0 }, 40);
    expect(m.status).toBe("finished");
    expect(m.result?.is_draw).toBe(true);
    expect(m.result?.winner_player_id).toBeNull();
  });
});

describe("MatchState — input validation", () => {
  it("should reject reverse direction", () => {
    const m = createMatch();
    expect(m.tryLockInput(1, { x: -1, y: 0 })).toBe(false);
  });

  it("should accept perpendicular directions", () => {
    const m = createMatch();
    expect(m.tryLockInput(1, { x: 0, y: -1 })).toBe(true);
    expect(m.tryLockInput(1, { x: 0, y: 1 })).toBe(true);
  });

  it("should reject non-cardinal directions", () => {
    const m = createMatch();
    expect(m.tryLockInput(1, { x: 1, y: 1 })).toBe(false);
    expect(m.tryLockInput(1, { x: 0, y: 0 })).toBe(false);
  });

  it("should reject input when not running", () => {
    const m = new MatchState("m_test");
    m.initialize("p_1", "p_2");
    expect(m.tryLockInput(1, { x: 0, y: -1 })).toBe(false);
  });

  it("should not corrupt state with late/duplicated input", () => {
    const m = createMatch();
    const initialHead = { ...m.body_1[0] };
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tick();
    expect(m.body_1[0].y).toBe(initialHead.y - 1);
    expect(m.status).toBe("running");
  });

  it("should accept first queued direction and reject same direction on next tick", () => {
    const m = createMatch();
    // First: queue up, tick applies it
    m.tryLockInput(1, { x: 0, y: -1 });
    m.tick();
    // Now current direction is UP. Trying to queue UP again should be rejected
    // (current direction check)
    expect(m.tryLockInput(1, { x: 0, y: -1 })).toBe(false);
  });
});

describe("MatchState — state snapshot", () => {
  it("should report result after match ends", () => {
    const m = createMatch();
    runTicks(m, { x: 1, y: 0 }, { x: -1, y: 0 }, 40);
    const snap = m.toSnapshot();
    expect(snap.status).toBe("finished");
    expect(snap.result).not.toBeNull();
  });

  it("should include both players in snapshot", () => {
    const m = createMatch();
    const snap = m.toSnapshot();
    expect(snap.players).toHaveLength(2);
    expect(snap.players[0].player_id).toBe("p_1");
    expect(snap.players[1].player_id).toBe("p_2");
    expect(snap.food).toBeDefined();
    expect(snap.tick).toBe(0);
  });
});
