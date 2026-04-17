// ============================================================================
// Local Storage Helper - Persist high score
// ============================================================================

const STORAGE_KEY = 'neon-snake-high-score';

export class Storage {
  static getHighScore(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  static setHighScore(score: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, score.toString());
    } catch {
      // Storage might be unavailable (private browsing, etc.)
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }
}
