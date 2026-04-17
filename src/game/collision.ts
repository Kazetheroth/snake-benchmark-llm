import type { Position } from './types';

// Check if position is outside grid bounds
export function isWallCollision(pos: Position, gridWidth: number, gridHeight: number): boolean {
  return (
    pos.x < 0 ||
    pos.x >= gridWidth ||
    pos.y < 0 ||
    pos.y >= gridHeight
  );
}

// Check if position is occupied by snake body
export function isSelfCollision(pos: Position, snake: Position[]): boolean {
  return snake.some((segment) => segment.x === pos.x && segment.y === pos.y);
}

// Check if a position is free (not wall, not snake)
export function isFreeCell(pos: Position, snake: Position[], gridWidth: number, gridHeight: number): boolean {
  return !isWallCollision(pos, gridWidth, gridHeight) && !isSelfCollision(pos, snake);
}
