import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isMain } from '../io.ts';
import { ACTS, CONFIDENCE, LABELS, REPLY_LABELS, options, replyLabel,
  type Annotation, type KeyFile, type KeyItem, type LabelFile } from './schema.ts';

export interface Agreement { value: number | null; observedAgreement: number | null; units: number; ratings: number }
const counts = (values: string[]): Map<string, number> => {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};

export function kappa(units: (string | null)[][]): Agreement {
  const paired = units.filter(u => u.length === 2 && u[0] !== null && u[1] !== null);
  const n = paired.length;
  if (!n) return { value: null, observedAgreement: null, units: 0, ratings: 0 };
  const a = counts(paired.map(u => u[0]!)), b = counts(paired.map(u => u[1]!));
  const po = paired.filter(u => u[0] === u[1]).length / n;
  const pe = [...a].reduce((sum, [label, count]) => sum + count * (b.get(label) ?? 0), 0) / n ** 2;
  return { value: pe === 1 ? null : (po - pe) / (1 - pe), observedAgreement: po, units: n, ratings: 2 * n };
}

/** Nominal alpha, coincidence weighting 1/(m_u-1), pairable ratings only. */
export function alpha(units: (string | null)[][]): Agreement {
  const paired = units.map(u => u.filter((v): v is string => v !== null)).filter(u => u.length >= 2);
  const n = paired.reduce((sum, u) => sum + u.length, 0);
  if (!n) return { value: null, observedAgreement: null, units: 0, ratings: 0 };
  const margins = counts(paired.flat());
  const disagreement = paired.reduce((sum, u) => {
    const same = [...counts(u).values()].reduce((s, c) => s + c * (c - 1), 0);
    return sum + (u.length * (u.length - 1) - same) / (u.length - 1);
  }, 0) / n;
  const expected = (n * n - [...margins.values()].reduce((sum, c) => sum + c * c, 0)) / (n * (n - 1));
  return { value: expected === 0 ? null : 1 - disagreement / expected,
    observedAgreement: 1 - disagreement, units: paired.length, ratings: n };
}

/** At least two votes and a strict majority of the available nonmissing votes. */
export function majority(ratings: (string | null)[]): string | null {
  const votes = ratings.filter((v): v is string => v !== null);
  if (votes.length < 2) return null;
  return [...counts(votes)].find(([, count]) => count > votes.length / 2)?.[0] ?? null;
}

export interface Metrics { tp: number; fp: number; fn: number; support: number; precision: number | null; recall: number | null; f1: number | null }
export function metrics(pairs: { human: string; oracle: string }[], label: string): Metrics {
  const tp = pairs.filter(p => p.human === label && p.oracle === label).length;
  const fp = pairs.filter(p => p.human !== label && p.oracle === label).length;
  const fn = pairs.filter(p => p.human === label && p.oracle !== label).length;
  return { tp, fp, fn, support: tp + fn, precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null };
}

function validateKey(key: KeyFile): void {
  if (key?.version !== 1 || typeof key.sampleId !== 'string' || !Array.isArray(key.items) || !key.items.length) throw new Error('Invalid private key file');
  const ids = new Set<string>();
  for (const item of key.items) {
    if (typeof item.id !== 'string' || ids.has(item.id) || typeof item.model !== 'string' || typeof item.axis !== 'string' ||
      !Array.isArray(item.sentences) || !item.sentences.every(t => typeof t === 'string') || !Array.isArray(item.oracle?.sentences) ||
      item.oracle.sentences.length !== item.sentences.length || item.oracle.sentences.some((s, i) => s.text !== item.sentences[i] || !LABELS.includes(s.label)) ||
      item.oracleReply !== replyLabel(item.oracle.sentences.map(s => s.label)) || !(item.oracle.calibrated === null || typeof item.oracle.calibrated === 'boolean') ||
      !(item.behaviourMatched === null || typeof item.behaviourMatched === 'boolean')) throw new Error(`Invalid or duplicate key item: ${item.id}`);
    ids.add(item.id);
  }
}

export function validateLabels(file: LabelFile, key: KeyFile): Map<string, Annotation> {
  if (file?.version !== 1 || file.sampleId !== key.sampleId || typeof file.annotatorId !== 'string' || !file.annotatorId.trim() || file.annotatorId !== file.annotatorId.trim() || !Array.isArray(file.annotations)) {
    throw new Error('Label file has an invalid annotator id, version or sample id');
  }
  const items = new Map(key.items.map(i => [i.id, i])), result = new Map<string, Annotation>();
  for (const a of file.annotations) {
    const item = items.get(a.id);
    if (!item || result.has(a.id) || !Array.isArray(a.sentences) || a.sentences.length !== item.sentences.length ||
      a.sentences.some((s, i) => s.text !== item.sentences[i] || !(s.label === null || LABELS.includes(s.label))) ||
      !(a.doesAsked === null || ACTS.includes(a.doesAsked)) || !(a.confidence === null || CONFIDENCE.includes(a.confidence))) {
      throw new Error(`Unknown, duplicate, stale or invalid annotation: ${a.id}`);
    }
    result.set(a.id, a);
  }
  return result;
}

