export class TokenBucket {
  #capacity;
  #refillPerSec;
  #tokens;
  #last;

  constructor({ capacity, refillPerSec }) {
    if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('capacity must be positive');
    if (!Number.isFinite(refillPerSec) || refillPerSec <= 0) throw new Error('refillPerSec must be positive');
    this.#capacity = capacity;
    this.#refillPerSec = refillPerSec;
    this.#tokens = capacity;
    this.#last = Date.now();
  }

  #refill() {
    const now = Date.now();
    const elapsed = (now - this.#last) / 1000;
    this.#tokens = Math.min(this.#capacity, this.#tokens + elapsed * this.#refillPerSec);
    this.#last = now;
  }

  tryTake(cost = 1) {
    this.#refill();
    if (this.#tokens >= cost) {
      this.#tokens -= cost;
      return true;
    }
    return false;
  }

  async take(cost = 1) {
    while (!this.tryTake(cost)) {
      const deficit = cost - this.#tokens;
      const waitMs = Math.max(50, Math.ceil((deficit / this.#refillPerSec) * 1000));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  get tokens() {
    this.#refill();
    return this.#tokens;
  }
}

export const PRESETS = {
  github: { capacity: 30, refillPerSec: 1.3 },
  ado: { capacity: 20, refillPerSec: 0.5 },
  jira: { capacity: 10, refillPerSec: 0.3 },
};
