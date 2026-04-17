import type { Position } from './types';
import { isFreeCell } from './collision';

// Generate a random position
function randomPosition(gridWidth: number, gridHeight: number): Position {
  return {
    x: Math.floor(Math.random() * gridWidth),
    y: Math.floor(Math.random() * gridHeight),
  };
}

// Spawn food on a free cell (not inside the snake)
export function spawnFood(snake: Position[], gridWidth: number, gridHeight: number): Position {
  let position: Position;

  // Keep generating until we find a free cell
  do {
    position = randomPosition(gridWidth, gridHeight);
  } while (!isFreeCell(position, snake, gridWidth, gridHeight));

  return position;
}
