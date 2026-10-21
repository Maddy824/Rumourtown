import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { hash, writeJsonl } from '../io.ts';
import type { Row } from '../run.ts';
import type { Probe, Scenario } from '../types.ts';
import { sentences, verify } from '../verifier.ts';
import { agreement, alpha, kappa, majority, metrics, report } from './agreement.ts';
import { draw, resultFiles, sample, type Candidate } from './sample.ts';
import { LABELS, options, type KeyFile, type Label, type LabelFile } from './schema.ts';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function temp(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), 'rt-label-')); dirs.push(dir); return dir; }
const scenario: Scenario = { id: 'scenario', seed: 1, tick: 0, split: 'test-seed', mechanisms: [], villager: 'mira',
  persona: { name: 'Mira', role: 'baker', voice: 'plain' }, facts: [{ id: 'secret-id', text: 'Ben stole bread', band: 'sure', confidence: .95, chain: ['Ivo told Mira'], trueInWorld: false }],
  unknownWorldFacts: ['Tom sold a horse'], others: [{ speaker: 'Secret', text: 'Never displayed ledger' }], castNames: ['Ben','Mira','Tom'], witnessEvents: 0 };
const probe: Probe = { id: 'probe', scenarioId: 'scenario', axis: 'facts', level: 1, templateId: 'template',
  utterance: 'What happened?', history: [{ role: 'user', content: 'Hello' }], gold: { behaviour: 'assert' },
  facts: [{ ...scenario.facts[0]!, band: 'half', confidence: .5 }], distractors: [{ speaker: 'Wren', text: 'Tom sold a horse' }] };
async function candidate(key = 'row', reply = 'Ben stole bread.', label?: Label): Promise<Candidate> {
  const verdict = await verify(reply, probe.facts!, scenario.unknownWorldFacts, scenario.castNames);
  if (label) verdict.sentences.forEach(s => { s.label = label; });
  const row: Row = { key, model: 'model-secret', actualModel: 'model-exact-secret', strategy: 'grounded', probeId: probe.id, scenarioId: scenario.id,
    split: scenario.split, axis: probe.axis, level: 1, gold: probe.gold, status: 'ok', behaviourMatched: true,
    result: { reply, verdict, accepted: true, attempts: [], escalated: false, latencyMs: 1 } };
  return { row, source: '/private/results/outputs.jsonl', sourceHash: 'hash', scenario, probe };
}
function labels(key: KeyFile, annotatorId: string, assigned?: (Label | null)[]): LabelFile {
  return { version: 1, sampleId: key.sampleId, annotatorId, annotations: key.items.map((i, index) => ({ id: i.id,
    sentences: i.sentences.map((text, j) => ({ text, label: assigned ? assigned[index]! : i.oracle.sentences[j]!.label })), doesAsked: 'yes', confidence: 'yes' })) };
}

test('seeded water-fill sampling covers rare verdicts and models, is order-independent and shuffles presentation', async () => {
  const candidates: Candidate[] = [];
  for (let i = 0; i < 20; i++) candidates.push(await candidate(`common-${i}`));
  candidates.push(await candidate('rare-bad', 'Tom sold a horse.', 'unknown-to-speaker'));
  candidates.push(await candidate('rare-meta', 'As an AI, the user is asking.', 'out-of-character'));
  const other = await candidate('other-model'); other.row.model = 'other-model'; other.row.axis = 'pressure'; candidates.push(other);
  const a = draw(candidates, 8, '7'), b = draw([...candidates].reverse(), 8, '7');
  expect(a).toEqual(b); expect(a.items.items).toHaveLength(8);
  expect(a.key.strata).toHaveLength(4); expect(a.key.strata.every(s => s.sampled > 0)).toBe(true);
  expect(a.key.items.map(i => i.rowKey)).toContain('rare-bad'); expect(a.key.items.map(i => i.rowKey)).toContain('rare-meta');
  expect(draw(candidates, 8, '8').items.items).not.toEqual(a.items.items);
  expect(draw(candidates, 500).items.items).toHaveLength(23);
  expect(draw(candidates, 2).key.strata.filter(s => s.sampled)).toHaveLength(2);
  expect(a.key.population).toBe(23);
});

test('public allowlist blinds metadata and world truth while preserving exact effective context', async () => {
  const { items, key } = draw([await candidate()]);
  const text = JSON.stringify(items), item = items.items[0]!;
  for (const forbidden of ['model-secret','model-exact-secret','secret-id','trueInWorld','unknownWorldFacts','worldFaithful','epistemicFaithful','oracle','strategy','gold','scenarioId','probeId','Never displayed ledger']) expect(text).not.toContain(forbidden);
  expect(Object.keys(item).sort()).toEqual(['id','speaker','beliefs','distractors','utterance','history','reply'].sort());
  expect(item.id).toMatch(/^[a-f0-9]{64}$/); expect(item.beliefs[0]!.band).toBe('half');
  expect(item.beliefs[0]!.sources).toEqual(['Ivo told Mira']); expect(item.distractors).toEqual(probe.distractors);
  expect(item.history).toEqual(probe.history); expect(item.utterance).toBe(probe.utterance);
  expect(key.items[0]!.worldTruth.beliefs[0]!.trueInWorld).toBe(false); expect(key.items[0]!.model).toBe('model-secret');
  expect(items.sampleId).toBe(hash(items.items));
  const persona = await candidate(); persona.row.strategy = 'persona';
  expect(draw([persona]).items.items[0]!.distractors).toEqual([]);
});