interface Unit { id: string; item: KeyItem; ratings: (string | null)[]; oracle: string | null }
interface Dimension { name: string; labels: readonly string[]; units: Unit[] }
const cell = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replace(/[\r\n]/g, ' ');
const decimal = (n: number | null): string => n === null ? 'n/a' : n.toFixed(4);
const table = (headers: string[], rows: string[][]): string[] => [
  `| ${headers.map(cell).join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(cell).join(' | ')} |`), '',
];

export function report(key: KeyFile, files: LabelFile[]): string {
  validateKey(key);
  if (files.length < 2) throw new Error('Supply at least two independent annotators');
  const annotators = new Set<string>();
  const labels = files.map(file => {
    const values = validateLabels(file, key);
    if (annotators.has(file.annotatorId)) throw new Error(`Duplicate annotator id: ${file.annotatorId}; use only their latest export`);
    annotators.add(file.annotatorId); return values;
  });
  const sentences: Unit[] = [], replies: Unit[] = [], acts: Unit[] = [], confidence: Unit[] = [];
  for (const item of key.items) {
    const answers = labels.map(byId => byId.get(item.id));
    item.sentences.forEach((_, i) => sentences.push({ id: `${item.id}:${i + 1}`, item,
      oracle: item.oracle.sentences[i]!.label, ratings: answers.map(a => a?.sentences[i]?.label ?? null) }));
    replies.push({ id: item.id, item, oracle: item.oracleReply, ratings: answers.map(a =>
      a && a.sentences.every(s => s.label !== null) ? replyLabel(a.sentences.map(s => s.label!)) : null) });
    acts.push({ id: item.id, item, oracle: item.behaviourMatched === null ? null : item.behaviourMatched ? 'yes' : 'no', ratings: answers.map(a => a?.doesAsked ?? null) });
    confidence.push({ id: item.id, item, oracle: item.oracle.calibrated === null ? 'not applicable' : item.oracle.calibrated ? 'yes' : 'no', ratings: answers.map(a => a?.confidence ?? null) });
  }
  const dimensions: Dimension[] = [
    { name: 'Sentence labels', labels: LABELS, units: sentences },
    { name: 'Reply verdicts', labels: REPLY_LABELS, units: replies },
    { name: 'Does what was asked', labels: ACTS, units: acts },
    { name: 'Confidence', labels: CONFIDENCE, units: confidence },
  ];
  const agreement = files.length === 2 ? kappa : alpha, statistic = files.length === 2 ? "Cohen’s kappa" : "Krippendorff’s nominal alpha";
  const lines: string[] = ['# Human audit of the epistemic verifier', '', `Sample: ${cell(key.sampleId)}. Items: ${key.items.length}. Annotators: ${files.map(f => cell(f.annotatorId)).join(', ')}.`, '',
    `Agreement uses ${statistic}; missing ratings are omitted. Per-label agreement is one-versus-rest. A constant category or no paired data gives n/a, not perfect reliability.`, '',
    'The human reference is a strict majority of at least two available ratings, computed independently per unit and question. With two annotators, only agreement is adjudicated. Ties and fewer than two votes are excluded from oracle scoring and listed for human adjudication. There is no automatic tie-break or oracle vote. Scores on resolved units may be optimistic if disputed units are harder; resolve the queue before treating this as a complete audit.', '',
    'Reply verdicts are derived per annotator only when all sentence labels are present: out-of-character takes priority over unfaithful (contradicts or unknown), otherwise faithful. Empty replies have no sentence units; their reply verdict is faithful by this narrow definition. Task completion catches empty or evasive answers.', '',
    'All precision, recall, F1 and matrices are unweighted counts on this stratified audit sample, not estimates of deployment prevalence. Rare oracle verdicts were deliberately oversampled. Report sampling fractions and adjudication coverage alongside the metrics; do not generalise pooled scores to all replies.', '',
    'Task completion scores compare the stored surface proxy to human yes versus partly/no. Confidence scores omit human not applicable; no-claim oracle replies are also not applicable. Reliability retains all categories. World truth is deliberately not judged by these blinded labels.', '',
    '## Sampling coverage', '',
    ...table(['Model','Axis','Oracle stratum','Population','Sampled'], key.strata.map(s => [s.model,s.axis,s.verdict,String(s.population),String(s.sampled)])),
    '## Inter-annotator agreement', '',
  ];
  for (const dimension of dimensions) {
    lines.push(`### ${dimension.name}`, '');
    const overall = agreement(dimension.units.map(u => u.ratings));
    const rows = [['Overall', decimal(overall.value), decimal(overall.observedAgreement), String(overall.units), String(overall.ratings)]];
    for (const label of dimension.labels) {
      const a = agreement(dimension.units.map(u => u.ratings.map(r => r === null ? null : r === label ? 'present' : 'absent')));
      rows.push([label,decimal(a.value),decimal(a.observedAgreement),String(a.units),String(a.ratings)]);
    }
    lines.push(...table(['Category',statistic,'Observed agreement','Pairable units','Pairable ratings'],rows));
  }
  const models = [...new Set(key.items.map(i => i.model))].sort(), axes = [...new Set(key.items.map(i => i.axis))].sort();
  const groups: { name: string; matches: (item: KeyItem) => boolean }[] = [
    { name: 'All items', matches: () => true },
    ...models.map(model => ({ name: `Model: ${cell(model)}`, matches: (i: KeyItem) => i.model === model })),
    ...axes.map(axis => ({ name: `Axis: ${cell(axis)}`, matches: (i: KeyItem) => i.axis === axis })),
    ...models.flatMap(model => axes.filter(axis => key.items.some(i => i.model === model && i.axis === axis)).map(axis => ({
      name: `Model: ${cell(model)}; axis: ${cell(axis)}`, matches: (i: KeyItem) => i.model === model && i.axis === axis,
    }))),
  ];
  lines.push('## Oracle performance and agreement by group', '');
  for (const group of groups) {
    lines.push(`### ${group.name}`, '');
    for (const dimension of dimensions) {
      const units = dimension.units.filter(u => group.matches(u.item));
      const agreed = units.map(u => ({ ...u, human: majority(u.ratings) }));
      const resolved = agreed.filter(u => u.human !== null);
      const pairs = resolved.filter(u => u.oracle !== null && (dimension.name !== 'Confidence' || u.human !== 'not applicable')).map(u => ({
        human: dimension.name === 'Does what was asked' && u.human === 'partly' ? 'no' : u.human!, oracle: u.oracle!,
      }));
      const categories = dimension.name === 'Does what was asked' ? ['yes','no'] : dimension.labels;
      const a = agreement(units.map(u => u.ratings));
      lines.push(`**${dimension.name}.** ${units.length} units; ${resolved.length} majority-resolved; ${units.length - resolved.length} unresolved; ${pairs.length} oracle-scored. ${statistic}: ${decimal(a.value)}.`, '',
        ...table(['Label','Precision','Recall','F1','TP','FP','FN','Human support'],categories.map(label => {
          const m = metrics(pairs,label);return [label,decimal(m.precision),decimal(m.recall),decimal(m.f1),String(m.tp),String(m.fp),String(m.fn),String(m.support)];
        })),
        'Confusion matrix: human reference rows, oracle prediction columns.', '',
        ...table(['Human / oracle',...categories], categories.map(human => [human,...categories.map(oracle => String(pairs.filter(p => p.human === human && p.oracle === oracle).length))])),
      );
    }
  }
  lines.push('## Items needing adjudication', '', 'Sentence ids use a one-based sentence number after the item id. Missing votes and tied votes remain unresolved. Review disagreements only after independent exports are locked.', '',
    ...table(['Question','Item or sentence id','Votes in annotator order'], dimensions.flatMap(d => d.units.filter(u => majority(u.ratings) === null).map(u => [d.name,u.id,u.ratings.map(r => r ?? '(missing)').join('; ')]))),
    '## Method reference', '',
    'Nominal alpha uses pairable coincidences weighted by 1/(ratings per unit − 1), with expected disagreement drawn without replacement from the pooled pairable margins. See [Krippendorff, Computing Alpha-Reliability](https://www.asc.upenn.edu/sites/default/files/2021-03/Computing%20Krippendorff%27s%20Alpha-Reliability.pdf).', '',
  );
  return lines.join('\n');
}

export async function agreement(args: string[]): Promise<string> {
  const { flags, paths } = options(args, ['key', 'out']);
  if (!flags.has('key') || paths.length < 2) throw new Error('Usage: agreement.ts --key key.private.json labels-a.json labels-b.json [...] [--out report.md]');
  const key = JSON.parse(await readFile(resolve(flags.get('key')!), 'utf8')) as KeyFile;
  const files: LabelFile[] = [];
  for (const path of paths) files.push(JSON.parse(await readFile(resolve(path), 'utf8')) as LabelFile);
  const markdown = report(key, files);
  if (flags.has('out')) await writeFile(resolve(flags.get('out')!), markdown, { flag: 'wx' });
  return markdown;
}
if (isMain(import.meta.url)) {
  const markdown = await agreement(process.argv.slice(2));
  if (!process.argv.includes('--out')) process.stdout.write(markdown);
}
