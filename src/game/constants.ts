// Game constants matching the pygame baseline

export const GRID_WIDTH = 45;   // 900px / 20px
export const GRID_HEIGHT = 30;  // 600px / 20px
export const BLOCK_SIZE = 20;   // pixels per cell
export const FPS = 12;          // game tick rate
export const START_LENGTH = 3;  // initial snake length

// Direction vectors
export type Direction = { x: number; y: number };

export const DIRECTIONS = {
  UP: { x: 0, y: -1 } as const,
  DOWN: { x: 0, y: 1 } as const,
  LEFT: { x: -1, y: 0 } as const,
  RIGHT: { x: 1, y: 0 } as const,
};

// Game states
export type GameState = 'running' | 'paused' | 'game_over';
