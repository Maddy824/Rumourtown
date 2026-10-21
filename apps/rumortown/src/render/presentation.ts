/** Options belong to the renderer, leaving the simulation contract untouched. */
import type { RenderOptions } from '../sim/types.js';
export interface PresentationOptions extends RenderOptions {
  phone?: boolean;
  spotlight?: readonly string[];
  onReady?: () => void;
  arriving?: boolean;
}
export function signVisible(kind: string, distance: number, phone: boolean): boolean {
  return !phone || (kind !== 'home' && distance <= 6);
}
