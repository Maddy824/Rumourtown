import type { Verdict } from '../verifier.ts';

export const LABELS = ['supported', 'contradicts', 'unknown-to-speaker', 'chatter', 'out-of-character'] as const;
export type Label = typeof LABELS[number];
export const ACTS = ['yes', 'partly', 'no'] as const;
export const CONFIDENCE = ['yes', 'no', 'not applicable'] as const;
export const REPLY_LABELS = ['faithful', 'unfaithful', 'out-of-character'] as const;
export type ReplyLabel = typeof REPLY_LABELS[number];

export interface Item {
  id: string;
  speaker: { name: string; role: string; voice: string };
  beliefs: { text: string; band: string; sources: string[] }[];
  distractors: { speaker: string; text: string }[];
  utterance: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  reply: string;
}
export interface ItemFile { version: 1; sampleId: string; items: Item[] }
export interface KeyItem {
  id: string;
  rowKey: string;
  source: string;
  model: string;
  actualModel: string;
  strategy: string;
  axis: string;
  split: string;
  scenarioId: string;
  probeId: string;
  oracle: Verdict;
  oracleReply: ReplyLabel;
  behaviourMatched: boolean | null;
  gold: unknown;
  worldTruth: { beliefs: { text: string; trueInWorld: boolean }[]; unknownWorldFacts: string[] };
  sentences: string[];
}
export interface KeyFile {
  version: 1;
  sampleId: string;
  seed: string;
  requested: number;
  population: number;
  inputs: { path: string; sha256: string }[];
  strata: { model: string; axis: string; verdict: ReplyLabel; population: number; sampled: number }[];
  items: KeyItem[];
}
export interface Annotation {
  id: string;
  sentences: { text: string; label: Label | null }[];
  doesAsked: typeof ACTS[number] | null;
  confidence: typeof CONFIDENCE[number] | null;
}
export interface LabelFile {
  version: 1;
  sampleId: string;
  annotatorId: string;
  annotations: Annotation[];
}

export function replyLabel(labels: readonly Label[]): ReplyLabel {
  if (labels.includes('out-of-character')) return 'out-of-character';
  return labels.some(l => l === 'contradicts' || l === 'unknown-to-speaker') ? 'unfaithful' : 'faithful';
}

/** Strict, reproducible options; all flags take a value. */
export function options(args: string[], allowed: readonly string[]): { flags: Map<string, string>; paths: string[] } {
  const flags = new Map<string, string>(), paths: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i]!;
    if (!token.startsWith('--')) { paths.push(token); continue; }
    const name = token.slice(2), value = args[++i];
    if (!allowed.includes(name) || flags.has(name) || !value || value.startsWith('--')) throw new Error(`Invalid or duplicate option: ${token}`);
    flags.set(name, value);
  }
  return { flags, paths };
}
