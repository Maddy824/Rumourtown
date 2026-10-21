/** Fixed-step accounting in ticks. A frame may leave whole ticks of catch-up debt. */
export function advanceTicks(
  accumulated: number,
  elapsedSeconds: number,
  rate: number,
  maxSteps: number,
): { steps: number; remaining: number } {
  if (rate <= 0) return { steps: 0, remaining: accumulated };
  const ticks = accumulated + Math.max(0, elapsedSeconds) * rate;
  // Allow for floating-point rounding at an exact tick boundary.
  const steps = Math.min(Math.floor(ticks + 1e-9), maxSteps);
  return { steps, remaining: Math.max(0, ticks - steps) };
}
