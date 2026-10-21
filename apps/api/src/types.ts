import type { Claim } from './validate';

export type FailureReason = 'turnstile' | 'limit-visitor' | 'limit-global' | 'budget' | 'model' | 'invalid' | 'ledger';
export interface Env {
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET: string;
  OPENROUTER_API_KEY: string;
  SIGNING_KEY_JWK: string;
  MODELS?: string;
  DAILY_ALLOWANCE_USD?: string;
  PER_VISITOR_PER_HOUR?: string;
  GLOBAL_PER_MINUTE?: string;
  LEDGER: DurableObjectNamespace;
}
export interface Payload {
  claim: Claim;
  castVersion: string;
  issuedAt: number;
}
export interface SignedPayload extends Payload { sig: string }
export type Fetcher = typeof fetch;

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
