/**
 * Fixed-order elementary maths for cross-engine replay. Native transcendental Math functions
 * are implementation-approximated; even a one-bit difference changes a serialized event log.
 * These use IEEE-754 arithmetic with fixed series/Newton steps. Rendering can use native Math.
 */
const LN2 = 0.6931471805599453;
const LN2_HIGH = 0.6931471803691238;
const LN2_LOW = 1.9082149292705877e-10;

export function deterministicExp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;
  const k = Math.round(x * 1.4426950408889634);
  const r = (x - k * LN2_HIGH) - k * LN2_LOW;
  let term = 1, value = 1;
  for (let n = 1; n <= 20; n++) { term *= r / n; value += term; }
  // Scale the result itself, avoiding an overflowing 2^1024 intermediate.
  if (k >= 0) for (let n = 0; n < k; n++) value *= 2;
  else {
    // Enter the subnormal range only once, avoiding repeated rounding down to zero.
    let scale = 1, tail = 1;
    for (let n = 0; n > Math.max(k, -1022); n--) scale *= .5;
    for (let n = -1022; n > k; n--) tail *= .5;
    value = (value * tail) * scale;
  }
  return value;
}

export function deterministicLog(x: number): number {
  if (x < 0 || Number.isNaN(x)) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let m = x, k = 0;
  while (m >= 2) { m *= .5; k++; }
  while (m < 1) { m *= 2; k--; }
  const z = (m - 1) / (m + 1), square = z * z;
  let term = z, sum = 0;
  for (let n = 0; n < 25; n++) { sum += term / (2 * n + 1); term *= square; }
  return 2 * sum + k * LN2;
}

export function deterministicSqrt(x: number): number {
  if (x < 0 || Number.isNaN(x)) return NaN;
  if (x === 0 || x === Infinity) return x;
  let m = x, k = 0;
  while (m >= 4) { m *= .25; k++; }
  while (m < 1) { m *= 4; k--; }
  let value = (1 + m) * .5;
  for (let n = 0; n < 8; n++) value = .5 * (value + m / value);
  if (k >= 0) for (let n = 0; n < k; n++) value *= 2;
  else for (let n = 0; n > k; n--) value *= .5;
  return value;
}

/** Nonnegative bases and real powers, the domain used by familiarity and memory decay. */
export function deterministicPow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (Number.isNaN(base) || Number.isNaN(exponent)) return NaN;
  if (base === 1) return Number.isFinite(exponent) ? 1 : NaN;
  if (base === 0) return exponent > 0 ? 0 : exponent < 0 ? Infinity : NaN;
  return deterministicExp(exponent * deterministicLog(base));
}

export function deterministicHypot(a: number, b: number): number {
  const x = Math.abs(a), y = Math.abs(b);
  if (x === Infinity || y === Infinity) return Infinity;
  const scale = Math.max(x, y);
  if (scale === 0) return 0;
  const nx = x / scale, ny = y / scale;
  return scale * deterministicSqrt(nx * nx + ny * ny);
}
