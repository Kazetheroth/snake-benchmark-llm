import { COLORS } from './theme';

// ============================================================================
// Canvas Renderer - Pure rendering, no game logic
// ============================================================================

export interface RenderConfig {
  blockSize: number;
  showGrid: boolean;
  highDpi: boolean;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = {
      blockSize: config.blockSize ?? 20,
      showGrid: config.showGrid ?? true,
      highDpi: config.highDpi ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // Render Methods
  // -------------------------------------------------------------------------

  clear(gridWidth: number, gridHeight: number): void {
    const width = gridWidth * this.config.blockSize;
    const height = gridHeight * this.config.blockSize;
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawGrid(gridWidth: number, gridHeight: number): void {
    if (!this.config.showGrid) return;

    const ctx = this.ctx;
    const blockSize = this.config.blockSize;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * blockSize, 0);
      ctx.lineTo(x * blockSize, gridHeight * blockSize);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * blockSize);
      ctx.lineTo(gridWidth * blockSize, y * blockSize);
      ctx.stroke();
    }
  }

  drawSnake(snake: { x: number; y: number }[]): void {
    const ctx = this.ctx;
    const blockSize = this.config.blockSize;

    snake.forEach((segment, index) => {
      const x = segment.x * blockSize;
      const y = segment.y * blockSize;

      // Glow effect
      ctx.shadowColor = index === 0 ? COLORS.foodGlow : 'transparent';
      ctx.shadowBlur = index === 0 ? 10 : 0;

      // Fill color
      ctx.fillStyle = index === 0 ? COLORS.snakeHead : COLORS.snakeBody;

      // Draw rounded rectangle
      this.drawRoundedRect(ctx, x + 1, y + 1, blockSize - 2, blockSize - 2, 4);
    });

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  drawFood(food: { x: number; y: number }): void {
    const ctx = this.ctx;
    const blockSize = this.config.blockSize;
    const x = food.x * blockSize;
    const y = food.y * blockSize;

    // Glow
    ctx.shadowColor = COLORS.foodGlow;
    ctx.shadowBlur = 12;

    // Food rectangle
    ctx.fillStyle = COLORS.food;
    this.drawRoundedRect(ctx, x + 2, y + 2, blockSize - 4, blockSize - 4, 6);

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  resize(width: number, height: number, gridWidth?: number, gridHeight?: number): void {
    // Handle high DPI displays
    const dpr = this.config.highDpi ? window.devicePixelRatio || 1 : 1;

    // If grid dimensions are provided, calculate block size to fit the container
    if (gridWidth && gridHeight) {
      const availableWidth = width;
      const availableHeight = height;
      const blockSizeByWidth = Math.floor(availableWidth / gridWidth);
      const blockSizeByHeight = Math.floor(availableHeight / gridHeight);
      this.config.blockSize = Math.min(blockSizeByWidth, blockSizeByHeight);
    }

    // Set internal canvas size with DPI scaling (after blockSize is calculated)
    const internalWidth = (gridWidth ?? 0) * this.config.blockSize;
    const internalHeight = (gridHeight ?? 0) * this.config.blockSize;
    this.canvas.width = Math.floor(internalWidth * dpr);
    this.canvas.height = Math.floor(internalHeight * dpr);

    // Reset transform and apply new scale
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }
}
