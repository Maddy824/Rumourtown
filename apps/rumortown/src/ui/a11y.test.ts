import { describe, expect, it } from 'vitest';
import css from '../styles/app.css?raw';

function rgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}
function luminance(color: number[]): number {
  const linear = color.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!;
}
function contrast(a: number[], b: number[]): number {
  const light = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light[0]! + .05) / (light[1]! + .05);
}
const token = (name: string): number[] => {
  const hex = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!hex) throw new Error(`Missing colour token ${name}`);
  return rgb(hex);
};

describe('text contrast of the shipped theme', () => {
  it.each([['ink', 'paper'], ['ink', 'oat'], ['paper', 'table'],
    ['berry-deep', 'paper'], ['moss-deep', 'paper'], ['mustard-ink', 'paper']])(
    '%s text on %s meets 4.5:1', (foreground, background) => {
      expect(contrast(token(foreground!), token(background!))).toBeGreaterThanOrEqual(4.5);
    });
  it('keeps secondary ink readable on paper at its actual alpha', () => {
    const ink = token('ink'), paper = token('paper');
    const alpha = Number(css.match(/--ink-soft:\s*rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1]);
    expect(alpha).toBeGreaterThan(0);
    const blended = ink.map((c, i) => c * alpha + paper[i]! * (1 - alpha));
    expect(contrast(blended, paper)).toBeGreaterThanOrEqual(4.5);
  });
});
