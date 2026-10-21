/**
 * Share links: ShareState as JSON, then UTF-8, then base64url, carried in the URL hash.
 * Decoding is defensive: size-capped, shape-checked, and anything odd yields null.
 */
import { MINUTES_PER_DAY, type Intervention, type ShareState } from '../sim/types.js';

/** Caps keep a hostile link from making the page do unbounded work. */
const MAX_ENCODED = 16_000;
const MAX_INTERVENTIONS = 400;
const MAX_TICK = 1_000_000;

function encode(state: ShareState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Keep the largest suffix of recent whispers that the decoder can accept. */
export function encodeShare(state: ShareState): string {
  const recent = [...state.interventions].sort((a, b) => a.tick - b.tick).slice(-MAX_INTERVENTIONS);
  const valid = validate({ ...state, interventions: recent });
  if (!valid) throw new Error('This village cannot be shared.');
  const suffix = (count: number): string => encode({
    ...valid,
    interventions: count === 0 ? [] : valid.interventions.slice(-count),
  });
  let low = 0;
  let high = valid.interventions.length;
  while (low < high) {
    const count = Math.ceil((low + high) / 2);
    if (suffix(count).length <= MAX_ENCODED) low = count;
    else high = count - 1;
  }
  const encoded = suffix(low);
  if (!decodeShare(encoded)) throw new Error('This village cannot be shared.');
  return encoded;
}

export function decodeShare(encoded: string): ShareState | null {
  if (!encoded || encoded.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return validate(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function validate(raw: unknown): ShareState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 && r.v !== 2) return null;
  if (r.v === 2 && (typeof r.start !== 'number' || !Number.isInteger(r.start) || r.start < 0 || r.start >= MINUTES_PER_DAY)) return null;
  const seed = r.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  if (typeof r.cast !== 'string' || r.cast.length > 32) return null;
  if (!Array.isArray(r.interventions) || r.interventions.length > MAX_INTERVENTIONS) return null;
  const interventions: Intervention[] = [];
  for (const item of r.interventions as unknown[]) {
    if (!item || typeof item !== 'object') return null;
    const i = item as Record<string, unknown>;
    const { tick, listener, claimId } = i;
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0 || tick > MAX_TICK) return null;
    if (typeof listener !== 'string' || !ID.test(listener)) return null;
    if (typeof claimId !== 'string' || !(ID.test(claimId) || /^written_[A-Za-z0-9_-]{1,1024}$/.test(claimId) || /^story_[A-Za-z0-9_-]{1,2048}$/.test(claimId))) return null;
    interventions.push({ tick, listener, claimId });
  }
  interventions.sort((a, b) => a.tick - b.tick);
  return r.v === 2 ? { v: 2, start: r.start as number, seed, cast: r.cast, interventions } : { v: 1, seed, cast: r.cast, interventions };
}

export function readShareFromLocation(): { state: ShareState | null; present: boolean } {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { state: null, present: false };
  return { state: decodeShare(hash), present: true };
}

export function shareUrl(state: ShareState): string {
  const url = new URL(window.location.href);
  url.hash = encodeShare(state);
  return url.toString();
}

/** Keeps the address bar in step with the run, without adding history entries. */
export function writeShareToLocation(state: ShareState): string {
  let encoded: string;
  try {
    encoded = encodeShare(state);
  } catch {
    // Keep an unsupported state out of the address bar; the share panel explains it on copy.
    return window.location.hash.replace(/^#/, '');
  }
  if (window.location.hash.replace(/^#/, '') !== encoded) {
    window.history.replaceState(window.history.state, '', `#${encoded}`);
  }
  return encoded;
}
