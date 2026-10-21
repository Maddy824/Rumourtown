import { describe, expect, it } from 'vitest';
import { guardReply, factRefs } from './guard.js';

const refs = factRefs({ beliefs: [{ claimId: 'f1', text: 'Tom stole bread from the bakery', confidence: 0.72, chain: ['Mira told Rosa at 10:30'], independentSources: 1 }] });
const cast = ['Tom', 'Mira', 'Rosa', 'Ada', 'Ben'];

describe('runtime guard', () => {
  it('keeps faithful replies untouched', async () => {
    const g = await guardReply('I heard Tom stole bread from the bakery. Busy night tonight.', refs, cast, 'Rosa');
    expect(g.dropped).toBe(0);
  });
  it('drops an invented sentence and keeps the rest', async () => {
    const g = await guardReply("Ada hasn't been seen since morning and Mira is worried sick. Busy night tonight.", refs, cast, 'Rosa');
    expect(g.dropped).toBe(1);
    expect(g.reply).toBe('Busy night tonight.');
  });
  it('falls back to an honest line when nothing faithful is left', async () => {
    const g = await guardReply('Ben secretly poisoned the well.', refs, cast, 'Rosa');
    expect(g.reply).toMatch(/couldn’t say/);
  });
  it('treats only beliefs above doubt as speakable', () => {
    expect(factRefs({ beliefs: [{ claimId: 'x', text: 'Pim waters the beer', confidence: 0.2, chain: [], independentSources: 0 }] })).toEqual([]);
  });
});
