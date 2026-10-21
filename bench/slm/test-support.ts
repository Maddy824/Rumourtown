/** Test-only oracle substitute. It never imports or exercises the real verifier. */
import type { FactRef, Verdict } from './verifier.ts';

export async function stubVerify(reply: string, facts: FactRef[]): Promise<Verdict> {
  const bad = reply.includes('UNSUPPORTED');
  const mentioned = facts.find(f => reply.includes(f.text));
  return { sentences: [{ text: reply, label: bad ? 'unknown-to-speaker' : mentioned ? 'supported' : 'chatter',
    ...(mentioned ? { factId: mentioned.id } : {}) }],
    epistemicFaithful: !bad, worldFaithful: !bad && (!mentioned || mentioned.trueInWorld),
    calibrated: !reply.includes('UNCALIBRATED'), provenanceCorrect: null,
    abstained: /have not heard|haven't heard|do not know/i.test(reply) };
}