test('result discovery recurses, prefers rescoring and prevents double-counting output formats', async () => {
  const dir = await temp(); await mkdir(join(dir,'nested','run'),{ recursive:true });
  const output = join(dir,'nested','run','outputs.jsonl'), rescored = join(dir,'nested','run','rescored.jsonl');
  await writeFile(output,''); await writeFile(rescored,'');
  expect(await resultFiles([dir,join(dir,'nested','run')])).toEqual([rescored]);
  expect(await resultFiles([output])).toEqual([output]);
  await expect(resultFiles([output,rescored])).rejects.toThrow('one result file');
  await expect(resultFiles([await temp()])).rejects.toThrow('No result');
});

test('CLI samples the latest rows, rejects context mismatches and never overwrites existing sessions', async () => {
  const dir = await temp(), c = await candidate(); await mkdir(join(dir,'run'));
  const scenarios = join(dir,'scenarios.jsonl'), probes = join(dir,'probes.jsonl'), output = join(dir,'run','outputs.jsonl');
  await writeJsonl(scenarios,[scenario]); await writeJsonl(probes,[probe]);
  await writeJsonl(output,[{...c.row,status:'error'},c.row,{...c.row,key:'skip',status:'skipped'}]);
  const args = [join(dir,'run'),'--scenarios',scenarios,'--probes',probes,'--out',join(dir,'sample'),'--n','1'];
  const result = await sample(args); expect(result.key.population).toBe(1);
  expect(JSON.parse(await readFile(join(dir,'sample','items.json'),'utf8'))).toEqual(result.items);
  expect(JSON.parse(await readFile(join(dir,'sample','key.private.json'),'utf8'))).toEqual(result.key);
  await expect(sample(args)).rejects.toThrow();
  const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  await writeFile(join(dir,'run','manifest.json'),JSON.stringify({settings:{scenarios:sha(await readFile(scenarios)),probes:'wrong'}}));
  await expect(sample(args)).rejects.toThrow('do not match');
  await rm(join(dir,'run','manifest.json')); await appendFile(output,'{"torn":');
  await expect(sample(args)).rejects.toThrow();
});

test('sampler rejects duplicated generations across copied runs and missing scenario context', async () => {
  const dir = await temp(), c = await candidate();
  await mkdir(join(dir,'a')); await mkdir(join(dir,'b'));
  const scenarios = join(dir,'scenarios.jsonl'), probes = join(dir,'probes.jsonl');
  await writeJsonl(scenarios,[scenario]); await writeJsonl(probes,[probe]);
  await writeJsonl(join(dir,'a','outputs.jsonl'),[c.row]); await writeJsonl(join(dir,'b','outputs.jsonl'),[c.row]);
  const args = ['--scenarios',scenarios,'--probes',probes,'--out',join(dir,'sample')];
  await expect(sample([dir,...args])).rejects.toThrow('Duplicate generation');
  await writeJsonl(scenarios,[]);
  await expect(sample([join(dir,'a'),...args])).rejects.toThrow('context');
});

test('sampler rejects old sentence segmentation, missing context and invalid options', async () => {
  const c = await candidate(); c.row.result!.verdict.sentences[0]!.text = 'Old segmentation';
  expect(() => draw([c])).toThrow('re-score');
  for (const n of [0,-1,NaN,1.5]) expect(() => draw([],n)).toThrow('--n');
  expect(() => draw([])).toThrow('No successful');
  for (const args of [['--unknown','x'],['--seed'],['--n','1','--n','2']]) expect(()=>options(args,['seed','n'])).toThrow();
  await expect(sample([])).rejects.toThrow('Usage');
  await expect(sample(['dir'])).rejects.toThrow('--out');
});

test('hand-computed fixture: kappa 1/2 and binary F1 4/5 and 2/3', () => {
  // A: S S C C; B: S C C C. po=3/4, pe=(2*1+2*3)/16=1/2, kappa=1/2.
  const fixture = [['S','S'],['S','C'],['C','C'],['C','C']];
  expect(kappa(fixture)).toEqual({value:.5,observedAgreement:.75,units:4,ratings:8});
  // Human S S C C; oracle S S S C. Supported TP=2, FP=1, FN=0.
  const pairs = ['S','S','C','C'].map((human,i)=>({human,oracle:['S','S','S','C'][i]!}));
  expect(metrics(pairs,'S')).toEqual({tp:2,fp:1,fn:0,support:2,precision:2/3,recall:1,f1:4/5});
  expect(metrics(pairs,'C')).toEqual({tp:1,fp:0,fn:1,support:2,precision:1,recall:1/2,f1:2/3});
});

