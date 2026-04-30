type RateLimitState = {
  remaining: number;
  resetAt: number;
  lastRequestAt: number;
};

export class RateLimitBudget {
  private state: RateLimitState;

  constructor(
    private readonly hourlyLimit = 1000,
    private readonly lowWatermark = 100
  ) {
    this.state = {
      remaining: hourlyLimit,
      resetAt: Date.now() + 60 * 60_000,
      lastRequestAt: 0
    };
  }

  canSpend(cost = 1) {
    this.refreshWindow();
    return this.state.remaining - cost >= 0;
  }

  spend(cost = 1) {
    this.refreshWindow();
    this.state.remaining = Math.max(0, this.state.remaining - cost);
    this.state.lastRequestAt = Date.now();
  }

  observe(headers: Headers) {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");

    if (remaining) {
      this.state.remaining = Number(remaining);
    }

    if (reset) {
      this.state.resetAt = Number(reset) * 1000;
    }
  }

  shouldDegrade() {
    this.refreshWindow();
    return this.state.remaining <= this.lowWatermark;
  }

  snapshot() {
    this.refreshWindow();
    return { ...this.state };
  }

  private refreshWindow() {
    if (Date.now() >= this.state.resetAt) {
      this.state = {
        remaining: this.hourlyLimit,
        resetAt: Date.now() + 60 * 60_000,
        lastRequestAt: this.state.lastRequestAt
      };
    }
  }
}

export const bagsRateLimit = new RateLimitBudget();
