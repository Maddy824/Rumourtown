/** Incremental cache work runs between frames, with a timer fallback for browsers without idle callbacks. */
export const IDLE_BUDGET_MS = 3;
/** Leave room for the next bounded painting step instead of starting it at the deadline. */
const STEP_HEADROOM_MS = 1;

export class IdleQueue {
  private jobs: Iterator<void>[] = [];
  private scheduled = false;

  add(job: Iterator<void>): void {
    this.jobs.push(job);
    this.schedule();
  }

  clear(): void {
    for (const job of this.jobs) job.return?.();
    this.jobs.length = 0;
  }

  private schedule(): void {
    if (this.scheduled || !this.jobs.length) return;
    this.scheduled = true;
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(this.run, { timeout: 100 });
    else window.setTimeout(() => this.run(), 0);
  }

  private run = (deadline?: IdleDeadline): void => {
    this.scheduled = false;
    const end = performance.now() + IDLE_BUDGET_MS;
    // Always make one step, including when an idle callback timed out.
    do {
      const job = this.jobs[0];
      if (!job) break;
      if (job.next().done) this.jobs.shift();
    } while (performance.now() < end - STEP_HEADROOM_MS && (!deadline || deadline.timeRemaining() > STEP_HEADROOM_MS));
    this.schedule();
  };
}
