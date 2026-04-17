// ============================================================================
// Overlays - Start, Pause, and Game Over screens
// ============================================================================

export interface OverlayConfig {
  container: HTMLElement;
  fontFamily: string;
}

export class Overlays {
  private config: OverlayConfig;
  private overlay: HTMLElement;
  private title: HTMLElement;
  private subtitle: HTMLElement;

  constructor(config: OverlayConfig) {
    this.config = config;

    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.8);
      z-index: 20;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    // Title element
    this.title = document.createElement('div');
    this.title.style.cssText = `
      font-family: ${this.config.fontFamily} monospace;
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 16px;
      text-align: center;
    `;

    // Subtitle element
    this.subtitle = document.createElement('div');
    this.subtitle.style.cssText = `
      font-family: ${this.config.fontFamily} monospace;
      font-size: 16px;
      color: #ffffff;
      text-align: center;
    `;

    this.overlay.appendChild(this.title);
    this.overlay.appendChild(this.subtitle);
    this.config.container.appendChild(this.overlay);
  }

  showStart(hint: 'start' | 'restart' = 'start'): void {
    this.title.textContent = 'NEON SNAKE';
    this.title.style.color = '#00ff88';
    if (hint === 'start') {
      this.subtitle.textContent = 'Press SPACE to Start';
    } else {
      this.subtitle.textContent = 'Press R to Restart or SPACE to Start';
    }
    this.title.style.pointerEvents = 'none';
    this.show();
  }

  showPaused(): void {
    this.title.textContent = 'PAUSED';
    this.title.style.color = '#9b00ff';
    this.subtitle.textContent = 'Press SPACE to resume';
    this.show();
  }

  showGameOver(score: number): void {
    this.title.textContent = 'GAME OVER';
    this.title.style.color = '#ff0080';
    this.subtitle.textContent = `Final Score: ${score}\nPress R to Restart or ESC to Quit`;
    this.show();
  }

  hide(): void {
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
  }

  private show(): void {
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'auto';
  }
}
