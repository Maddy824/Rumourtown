/** Confirmatory estimators. Methods §7–9 are unnumbered equations in methods-formal.md;
 * Eq. (4) defines the training mixture, not an inferential endpoint. No audit correction
 * is guessed here: these are raw proxy estimates until independent labels are supplied. */
import { readFile, writeFile } from 'node:fs/promises';
import { isMain, readJsonl } from './io.ts';
import { ACTS, useful, type Row } from './run.ts';
import type { MinimalPair, SemanticProjection } from './pairs.ts';
import type { Probe, Scenario } from './types.ts';
export interface Observation {
  condition: string; run: string; root: number; probe: string; split: string; act: string;
  Q: number; F: number; U: number; R: number; error: number; completed: number;
  projection?: SemanticProjection;
  leakage?: number; opportunity?: number; overAbstention?: number; answerable?: number;
}
export type Endpoint = 'Q' | 'F' | 'U' | 'R' | 'error';
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const quantile = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.max(0, Math.ceil(p * s.length) - 1)]!; };
const draw = <T>(xs: T[], rng: () => number) => xs.map(() => xs[Math.floor(rng() * xs.length)]!);
/** Methods §7 macro contrast: pool numerators/denominators within act, average runs within arm. */
export function macro(rows: Observation[], endpoint: Endpoint, acts: string[]): number {
  if (!acts.length) throw new Error('Empty act support');
  return mean(acts.map(a => { const group = rows.filter(r => r.act === a); if (!group.length) throw new Error(`Missing fixed act ${a}`); return mean(group.map(r => r[endpoint])); }));
}
function validate(rows: Observation[], a: string, b: string) {
  const conditions = [a, b].map(c => rows.filter(r => r.condition === c));
  if (conditions.some(rs => !rs.length)) throw new Error('Missing comparison condition');
  const runs = conditions.map(rs => [...new Set(rs.map(r => r.run))].sort());
  const signature = (rs: Observation[]) => rs.map(r => `${r.root}/${r.probe}/${r.act}`).sort().join('\n');
  const reference = signature(conditions[0]!.filter(r => r.run === runs[0]![0]));
  for (let i = 0; i < 2; i++) for (const run of runs[i]!) {
    const rs = conditions[i]!.filter(r => r.run === run);
    if (new Set(rs.map(r => r.probe)).size !== rs.length || signature(rs) !== reference) throw new Error('Comparisons need identical unique probes, acts and roots in every run; missing tasks must be error rows');
  }
  return { conditions, runs };
}
/** Methods §7/9: one root draw shared across shifts as well as conditions.
 * Joint split/act-support strata are fixed from probe design, without reading outcomes. */
export function rootPlan(rows: Observation[], seed = 37, count = 10000): number[][] {
  const rng = random(seed), roots = [...new Set(rows.map(r => r.root))].sort((a, b) => a - b), strata = new Map<string, number[]>();
  for (const root of roots) {
    const key = [...new Set(rows.filter(r => r.root === root).map(r => `${r.split}/${r.act}`))].sort().join(',');
    strata.set(key, [...(strata.get(key) ?? []), root]);
  }
  return Array.from({ length: count }, () => [...strata.values()].flatMap(group => draw(group, rng)));
}
export interface Contrast { a: string; b: string; endpoint: Endpoint; estimate: number; interval: number[]; replicates: number[]; roots: number; runs: number[]; probesPerRun: number; acts: string[]; runEstimates: number[][]; }
/** Methods §7 crossed root/run cluster bootstrap: common roots across all sampled runs and arms.
 * Stratify roots by represented act support, so every replicate keeps the fixed act set. */
