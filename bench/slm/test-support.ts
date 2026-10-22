/** Test-only oracle substitute. It never imports or exercises the real verifier. */
import type { FactRef, Verdict } from './verifier.ts';

export async function stubVerify(reply: string, facts: FactRef[]): Promise<Verdict> {
  const bad = reply.includes('UNSUPPORTED');
  const mentioned = facts.find(f => reply.includes(f.text));
  return { sentences: [{ text: reply, label: bad ? 'unknown-to-speaker' : mentioned ? 'supported' : 'chatter',
    worldTruth: mentioned ? mentioned.trueInWorld ? 'true' : 'false' : 'unknown', ...(mentioned ? { factId: mentioned.id } : {}) }],
    epistemicFaithful: !bad, worldFaithful: !bad && (!mentioned || mentioned.trueInWorld),
    worldFaithfulLegacy: !bad && (!mentioned || mentioned.trueInWorld), calibratedLegacy: !reply.includes('UNCALIBRATED'),
    calibrated: mentioned ? !reply.includes('UNCALIBRATED') : null, provenanceCorrect: null,
    requiredSourceCoverage: null, exactDirectTeller: null, validAncestry: null,
    abstained: /have not heard|haven't heard|do not know/i.test(reply) };
}
