import { GRID_WIDTH, GRID_HEIGHT, DIRECTIONS, START_LENGTH } from './constants';
import type { Direction } from './constants';
import type { Position, Snake } from './types';
import { isWallCollision, isSelfCollision } from './collision';
import { spawnFood } from './food';

// ============================================================================
// Game Engine - Pure logic, no rendering or browser APIs
// ============================================================================

export interface EngineConfig {
  gridWidth: number;
  gridHeight: number;
  startLength: number;
}

export class GameEngine {
  private config: EngineConfig;
  private snake!: Snake;
  private direction!: Direction;
  private queuedDirection!: Direction | null;
  private food!: Position;
  private score!: number;
  private status!: 'waiting' | 'running' | 'paused' | 'game_over';

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = {
      gridWidth: config.gridWidth ?? GRID_WIDTH,
      gridHeight: config.gridHeight ?? GRID_HEIGHT,
      startLength: config.startLength ?? START_LENGTH,
    };

    this.reset();
  }

  // -------------------------------------------------------------------------
  // State Accessors
  // -------------------------------------------------------------------------

  getSnake(): Snake {
    return [...this.snake];
  }

  getDirection(): Direction {
    return { ...this.direction };
  }

  getFood(): Position {
    return { ...this.food };
  }

  getScore(): number {
    return this.score;
  }

  getStatus(): 'waiting' | 'running' | 'paused' | 'game_over' {
    return this.status;
  }

  getConfig(): Readonly<EngineConfig> {
    return { ...this.config };
  }

  // -------------------------------------------------------------------------
  // Control Methods
  // -------------------------------------------------------------------------

  reset(): void {
    // Initialize snake at starting position (matching pygame: [[5, 10], [4, 10], [3, 10]])
    const startX = 5;
    const startY = 10;
    this.snake = Array.from(
      { length: this.config.startLength },
      (_, i) => ({ x: startX - i, y: startY })
    );

    this.direction = { ...DIRECTIONS.RIGHT };
    this.queuedDirection = null;
    this.food = spawnFood(this.snake, this.config.gridWidth, this.config.gridHeight);
    this.score = 0;
    this.status = 'waiting';
  }

  resumeFromGameOver(): void {
    this.status = 'running';
  }

  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  resume(): void {
    if (this.status === 'paused' || this.status === 'waiting') {
      this.status = 'running';
    }
  }

  togglePause(): void {
    if (this.status === 'waiting') {
      this.status = 'running';
    } else if (this.status === 'running') {
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.status = 'running';
    }
  }

  // -------------------------------------------------------------------------
  // Input Handling
  // -------------------------------------------------------------------------

  setDirection(direction: Direction): boolean {
    // Reject if game is not running or waiting
    if (this.status !== 'running' && this.status !== 'waiting') {
      return false;
    }

    // Reject reverse direction
    if (
      direction.x === -this.direction.x &&
      direction.y === -this.direction.y
    ) {
      return false;
    }

    // Reject if same as current direction
    if (direction.x === this.direction.x && direction.y === this.direction.y) {
      return false;
    }

    // Queue the direction change (applied on next tick)
    this.queuedDirection = { ...direction };
    return true;
  }

  // -------------------------------------------------------------------------
  // Game Tick
  // -------------------------------------------------------------------------

  tick(): void {
    if (this.status !== 'running') {
      return;
    }

    // Apply queued direction
    if (this.queuedDirection !== null) {
      this.direction = this.queuedDirection;
      this.queuedDirection = null;
    }

    // Calculate new head position
    const head = this.snake[0];
    const newHead: Position = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    // Check wall collision
    if (isWallCollision(newHead, this.config.gridWidth, this.config.gridHeight)) {
      this.status = 'game_over';
      return;
    }

    // Check self collision
    if (isSelfCollision(newHead, this.snake)) {
      this.status = 'game_over';
      return;
    }

    // Move snake: add new head
    this.snake.unshift(newHead);

    // Check food consumption
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      // Ate food: grow (don't pop tail), increase score, spawn new food
      this.score++;
      this.food = spawnFood(this.snake, this.config.gridWidth, this.config.gridHeight);
    } else {
      // No food: remove tail to maintain length
      this.snake.pop();
    }
  }
}
