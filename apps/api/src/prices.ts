import { record } from './types';

export const MAX_TOKENS = 120;
export const DEFAULT_MODELS = 'liquid/lfm-2.5-2.6b:free,google/gemini-2.5-flash-lite';
export const prices: Readonly<Record<string, { input: number; output: number }>> = {
  'google/gemini-2.5-flash-lite': { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
};
export function price(model: string): { input: number; output: number } {
  if (model.endsWith(':free')) return { input: 0, output: 0 };
  const found = prices[model];
  if (!found) throw new Error('unpriced-model');
  return found;
}
export function modelList(config = DEFAULT_MODELS): string[] {
  const models = [...new Set(config.split(',').map(s => s.trim()).filter(Boolean))];
  if (models.length === 0) throw new Error('models');
  models.forEach(price);
  return models.sort((a, b) => Number(!a.endsWith(':free')) - Number(!b.endsWith(':free')));
}
export function estimatePromptTokens(body: unknown): number {
  // A deliberately conservative byte bound, including the schema and chat framing.
  // Supported tokenizers cannot need more tokens than UTF-8 bytes; 1,200 covers framing.
  return new TextEncoder().encode(JSON.stringify(body)).byteLength + 1_200;
}
export function reservationCost(models: string[], promptTokens: number): number {
  return Math.max(...models.map(model => {
    const p = price(model);
    return promptTokens * p.input + MAX_TOKENS * p.output;
  }));
}
export function actualCost(result: unknown, models: string[], reserved: number): number {
  if (!record(result) || typeof result.model !== 'string' || !models.includes(result.model) || !record(result.usage)) return reserved;
  const { prompt_tokens: input, completion_tokens: output } = result.usage;
  if (typeof input !== 'number' || typeof output !== 'number' || !Number.isSafeInteger(input) || !Number.isSafeInteger(output) || input < 0 || output < 0) return reserved;
  const p = price(result.model);
  const cost = input * p.input + output * p.output;
  // The ledger rejects an exceeded reservation and leaves the entire hold in place.
  const billed = result.usage.cost;
  if (typeof billed === 'number' && Number.isFinite(billed) && billed >= 0) return Math.max(cost, billed);
  return cost;
}

/** OpenRouter caps are dollars per million tokens; decline higher-priced routes. */
export function providerPriceCap(models: string[]): { prompt: number; completion: number; request: number } {
  return { prompt: Math.max(...models.map(m => price(m).input * 1_000_000)),
    completion: Math.max(...models.map(m => price(m).output * 1_000_000)), request: 0 };
}
