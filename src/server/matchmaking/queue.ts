/**
 * Quick-match queue — FIFO pairing of anonymous players.
 *
 * When two players enqueue, the pair is removed and returned so the
 * caller can create a match room for them.
 */

import { Session } from "../session/manager";

export class MatchQueue {
  private queue: Session[] = [];

  enqueue(session: Session): Session | null {
    this.queue.push(session);
    if (this.queue.length >= 2) {
      const partner = this.queue.shift()!;
      return partner;
    }
    return null;
  }

  remove(session: Session): boolean {
    const idx = this.queue.indexOf(session);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  get size(): number {
    return this.queue.length;
  }
}
