/** CPU-only locked Phase 0 rescoring. Shared historical inputs are strictly read-only. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DATA, hash, isMain, readJsonl, ROOT } from '../io.ts';
import { rescore } from '../rescore.ts';
import { ACTS, summarise, useful, type Row } from '../run.ts';
import type { Probe, Scenario } from '../types.ts';
const digest = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
/** Fingerprint only the locked scoring logic, not unrelated CLI and generation changes. */
export async function scorerFingerprint(): Promise<string> {
  const source = async (p: string) => readFile(join(ROOT, p), 'utf8');
  const run = await source('bench/slm/run.ts'), strategies = await source('bench/slm/strategies.ts'), types = await source('bench/slm/types.ts');
  return hash([await source('bench/slm/verifier.ts'), await source('apps/rumortown/src/agentic/verifier.ts'),
    run.slice(run.indexOf('export function surfaceBehaviourLegacy'), run.indexOf('function percentile')),
    strategies.slice(strategies.indexOf('export function passes'), strategies.indexOf('export async function execute')),
    types.slice(types.indexOf('export function factsFor')), await source('bench/slm/rescore.ts')]);
}
export async function reconcile(input: string, out: string, document: string, scenariosPath: string, probesPath: string) {
  const lock = JSON.parse(await readFile(new URL('./phase0-scorer-lock.json', import.meta.url), 'utf8'));
  const scorer = await scorerFingerprint();
  if (scorer !== lock.scorer) throw new Error('Phase 0 scorer changed; inspect the diff before updating its lock');
  const scenarios = new Map<string, Scenario>(), probes = new Map<string, Probe>();
  for await (const s of readJsonl<Scenario>(scenariosPath)) scenarios.set(s.id, s);
  for await (const p of readJsonl<Probe>(probesPath)) probes.set(p.id, p);
  const hashes = { scenarios: await digest(scenariosPath), probes: await digest(probesPath) };
  // Exclusive new destination: never write summary/rescored files into the shared eval directories.
  await mkdir(out, { recursive: false });
  const cells = new Map<string, Row[]>(), counts: unknown[] = [];
  for (const name of (await readdir(input)).sort()) for (const split of ['test-seed', 'test-mechanism']) {
    const dir = join(input, name, split);
    let manifest;
    try { manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue; throw e; }
    for (const k of ['scenarios', 'probes'] as const) if (manifest.settings[k] !== hashes[k]) throw new Error(`Historical dataset mismatch: ${dir}/${k}`);
    const latest = new Map<string, Row>();
    for await (const r of readJsonl<Row>(join(dir, 'outputs.jsonl'))) latest.set(r.key, r);
    const rows = await rescore([...latest.values()], scenarios, probes);
    await writeFile(join(out, `${name}-${split}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    for (const strategy of [...new Set(rows.map(r => r.strategy))]) {
      const rs = rows.filter(r => r.strategy === strategy && r.status !== 'skipped');
      cells.set(`${name}/${strategy}/${split}`, rs);
      counts.push({ name, split, strategy, tasks: rs.length, completed: rs.filter(r => r.status === 'ok').length,
        faithful: rs.filter(r => r.status === 'ok' && r.result?.verdict.epistemicFaithful).length, success: rs.filter(useful).length });
    }
  }
  if (!cells.size) throw new Error('No historical screening runs found');
  await writeFile(join(out, 'provenance.json'), JSON.stringify({ scorer, hashes, counts }, null, 2));
  await writeFile(join(out, 'summary.md'), summarise([...cells.values()].flat()));
  const rate = (rs: Row[] | undefined, metric: 'F' | 'Q') => {
    if (!rs?.length) return 'N/A (0)';
    const n = rs.filter(r => metric === 'Q' ? useful(r) : r.status === 'ok' && r.result?.verdict.epistemicFaithful).length;
    return `${(n / rs.length * 100).toFixed(1)}% (${n}/${rs.length})`;
  };
  // Methods §2 Q=RA: every task (including errors), rather than F × a marginal act score.
  const lines = ['## Screening results (reconciled under the locked Phase 0 scorer)', '',
    'Exploratory, one training seed, three epochs, historical training/validation leakage and inspected test families. These rows cannot support a confirmatory claim. “Success” is acceptance plus substantive gold-act completion (Q); faithfulness (F) and Q use all non-skipped tasks, including errors. The old “Both” column used a different proxy. Checkpoints and historical selection were not rerun.', '',
    `Scorer SHA-256: ${scorer}. Raw count/provenance artifact: ${out.startsWith(ROOT) ? out.slice(ROOT.length) : out}/provenance.json.`, '',
    '| Model/run | Strategy | Seeds: faithful | Seeds: success | Stories: faithful | Stories: success |', '|---|---|---:|---:|---:|---:|'];
  for (const key of [...new Set([...cells.keys()].map(k => k.split('/').slice(0, 2).join('/')))].sort()) {
    const [name, strategy] = key.split('/');
    lines.push(`| ${name} | ${strategy}${strategy === 'best-of' ? '-4' : ''} | ${rate(cells.get(`${key}/test-seed`), 'F')} | ${rate(cells.get(`${key}/test-seed`), 'Q')} | ${rate(cells.get(`${key}/test-mechanism`), 'F')} | ${rate(cells.get(`${key}/test-mechanism`), 'Q')} |`);
  }
  lines.push('', 'The table is generated from stored outputs by `bench/slm/finetune/reconcile-screening.ts`; interpretation must follow those counts. The historical base grounded condition used temperature 0 and best-of-4 used 0.7, so that contrast confounds selection with decoding. Confirmation uses fresh roots, withheld wording, matched data and updates, root-disjoint validation, two epochs, validation-selected checkpoints and three seeds on the 3B comparison. Human audit and power/margin freezing remain required. No historical row is silently replaced by new inference.', '');
  const previous = await readFile(document, 'utf8'), start = previous.indexOf('## Screening results');
  if (start < 0) throw new Error('Missing screening section marker');
  await writeFile(document, previous.slice(0, start) + lines.join('\n'));
}
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2), flag = (name: string, fallback: string) => args.includes('--' + name) ? args[args.indexOf('--' + name) + 1]! : fallback;
  await reconcile(flag('input', join(ROOT, 'bench/slm/results/finetune/eval')), resolve(flag('out', join(DATA, 'confirmation-screening-37'))),
    resolve(flag('doc', join(ROOT, 'docs/research/finetune-study.md'))), flag('scenarios', join(DATA, 'scenarios.jsonl')), flag('probes', join(DATA, 'probes.jsonl')));
}
