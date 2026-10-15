export const PROGRESS_POLL_INTERVAL_MS = 15_000;

export interface PollingClock {
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
}

/** Serial, unbounded polling. Refresh supersedes pending reads, including servers
 * that ignore AbortSignal. Pause/resume also fences those late responses. */
export class ProgressivePoller<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | undefined;
  private generation = 0;
  private paused = false;
  private disposed = false;
  private continuePolling = true;

  constructor(private options: {
    fetch: (signal: AbortSignal) => Promise<T>;
    accept: (value: T) => boolean;
    onError: (error: unknown) => void;
    clock?: PollingClock;
  }) {}

  private get clock(): PollingClock {
    // Window timers require their native receiver in browsers. Do not expose
    // them as methods of a plain clock object (Node accepts that; browsers don't).
    return this.options.clock ?? {
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: (timer) => clearTimeout(timer),
    };
  }

  private invalidate() {
    this.generation += 1;
    this.controller?.abort();
    this.controller = undefined;
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }

  refresh = async (): Promise<void> => {
    if (this.disposed || this.paused) return;
    this.invalidate();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const value = await this.options.fetch(controller.signal);
      if (this.disposed || generation !== this.generation) return;
      this.continuePolling = this.options.accept(value);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.options.onError(error);
      // A connection failure must not exhaust retries or certify completion.
      this.continuePolling = true;
    } finally {
      if (!this.disposed && !this.paused && generation === this.generation) {
        this.controller = undefined;
        if (this.continuePolling) {
          this.timer = this.clock.setTimeout(() => { void this.refresh(); }, PROGRESS_POLL_INTERVAL_MS);
        }
      }
    }
  };

  pause = () => { this.paused = true; this.invalidate(); };
  resume = () => { this.paused = false; void this.refresh(); };
  dispose = () => { this.disposed = true; this.invalidate(); };
}