test('nominal alpha fixture handles three coders, missing data and unpairable units', () => {
  // AAA, ABB, BB(null), C(null)(null): pairable margins A=4 B=4, N=8.
  // Do=2/8=1/4; De=32/56=4/7; alpha=1-(1/4)/(4/7)=9/16.
  const fixture = [['A','A','A'],['A','B','B'],['B','B',null],['C',null,null]];
  expect(alpha(fixture)).toEqual({value:9/16,observedAgreement:.75,units:3,ratings:8});
  expect(alpha([['A','A','A']]).value).toBeNull(); expect(kappa([['A','A']]).value).toBeNull();
  expect(alpha([[null,'A',null]]).units).toBe(0); expect(kappa([['A',null]]).units).toBe(0);
  expect(kappa([['A','B'],['B','A']]).value).toBe(-1);
  expect(metrics([],'A').f1).toBeNull(); expect(metrics([{human:'A',oracle:'B'}],'A').f1).toBe(0);
});

test('majority never uses a lone vote, plurality, tied vote or missing label as truth', () => {
  expect(majority(['A','A','B'])).toBe('A'); expect(majority(['A','A',null])).toBe('A');
  for (const votes of [['A',null,null],['A','B'],['A','A','B','C'],[null,null]]) expect(majority(votes)).toBeNull();
});

test('report joins by opaque id and sentence text, omits ties and breaks metrics down by model and axis', async () => {
  const candidates = await Promise.all([candidate('1'),candidate('2','Tom sold a horse.'),candidate('3','As an AI, the user is asking.')]);
  const {key} = draw(candidates); const a = labels(key,'reader-a'), b = labels(key,'reader-b');
  b.annotations.reverse(); const agreed = report(key,[a,b]);
  expect(agreed).toContain('Cohen’s kappa'); expect(agreed).toContain('Axis: facts'); expect(agreed).toContain('Model: model-secret; axis: facts');
  expect(agreed).toContain('Human / oracle'); expect(agreed).toContain('3 majority-resolved; 0 unresolved; 3 oracle-scored');
  b.annotations[0]!.sentences[0]!.label = 'contradicts';
  const tied = report(key,[a,b]); expect(tied).toContain('2 majority-resolved; 1 unresolved; 2 oracle-scored');
  expect(tied).toContain('Items needing adjudication');
  const c = labels(key,'reader-c'); expect(report(key,[a,b,c])).toContain('Krippendorff’s nominal alpha');
  a.annotations[0]!.confidence='not applicable';c.annotations[0]!.confidence='not applicable';
  expect(report(key,[a,b,c])).toContain('3 majority-resolved; 0 unresolved; 2 oracle-scored');
});

test('report rejects duplicate annotators, stale exports, invalid labels and mismatched sentence text', async () => {
  const {key} = draw([await candidate()]), a = labels(key,'a'), b = labels(key,'b');
  expect(()=>report(key,[a])).toThrow('at least two'); expect(()=>report(key,[a,a])).toThrow('Duplicate annotator');
  expect(()=>report(key,[a,{...b,sampleId:'wrong'}])).toThrow('sample id');
  b.annotations[0]!.sentences[0]!.text='changed'; expect(()=>report(key,[a,b])).toThrow('invalid annotation');
  const duplicate = labels(key,'b');duplicate.annotations.push(duplicate.annotations[0]!);expect(()=>report(key,[a,duplicate])).toThrow('annotation');
  const missing = labels(key,'missing');missing.annotations=[];expect(report(key,[a,missing])).toContain('0 majority-resolved; 1 unresolved; 0 oracle-scored');
});

test('agreement CLI emits Markdown without overwriting a prior report', async () => {
  const dir = await temp(), {key} = draw([await candidate()]);
  await writeFile(join(dir,'key.json'),JSON.stringify(key));
  for (const id of ['a','b']) await writeFile(join(dir,`${id}.json`),JSON.stringify(labels(key,id)));
  const args=['--key',join(dir,'key.json'),join(dir,'a.json'),join(dir,'b.json'),'--out',join(dir,'report.md')];
  const markdown=await agreement(args);expect(await readFile(join(dir,'report.md'),'utf8')).toBe(markdown);
  await expect(agreement(args)).rejects.toThrow(); await expect(agreement([])).rejects.toThrow('Usage');
});

test('inline sentence splitting matches the production verifier on punctuation, whitespace and quotes', async () => {
  const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
  const source=html.match(/function sentences\(reply\) \{[\s\S]*?\n\}/)![0];
  expect(runInNewContext(`${html.match(/const LABELS = \[[^\n]+;/)![0]}\nLABELS`)).toEqual([...LABELS]);
  for (const reply of ['One. Two? Three!','One. lower case stays. Next.','Hello!\n“Quoted.” More.','  One\n\tthing. \'Another.','', 'One... Two!? "Yes."']) {
    expect(runInNewContext(`${source}\nsentences(reply)`,{reply})).toEqual(sentences(reply));
  }
  expect(html).toContain("connect-src 'none'"); expect(html).not.toMatch(/<script[^>]+src=/);
});
