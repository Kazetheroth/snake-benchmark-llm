import { DIRECTIONS, type Direction } from '../game/constants';

// ============================================================================
// Touch Input Handler - Swipe detection for mobile
// ============================================================================

export interface TouchConfig {
  minSwipeDistance: number;
  swipeThreshold: number; // Angle threshold in degrees
}

export class TouchInput {
  private _onDirectionChange: ((direction: Direction) => void) | null = null;
  private config: TouchConfig;

  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private isTouching: boolean = false;

  constructor(config: Partial<TouchConfig> = {}) {
    this.config = {
      minSwipeDistance: config.minSwipeDistance ?? 30,
      swipeThreshold: config.swipeThreshold ?? 45,
    };
  }

  attachToElement(element: HTMLElement): void {
    element.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    element.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    element.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  private handleTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isTouching = true;
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isTouching) return;
    event.preventDefault(); // Prevent scroll while swiping
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isTouching) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance >= this.config.minSwipeDistance) {
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      const direction = this.detectSwipeDirection(angle);
      if (direction) {
        this.emitDirection(direction);
      }
    }

    this.isTouching = false;
  }

  private detectSwipeDirection(angle: number): Direction | null {
    // Determine primary axis based on angle
    const absAngle = Math.abs(angle);

    if (absAngle <= this.config.swipeThreshold) {
      return DIRECTIONS.RIGHT;
    } else if (absAngle > 180 - this.config.swipeThreshold) {
      return DIRECTIONS.RIGHT;
    } else if (
      absAngle > 90 - this.config.swipeThreshold &&
      absAngle < 90 + this.config.swipeThreshold
    ) {
      return DIRECTIONS.DOWN;
    } else if (
      absAngle > 270 - this.config.swipeThreshold &&
      absAngle < 270 + this.config.swipeThreshold
    ) {
      return DIRECTIONS.UP;
    } else if (angle < 0 && angle > -180) {
      return DIRECTIONS.LEFT;
    } else {
      return DIRECTIONS.LEFT;
    }
  }

  // -------------------------------------------------------------------------
  // Event Callbacks
  // -------------------------------------------------------------------------

  onDirectionChange(callback: (direction: Direction) => void): void {
    this._onDirectionChange = callback;
  }

  private emitDirection(direction: Direction): void {
    if (this._onDirectionChange) {
      this._onDirectionChange(direction);
    }
  }
}
