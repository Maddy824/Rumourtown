import { verify, ollamaEmbed } from './verifier.ts';
import { cases, facts, unknown, cast } from './data/dev-labels.ts';
for (const mode of ['lexical', 'embed'] as const) {
  const embed = mode === 'embed' ? ollamaEmbed('all-minilm') : undefined;
  let ok = 0, okHard = 0; const misses: string[] = [];
  for (const c of cases) {
    const v = await verify(c.reply, facts, unknown, cast, { embed });
    const right = v.epistemicFaithful === c.epistemic;
    if (c.hard) { if (right) okHard++; else misses.push(`${c.hard}: "${c.reply}" → ${v.sentences.map(s => s.label).join(',')}`); }
    else if (right) ok++; else misses.push(`core: "${c.reply}"`);
  }
  const core = cases.filter(c => !c.hard).length, hard = cases.length - core;
  console.log(`${mode}: core ${ok}/${core}, hard ${okHard}/${hard}`); for (const m of misses) console.log('  miss', m);
}