export function bootstrap(rows: Observation[], a: string, b: string, endpoint: Endpoint, options: { seed?: number; replicates?: number; pairedRuns?: boolean; rootPlan?: number[][] } = {}): Contrast {
  const { conditions, runs } = validate(rows, a, b), rng = random(options.seed ?? 37);
  const acts = [...new Set(rows.filter(r => r.condition === a).map(r => r.act))].sort();
  const roots = [...new Set(conditions[0]!.map(r => r.root))].sort((a, b) => a - b);
  const tables = conditions.map((rs, i) => new Map(runs[i]!.map(run => [run, new Map(roots.map(root => {
    const group = rs.filter(r => r.root === root && r.run === run);
    return [root, acts.map(act => { const cell = group.filter(r => r.act === act); return [cell.reduce((n, r) => n + r[endpoint], 0), cell.length]; })];
  }))])));
  const sampledMean = (condition: number, run: string, multiplicity: Map<number, number>) => {
    const sums = acts.map(() => [0, 0]);
    for (const [root, weight] of multiplicity) tables[condition]!.get(run)!.get(root)!.forEach(([num, den], a) => { sums[a]![0]! += num! * weight; sums[a]![1]! += den! * weight; });
    return mean(sums.map(([num, den]) => { if (!den) throw new Error('Bootstrap lost fixed act support'); return num! / den; }));
  };
  const runEstimates = conditions.map((rs, i) => runs[i]!.map(run => macro(rs.filter(r => r.run === run), endpoint, acts)));
  const estimate = mean(runEstimates[0]!) - mean(runEstimates[1]!);
  if (options.pairedRuns && JSON.stringify(runs[0]) !== JSON.stringify(runs[1])) throw new Error('Paired runs require matching run labels');
  const plan = options.rootPlan ?? rootPlan(rows.filter(r => r.condition === a), options.seed ?? 37, options.replicates ?? 10000);
  if (plan.some(sample => sample.some(root => !roots.includes(root)))) throw new Error('Root plan and split differ');
  const replicates = plan.map(sampledRoots => {
    const selected = [draw(runs[0]!, rng), [] as string[]];
    selected[1] = options.pairedRuns ? selected[0]! : draw(runs[1]!, rng);
    const multiplicity = new Map<number, number>();
    for (const root of sampledRoots) multiplicity.set(root, (multiplicity.get(root) ?? 0) + 1);
    return mean(selected[0]!.map(run => sampledMean(0, run, multiplicity))) - mean(selected[1]!.map(run => sampledMean(1, run, multiplicity)));
  });
  return { a, b, endpoint, estimate, interval: [quantile(replicates, .025), quantile(replicates, .975)], replicates,
    roots: roots.length, runs: runs.map(rs => rs.length), probesPerRun: conditions[0]!.length / runs[0]!.length, acts, runEstimates };
}
/** Methods §7 centred one-sided bootstrap margin p_h (plus-one finite-bootstrap correction). */
export function marginP(c: Pick<Contrast, 'estimate' | 'replicates'>, h: number): number {
  return (1 + c.replicates.filter(d => d - c.estimate >= c.estimate - h - 1e-12).length) / (c.replicates.length + 1);
}
/** Methods §7 Holm over precisely four elementary hypotheses; simultaneous bounds use
 * Bonferroni inversion (conservative for Holm), explicitly labelled in the report. */
