type CBState = 'closed' | 'open' | 'half-open';

interface CBConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Number of consecutive successes in half-open state before closing */
  successThreshold: number;
  /** Milliseconds to wait in open state before testing again */
  timeoutMs: number;
}

const DEFAULTS: CBConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  timeoutMs: 60_000,
};

class CircuitBreaker {
  private state: CBState = 'closed';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;

  constructor(
    public readonly name: string,
    private cfg: CBConfig
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.cfg.timeoutMs) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new Error(`Circuit [${this.name}] is OPEN — backing off until cooldown expires`);
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private recordSuccess() {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.cfg.successThreshold) {
        this.state = 'closed';
        this.successes = 0;
      }
    }
  }

  private recordFailure() {
    this.failures++;
    this.openedAt = Date.now();
    if (this.failures >= this.cfg.failureThreshold) {
      this.state = 'open';
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      openedAt: this.state === 'open' ? new Date(this.openedAt).toISOString() : null,
    };
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = 0;
  }
}

// Module-level registry — survives across requests in a single process instance.
const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, config: Partial<CBConfig> = {}): CircuitBreaker {
  if (!registry.has(name)) {
    registry.set(name, new CircuitBreaker(name, { ...DEFAULTS, ...config }));
  }
  return registry.get(name)!;
}

export function getAllCircuitBreakerStatuses() {
  return Array.from(registry.values()).map((cb) => cb.getStatus());
}

export function resetCircuitBreaker(name: string) {
  registry.get(name)?.reset();
}
