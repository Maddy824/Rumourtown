/** Model-free prompt oracle. stdout is JSONL; never writes benchmark results. */
import { readFile } from 'node:fs/promises';
import { messagesFor } from '../strategies.ts';
import type { Probe, Scenario } from '../types.ts';

const [scenarioPath = 'bench/slm/data/scenarios.jsonl', probePath = 'bench/slm/data/probes.jsonl', count = '10'] = process.argv.slice(2);
const read = async <T>(path: string): Promise<T[]> => (await readFile(path, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as T);
const scenarios = new Map((await read<Scenario>(scenarioPath)).map(s => [s.id, s]));
const probes = await read<Probe>(probePath);
// Cover varied axes rather than ten near-identical fact-count probes.
const selected: Probe[] = [];
for (const p of probes) if (!selected.some(q => q.axis === p.axis) && selected.length < Number(count)) selected.push(p);
for (const p of probes) if (selected.length < Number(count) && !selected.includes(p)) selected.push(p);
for (const p of selected) {
  const s = scenarios.get(p.scenarioId);
  if (!s) throw new Error(`Missing scenario ${p.scenarioId}`);
  console.log(JSON.stringify({ probeId: p.id, messages: messagesFor(s, p) }));
}
