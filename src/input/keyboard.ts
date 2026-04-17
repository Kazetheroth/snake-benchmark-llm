import { DIRECTIONS, type Direction } from '../game/constants';

// ============================================================================
// Keyboard Input Handler
// ============================================================================

export class KeyboardInput {
  private _onDirectionChange: ((direction: Direction) => void) | null = null;
  private _onPauseToggle: (() => void) | null = null;
  private _onRestart: (() => void) | null = null;
  private _onQuit: (() => void) | null = null;

  constructor() {
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    let handled = false;

    // Direction keys
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.emitDirection(DIRECTIONS.UP);
        handled = true;
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        this.emitDirection(DIRECTIONS.DOWN);
        handled = true;
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.emitDirection(DIRECTIONS.LEFT);
        handled = true;
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        this.emitDirection(DIRECTIONS.RIGHT);
        handled = true;
        break;

      case ' ':
        // Space bar - pause toggle
        if (this._onPauseToggle) {
          this._onPauseToggle();
          handled = true;
        }
        break;

      case 'r':
      case 'R':
        // Restart
        if (this._onRestart) {
          this._onRestart();
          handled = true;
        }
        break;

      case 'Escape':
        // Quit
        if (this._onQuit) {
          this._onQuit();
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // -------------------------------------------------------------------------
  // Event Callbacks
  // -------------------------------------------------------------------------

  onDirectionChange(callback: (direction: Direction) => void): void {
    this._onDirectionChange = callback;
  }

  onPauseToggle(callback: () => void): void {
    this._onPauseToggle = callback;
  }

  onRestart(callback: () => void): void {
    this._onRestart = callback;
  }

  onQuit(callback: () => void): void {
    this._onQuit = callback;
  }

  private emitDirection(direction: Direction): void {
    if (this._onDirectionChange) {
      this._onDirectionChange(direction);
    }
  }
}
