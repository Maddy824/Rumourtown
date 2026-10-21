import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, sentences } from './verifier.ts';
import { cases, facts, unknown, cast } from './data/dev-labels.ts';

test('splits sentences', () => assert.deepEqual(sentences('Hi there. Tom stole it! Really?'), ['Hi there.', 'Tom stole it!', 'Really?']));
for (const c of cases.filter(c => !c.hard)) {
  test(`dev: ${c.reply}`, async () => {
    const v = await verify(c.reply, facts, unknown, cast);
    assert.equal(v.epistemicFaithful, c.epistemic, JSON.stringify(v.sentences));
    if (c.world !== undefined) assert.equal(v.worldFaithful, c.world);
    if (c.calibrated !== undefined) assert.equal(v.calibrated, c.calibrated);
    if (c.provenance !== undefined) assert.equal(v.provenanceCorrect, c.provenance);
    if (c.abstained !== undefined) assert.equal(v.abstained, c.abstained);
  });
}
