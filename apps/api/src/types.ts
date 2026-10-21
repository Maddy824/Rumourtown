import type { Claim, Unsupported } from './validate';

export type FailureReason = 'turnstile' | 'limit-visitor' | 'limit-global' | 'budget' | 'model' | 'invalid' | 'ledger' | 'alerts';
export interface Env {
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET: string;
  OPENROUTER_API_KEY: string;
  SIGNING_KEY_JWK: string;
  MODELS?: string;
  AI?: { run(model: string, inputs: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> };
  WORKERS_AI_MODEL?: string;
  /** Model for open stories (/rumor); quality matters most here. */
  WORKERS_AI_RUMOR_MODEL?: string;
  /** Model for conversation (/play). */
  WORKERS_AI_PLAY_MODEL?: string;
  AI_ENABLED?: string;
  USAGE_ALERT_URL?: string;
  DAILY_ALLOWANCE_USD?: string;
  LIFETIME_ALLOWANCE_USD?: string;
  PER_VISITOR_PER_HOUR?: string;
  /** Conversation has its own hourly allowance per visitor, separate from stories. */
  PLAY_PER_VISITOR_PER_HOUR?: string;
  GLOBAL_PER_MINUTE?: string;
  EDGE_VISITOR_LIMIT?: RateLimit;
  EDGE_TOTAL_LIMIT?: RateLimit;
  LEDGER: DurableObjectNamespace;
}
export interface Payload {
  claim: Claim;
  castVersion: string;
  issuedAt: number;
}
export interface SignedPayload extends Payload { sig: string }
export interface Refusal extends Unsupported {
  castVersion: string;
  issuedAt: number;
}
export type Fetcher = typeof fetch;

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