export function holm(ps: number[]): number[] {
  const ordered = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), result = [...ps];
  let previous = 0;
  ordered.forEach(({ p, i }, j) => { previous = Math.max(previous, Math.min(1, p * (ps.length - j))); result[i] = previous; });
  return result;
}
/** Methods §7 exact McNemar diagnostic, one prechosen probe per independent root. */
export function mcnemar(b: number, c: number): number {
  if (![b, c].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid discordance counts');
  const n = b + c, k = Math.min(b, c); if (!n) return 1;
  // Log-sum avoids underflow for large n and preserves exact binomial tail arithmetic.
  let logTerm = -n * Math.LN2, logSum = logTerm;
  for (let i = 1; i <= k; i++) { logTerm += Math.log(n - i + 1) - Math.log(i); const m = Math.max(logSum, logTerm); logSum = m + Math.log(Math.exp(logSum - m) + Math.exp(logTerm - m)); }
  return Math.min(1, 2 * Math.exp(logSum));
}
// Methods §8: compare semantic fields in a fixed order, never JSON object insertion order.
const projectionKey = (p: SemanticProjection) => JSON.stringify([p.proposition, p.polarity, p.confidence, p.source, p.act]);
/** Methods §8 pair success, Fréchet bounds, sensitivity/invariance: missing/error sides fail.
 * Projections must come from independent audit for a semantic claim; the CLI does not infer
 * semantics by comparing raw strings. It reports N/A when projections are unavailable. */
export function pairMetrics(pairs: MinimalPair[], rows: Observation[]) {
  const byId = new Map(rows.map(r => [r.probe, r]));
  if (byId.size !== rows.length) throw new Error('Pair metrics require one condition/run');
  const groups = [false, true].map(nullIntervention => {
    const ps = pairs.filter(p => !!p.nullIntervention === nullIntervention);
    let left = 0, right = 0, both = 0, comparable = 0, desired = 0, directed = 0;
    for (const p of ps) {
      const [a, b] = p.sides.map(s => byId.get(s.id));
      left += a?.Q ?? 0; right += b?.Q ?? 0; both += (a?.Q ?? 0) * (b?.Q ?? 0);
      if (!a?.completed || !b?.completed) { comparable++; continue; }
      if (a.projection && b.projection) {
        comparable++;
        const changed = projectionKey(a.projection) !== projectionKey(b.projection);
        if (a.completed && b.completed && changed !== nullIntervention) desired++;
        if (a.completed && b.completed && p.projections && projectionKey(a.projection) === projectionKey(p.projections[0]) && projectionKey(b.projection) === projectionKey(p.projections[1])) directed++;
      }
    }
    const n = ps.length;
    return { nullIntervention, numerator: both, denominator: n, left: { numerator: left, denominator: n }, right: { numerator: right, denominator: n }, rate: n ? both / n : null,
      bounds: n ? [Math.max(0, (left + right) / n - 1), Math.min(left, right) / n] : null,
      projectionCoverage: [comparable, n], desired, directed, sensitivityOrInvariance: comparable === n && n ? desired / n : null };
  });
  return { groups, balanced: groups.every(g => g.sensitivityOrInvariance !== null) ? mean(groups.map(g => g.sensitivityOrInvariance!)) : null };
}
/** Methods §9 retention contrast Δ_shift - Δ_seeds. Shared replicate indices couple
 * root/run draws when shifts share roots; bootstrap() must use the same explicit joint root plan and run seed/design. */
export function retention(shift: Contrast, seeds: Contrast) {
  if (shift.replicates.length !== seeds.replicates.length) throw new Error('Incompatible bootstrap designs');
  const replicates = shift.replicates.map((d, i) => d - seeds.replicates[i]!);
  const estimate = shift.estimate - seeds.estimate;
  return { estimate, interval: [quantile(replicates, .025), quantile(replicates, .975)], p: marginP({ estimate, replicates }, shift.endpoint === 'Q' ? -.05 : -.02) };
}
export interface InputRun { condition: string; run: string; path: string }
export async function loadObservations(inputs: InputRun[], scenarios: Scenario[], probes: Probe[] = []): Promise<Observation[]> {
  const roots = new Map(scenarios.map(s => [s.id, s.seed])), out: Observation[] = [];
  const scenarioMap = new Map(scenarios.map(s => [s.id, s])), probeMap = new Map(probes.map(p => [p.id, p]));
  for (const input of inputs) {
    const latest = new Map<string, Row>();
    for await (const row of readJsonl<Row>(input.path)) latest.set(row.key, row);
    for (const r of latest.values()) {
      if (r.status === 'skipped') continue;
      const root = r.seed ?? roots.get(r.scenarioId); if (root === undefined) throw new Error(`Unknown root ${r.scenarioId}`);
      const completed = r.status === 'ok' && !!r.result, v = r.result?.verdict;
      // Methods §2, Q=RA and U=MPGA, with all failures set to zero.
      const G = !!v && v.calibrated !== false && v.provenanceCorrect !== false &&
        ((v.abstained && v.calibrated === null && v.validAncestry === null) || (v.requiredSourceCoverage !== false && v.exactDirectTeller !== false));
      const p = probeMap.get(r.probeId), s = scenarioMap.get(r.scenarioId);
      // Methods §2 opportunity denominators; unknown-to-speaker disclosure is an unaudited lexical proxy.
      const opportunity = p && s ? Number(!!p.distractors?.length || s.unknownWorldFacts.some(f => p.utterance.includes(f))) : undefined;
      out.push({ condition: input.condition, run: input.run, root, probe: r.probeId, split: r.split, act: r.gold.behaviour,
        Q: Number(useful(r)), F: Number(completed && v!.epistemicFaithful), R: Number(completed && r.result!.accepted),
        U: Number(completed && G && r.behaviourMatched && (r.result!.attempts.at(-1)?.protocolValid ?? !!r.result!.reply.trim())), error: Number(!completed), completed: Number(completed),
        opportunity, leakage: opportunity === undefined ? undefined : Number(opportunity && completed && v!.sentences.some(s => s.label === 'unknown-to-speaker')),
        answerable: Number(['assert', 'hedge', 'deny', 'name-source'].includes(r.gold.behaviour)), overAbstention: Number(completed && v!.abstained),
        projection: (r as Row & { auditedProjection?: SemanticProjection }).auditedProjection });
    }
  }
  return out;
}
export function report(rows: Observation[], selected: string, verifier = 'verifier-only', base = 'base-best-of-4', seed = 37, replicates = 10000): string {
  const lines = ['# Confirmation analysis', '', 'Raw Phase 0 proxies; independent audit correction and frozen margins/power remain prerequisites for a confirmatory claim. Margins: F > −0.02, Q > 0.05. Fixed represented acts are listed; absent acts earn no zero. Intervals: crossed root/run bootstrap, root strata preserve act support.', ''];
  lines.push(`Bootstrap replicates: ${replicates}; plus-one p-value denominator: ${replicates + 1}. Training-run draws are independent across arms. Joint root draws are shared across shifts.`, '');
  const contrasts: Contrast[] = [];
  const plan = rootPlan(rows, seed, replicates);
  for (const split of [...new Set(rows.map(r => r.split))]) for (const b of [verifier, base]) for (const endpoint of ['F', 'Q'] as const) {
    const rs = rows.filter(r => r.split === split && [selected, b].includes(r.condition));
    if (!rs.some(r => r.condition === b)) throw new Error(`Missing comparator ${b}/${split}`);
    const c = bootstrap(rs, selected, b, endpoint, { seed, replicates, rootPlan: plan });
    (c as Contrast & { split: string }).split = split;
    contrasts.push(c);
    lines.push(`${split}: ${selected} − ${b}, ${endpoint}: ${c.estimate.toFixed(4)} [${c.interval.map(x => x.toFixed(4)).join(', ')}]; ${c.roots} roots, runs ${c.runs.join('/')}, ${c.probesPerRun} probes/run; acts ${c.acts.join(', ')}; absent ${ACTS.filter(a => !c.acts.includes(a)).join(', ') || 'none'}. Run means ${JSON.stringify(c.runEstimates)}.`, '');
  }
  const primary = contrasts.filter(c => (c as Contrast & { split: string }).split === 'confirm');
  if (primary.length !== 4) throw new Error('Need exactly four primary hypotheses on confirm');
  const adjusted = holm(primary.map(c => marginP(c, c.endpoint === 'F' ? -.02 : .05)));
  lines.push('| Contrast | Endpoint | One-sided p | Holm p | Simultaneous lower bound (Bonferroni, conservative for Holm) |', '|---|---|---:|---:|---:|');
  primary.forEach((c, i) => lines.push(`| ${c.a} − ${c.b} | ${c.endpoint} | ${marginP(c, c.endpoint === 'F' ? -.02 : .05)} | ${adjusted[i]} | ${(2 * c.estimate - quantile(c.replicates, 1 - .05 / 4)).toFixed(4)} |`));
  for (const c of contrasts.filter(c => (c as Contrast & { split: string }).split !== 'confirm')) {
    const baseline = primary.find(p => p.b === c.b && p.endpoint === c.endpoint)!;
    lines.push('', `Retention ${(c as Contrast & { split: string }).split}/${c.b}/${c.endpoint}: ${JSON.stringify(retention(c, baseline))}. Denominators are the two contrast designs above.`);
  }
  // One fixed lexicographic probe/root is deterministic and chosen without observing outcomes.
  for (const b of [verifier, base]) {
    const rs = rows.filter(r => r.split === 'confirm'), runs = [...new Set(rs.filter(r => r.condition === selected).map(r => r.run))].sort();
    const aRows = rs.filter(r => r.condition === selected && r.run === runs[0]), bRows = rs.filter(r => r.condition === b && r.run === [...new Set(rs.filter(r => r.condition === b).map(r => r.run))].sort()[0]);
    let n = 0, bCount = 0, cCount = 0;
    for (const root of [...new Set(aRows.map(r => r.root))]) {
      const a = aRows.filter(r => r.root === root).sort((a, b) => a.probe.localeCompare(b.probe))[0]!, other = bRows.find(r => r.probe === a.probe)!;
      n++; if (a.Q && !other.Q) bCount++; if (!a.Q && other.Q) cCount++;
    }
    lines.push('', `McNemar diagnostic (run ${runs[0]}, lexicographic probe/root, fixed without outcomes), ${selected}/${b}: b=${bCount}, c=${cCount}, roots=${n}, exact p=${mcnemar(bCount, cCount)}.`);
  }
  lines.push('', '| Condition | Split | Run | Tasks | Successes | Faithful | Accepted | Errors | Leakage proxy / opportunities | Over-abstention / answerable |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const key of [...new Set(rows.map(r => JSON.stringify([r.condition, r.split, r.run])))].sort()) {
    const [condition, split, run] = JSON.parse(key), rs = rows.filter(r => r.condition === condition && r.split === split && r.run === run);
    lines.push(`| ${condition} | ${split} | ${run} | ${rs.length} | ${rs.reduce((n, r) => n + r.Q, 0)} / ${rs.length} | ${rs.reduce((n, r) => n + r.F, 0)} / ${rs.length} | ${rs.reduce((n, r) => n + r.R, 0)} / ${rs.length} | ${rs.reduce((n, r) => n + r.error, 0)} / ${rs.length} | ${rs.every(r => r.opportunity !== undefined) ? rs.reduce((n, r) => n + (r.leakage ?? 0), 0) + ' / ' + rs.reduce((n, r) => n + (r.opportunity ?? 0), 0) : 'N/A (missing probe context)'} | ${rs.filter(r => r.answerable && r.overAbstention).length} / ${rs.filter(r => r.answerable).length} |`);
  }
  lines.push('', '| Condition | Split | Run | Act | Q / requests | F / requests | U / requests |', '|---|---|---|---|---:|---:|---:|');
  for (const key of [...new Set(rows.map(r => JSON.stringify([r.condition, r.split, r.run, r.act])))].sort()) {
    const [condition, split, run, act] = JSON.parse(key), rs = rows.filter(r => r.condition === condition && r.split === split && r.run === run && r.act === act);
    lines.push(`| ${condition} | ${split} | ${run} | ${act} | ${rs.reduce((n, r) => n + r.Q, 0)} / ${rs.length} | ${rs.reduce((n, r) => n + r.F, 0)} / ${rs.length} | ${rs.reduce((n, r) => n + r.U, 0)} / ${rs.length} |`);
  }
  if (primary.some(c => c.runs[0]! < 3 || (c.b === verifier && c.runs[1]! < 3))) lines.push('', 'Fewer than three training seeds: screening only.');
  return lines.join('\n') + '\n';
}
if (isMain(import.meta.url)) {
  const [configPath, output = 'confirmation-analysis.md'] = process.argv.slice(2);
  if (!configPath) throw new Error('usage: analyse.ts config.json [output.md]');
  const config = JSON.parse(await readFile(configPath, 'utf8')) as { inputs: InputRun[]; scenarios: string; probes?: string; selected: string; pairs?: string; pairInputs?: InputRun[]; seed?: number; replicates?: number };
  const scenarios: Scenario[] = []; for await (const s of readJsonl<Scenario>(config.scenarios)) scenarios.push(s);
  const probes: Probe[] = []; if (config.probes) for await (const p of readJsonl<Probe>(config.probes)) probes.push(p);
  const rows = await loadObservations(config.inputs, scenarios, probes);
  let markdown = report(rows, config.selected, 'verifier-only', 'base-best-of-4', config.seed, config.replicates);
  if (config.pairs) {
    const pairs: MinimalPair[] = []; for await (const p of readJsonl<MinimalPair>(config.pairs)) pairs.push(p);
    const pairRows = config.pairInputs ? await loadObservations(config.pairInputs, scenarios, pairs.flatMap(p => p.sides)) : rows;
    for (const input of config.pairInputs ?? config.inputs) for (const split of [...new Set(pairs.map(p => p.split))]) markdown += `\nPair metrics ${input.condition}/${input.run}/${split}: ${JSON.stringify(pairMetrics(pairs.filter(p => p.split === split), pairRows.filter(r => r.condition === input.condition && r.run === input.run && r.split === split)))}\n`;
  }
  await writeFile(output, markdown);
}
