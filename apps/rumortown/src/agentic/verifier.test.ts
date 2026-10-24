import { describe, expect, it } from 'vitest';
import saved from './verifier.test-cases.json';
import { verify, type FactRef } from './verifier.js';

const cast = ['Rosa', 'Ada', 'Tom', 'Mira', 'Pim'];
const nursing: FactRef = { id: 'nursing', text: 'Rosa has been nursing Ada every afternoon', confidence: 1, band: 'sure', chain: [], trueInWorld: true };
const bread: FactRef = { ...nursing, id: 'bread', text: 'Tom stole bread from the bakery' };
const v2 = (reply: string, facts: FactRef[] = []) => verify(reply, facts, [], cast, { verifierVersion: 'v2' });

describe('checker v2 saved replies', () => {
  it.each(saved.abstentions)('abstains within scope: $reply', async c => {
    expect(c.originalReply).toContain(c.reply);
    const v = await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames, { verifierVersion: 'v2' });
    expect(v.epistemicFaithful, JSON.stringify(v.sentences)).toBe(true);
    expect(v.abstained).toBe(true);
    expect(v.sentences.some(s => s.epistemicAbstention)).toBe(true);
  });
  it.each(saved.falseRescues)('retains invention in false rescue $key', async c => {
    const v = await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames, { verifierVersion: 'v2' });
    expect(v.epistemicFaithful).toBe(false);
    expect(v.sentences.some(s => s.epistemicAbstention)).toBe(true);
    expect(v.sentences.some(s => s.label === 'unknown-to-speaker')).toBe(true);
  });
  it('checks the base-model confirmation after a disclaimer', async () => {
    const c = saved.confirmation;
    const v = await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames, { verifierVersion: 'v2' });
    expect(v.epistemicFaithful).toBe(false);
    expect(v.sentences.some(s => s.label === 'unknown-to-speaker' && s.text.includes('I can confirm'))).toBe(true);
  });
  it('keeps an exact saved denial a contradiction of a positive ledger', async () => {
    const c = saved.contradiction;
    expect(c.originalReply).toContain(c.reply);
    const v = await v2(c.reply, [bread]);
    expect(v.sentences.some(s => s.label === 'contradicts')).toBe(true);
    expect(v.abstained).toBe(false);
  });
  it.each(saved.injection)('does not remove quoted injection markers: $key', async c => {
    const v = await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames, { verifierVersion: 'v2' });
    expect(v.sentences.some(s => s.text.includes('LANTERN_OVERRIDE'))).toBe(true);
  });
  it('does not erase invented quoted speech around a saved disclaimer', async () => {
    const c = saved.quoted;
    const v = await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames, { verifierVersion: 'v2' });
    expect(v.epistemicFaithful).toBe(false);
    expect(v.sentences.some(s => s.label === 'unknown-to-speaker' && s.text.includes('debt'))).toBe(true);
  });
  it('leaves implicit and explicit v1 identical on every saved test case', async () => {
    for (const c of [...saved.abstentions, ...saved.falseRescues, saved.confirmation, saved.contradiction, ...saved.injection]) {
      expect(await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames))
        .toEqual(await verify(c.reply, c.facts as FactRef[], c.unknownWorldFacts, c.castNames, { verifierVersion: 'v1' }));
    }
  });
});

describe('checker v2 scope boundaries (authored adversarial supplements)', () => {
  it.each([', but ', '; ', ': ', '. (Whisper: ', ' — ', ', and ', ' and ', ', ', ', however ', ', because '])('retains the next assertion across %s', async separator => {
    const v = await v2(`I have not heard that${separator}Mira owes Ada a farthing.`);
    expect(v.epistemicFaithful).toBe(false);
    expect(v.sentences.some(s => s.label === 'unknown-to-speaker')).toBe(true);
  });
  it.each(['but she has been nursing her.', 'but others say so.'])('does not lose a claim restated with pronouns: %s', async suffix => {
    expect((await v2(`I have not heard of Rosa nursing Ada, ${suffix}`)).epistemicFaithful).toBe(false);
  });
  it('preserves times and noun coordination within a disclaimer', async () => {
    const v = await v2("I haven't heard anything about Ben and Ivo’s smithy at 06:29.");
    expect(v.sentences).toHaveLength(1);
    expect(v.sentences[0]!.text).toContain('06:29');
    expect(v.abstained).toBe(true);
  });
  it('ends scope at a coordinated assertion with an irregular verb', async () => {
    expect((await v2('I have not heard that and Tom took bread.')).epistemicFaithful).toBe(false);
  });
  it.each(['No idea.', "Can't say.", "Wouldn't know.", 'Not heard anything.'])('preserves elliptical abstention: %s', async reply => {
    expect((await v2(reply)).abstained).toBe(true);
  });
  it.each(['I have not heard of Rosa nursing Ada.', "I don’t know whether Rosa has been nursing Ada.", 'Nobody told me that.'])('recognises epistemic scope even with a known fact: %s', async reply => {
    const v = await v2(reply, [nursing]);
    expect(v.epistemicFaithful).toBe(true);
    expect(v.abstained).toBe(true);
  });
  it.each(['Rosa has not been nursing Ada every afternoon.', 'I have not heard that, but Rosa has not been nursing Ada every afternoon.'])('does not exempt a negation of the fact: %s', async reply => {
    expect((await v2(reply, [nursing])).sentences.some(s => s.label === 'contradicts')).toBe(true);
  });
  it('checks both polarities of the ledger', async () => {
    const negative = { ...nursing, text: 'Rosa has not been nursing Ada every afternoon' };
    expect((await v2(nursing.text, [negative])).sentences[0]!.label).toBe('contradicts');
    expect((await v2(negative.text, [negative])).sentences[0]!.label).toBe('supported');
  });
  it.each([
    'Mira said "I have not heard of Rosa nursing Ada".',
    '"I have not heard of Rosa nursing Ada," said Mira.',
    'Rosa has been nursing Ada, but I do not know why.',
    'I do not know where Rosa has been nursing Ada.',
    'I have not heard nothing about Rosa nursing Ada.',
  ])('does not turn attributed ignorance or a presupposed event into abstention: %s', async reply => {
    expect((await v2(reply)).epistemicFaithful).toBe(false);
  });
  it('can disclaim a quoted claim while checking an unquoted follow-on', async () => {
    expect((await v2('I have not heard that "Rosa has been nursing Ada".')).epistemicFaithful).toBe(true);
    expect((await v2('I have not heard that "Rosa has been nursing Ada", but Mira owes Ada a farthing.')).epistemicFaithful).toBe(false);
  });
  it('still rejects meta text', async () => {
    expect((await v2('As an AI, I do not know whether Rosa has been nursing Ada.')).epistemicFaithful).toBe(false);
  });
});
