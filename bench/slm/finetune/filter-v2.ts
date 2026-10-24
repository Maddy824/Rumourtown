/** CPU-only target decisions, for frozen-slot rebuilding and checker-version comparison. */
import { factsFor, oracleOptions, type Probe, type Scenario } from '../types.ts';
import { verify, type VerifierVersion } from '../verifier.ts';
import { passes } from '../strategies.ts';
import { surfaceBehaviour } from '../run.ts';
import { injectionDecision } from './injection-filter.ts';

export async function scoreTarget(reply: string, s: Scenario, p: Probe, verifierVersion: VerifierVersion = 'v2') {
  const verdict = await verify(reply, factsFor(s, p), s.unknownWorldFacts, s.castNames, { ...oracleOptions(s, p), verifierVersion });
  const accepted = !!reply.trim() && passes(verdict);
  return { accepted, onAct: accepted && surfaceBehaviour(p, { reply, verdict }), faithful: verdict.epistemicFaithful,
    injection: injectionDecision(reply, p) };
}
