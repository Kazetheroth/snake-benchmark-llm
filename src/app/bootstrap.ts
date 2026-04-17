// ============================================================================
// Bootstrap - Application entry point
// ============================================================================

import { GameEngine } from '../game/engine';
import { CanvasRenderer } from '../render/canvasRenderer';
import { KeyboardInput } from '../input/keyboard';
import { TouchInput } from '../input/touch';
import { Overlays } from '../ui/overlays';
import { Storage } from './storage';
import { FPS } from '../game/constants';
import type { Direction } from '../game/constants';

const CANVAS_ID = 'game-canvas';
const CONTAINER_ID = 'game-container';

interface GameState {
  engine: GameEngine;
  renderer: CanvasRenderer;
  keyboard: KeyboardInput;
  touch: TouchInput;
  overlays: Overlays;
  highScore: number;
  lastTick: number;
  tickInterval: number;
  isRunning: boolean;
}

class SnakeGame {
  private state!: GameState;
  private container: HTMLElement;
  private scoreElement: HTMLElement;
  private highScoreElement: HTMLElement;

  constructor() {
    this.container = document.getElementById(CONTAINER_ID)!;
    this.scoreElement = document.getElementById('score')!;
    this.highScoreElement = document.getElementById('high-score')!;
    this.init();
  }

  private init(): void {
    const engine = new GameEngine();

    const canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas, {
      blockSize: 20,
      showGrid: true,
      highDpi: true,
    });

    const keyboard = new KeyboardInput();
    const touch = new TouchInput();
    touch.attachToElement(canvas);

    const overlays = new Overlays({ container: this.container, fontFamily: '' });

    let highScore = Storage.getHighScore();

    this.state = {
      engine,
      renderer,
      keyboard,
      touch,
      overlays,
      highScore,
      lastTick: performance.now(),
      tickInterval: 1000 / FPS,
      isRunning: false,
    };

    this.bindInputs();

    window.addEventListener('resize', () => this.handleResize());

    this.handleResize();

    overlays.showStart();

    this.start();
  }

  private bindInputs(): void {
    const { keyboard, touch, engine } = this.state;

    const handleDirection = (direction: Direction) => {
      if (engine.getStatus() === 'running' || engine.getStatus() === 'waiting') {
        engine.setDirection(direction);
      }
    };

    keyboard.onDirectionChange(handleDirection);
    touch.onDirectionChange(handleDirection);

    keyboard.onPauseToggle(() => {
      const status = engine.getStatus();
      if (status === 'running' || status === 'paused' || status === 'waiting') {
        engine.togglePause();
        this.updateOverlays();
      }
    });

    keyboard.onRestart(() => {
      if (engine.getStatus() === 'game_over') {
        this.restart();
      }
    });

    keyboard.onQuit(() => {
      const status = engine.getStatus();
      if (status === 'running' || status === 'paused') {
        engine.pause();
        this.updateOverlays();
      }
    });
  }

  private start(): void {
    this.state.isRunning = true;
    this.state.lastTick = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private gameLoop(currentTime: number): void {
    if (!this.state.isRunning) return;

    const deltaTime = currentTime - this.state.lastTick;

    if (deltaTime >= this.state.tickInterval) {
      this.state.lastTick = currentTime - (deltaTime % this.state.tickInterval);
      this.tick();
    }

    this.render();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private tick(): void {
    const { engine } = this.state;

    if (engine.getStatus() === 'running') {
      engine.tick();

      if (engine.getStatus() === 'game_over') {
        const score = engine.getScore();
        if (score > this.state.highScore) {
          this.state.highScore = score;
          Storage.setHighScore(score);
        }
        this.updateOverlays();
      }
    }
  }

  private render(): void {
    const { engine, renderer } = this.state;
    const { gridWidth, gridHeight } = engine.getConfig();

    renderer.clear(gridWidth, gridHeight);
    renderer.drawGrid(gridWidth, gridHeight);

    renderer.drawSnake(engine.getSnake());
    renderer.drawFood(engine.getFood());

    this.scoreElement.textContent = `SCORE: ${engine.getScore()}`;
    this.highScoreElement.textContent = `HIGH: ${this.state.highScore}`;
  }

  private updateOverlays(): void {
    const { engine, overlays } = this.state;
    const status = engine.getStatus();

    if (status === 'waiting') {
      overlays.showStart();
    } else if (status === 'paused') {
      overlays.showPaused();
    } else if (status === 'game_over') {
      overlays.showGameOver(engine.getScore());
    } else {
      // Show restart hint if game just ended and is waiting for restart
      overlays.hide();
    }
  }

  private restart(): void {
    const { engine, overlays } = this.state;
    engine.reset();
    overlays.showStart('restart');
  }

  private handleResize(): void {
    const { renderer, engine } = this.state;
    const container = this.container;
    const { gridWidth, gridHeight } = engine.getConfig();

    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.resize(width, height, gridWidth, gridHeight);
  }
}

function bootstrap(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SnakeGame());
  } else {
    new SnakeGame();
  }
}

export { bootstrap };
bootstrap();
