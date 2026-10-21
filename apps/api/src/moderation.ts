import type { Unsupported } from './validate';

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/gu, ' ').trim();
}

// Deliberately small: fictional-cast and semantic moderation also live in the prompt.
const slurs = new Set(['nigger', 'nigga', 'faggot', 'kike', 'tranny']);
const sexual = new Set(['rape', 'raped', 'porn', 'pornography', 'sex', 'sexual', 'fuck', 'fucking', 'blowjob', 'nude', 'nudes', 'penis', 'vagina']);
export function blockedReason(text: string): Unsupported['unsupported'] | null {
  const words = text.split(/[^\p{L}\p{N}]+/u);
  if (words.some(word => slurs.has(word))) return 'protected-trait';
  if (words.some(word => sexual.has(word))) return 'sexual';
  return null;
}
export function isBlocked(text: string): boolean {
  return blockedReason(text) !== null;
}

export async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
