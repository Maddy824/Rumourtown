// Node 22+. Bundles existing TypeScript with the repository's Vite; no extra dependency.
import { build } from 'vite';
import { createInterface } from 'node:readline';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = await build({ configFile: false, logLevel: 'silent',
  build: { ssr: 'apps/rumortown/src/agent/environment.ts', write: false, minify: false }, ssr: { noExternal: ['rumormind'] } });
if (Array.isArray(output) || !('output' in output)) throw new Error('Expected one agent bundle.');
const chunk = output.output.find(c => c.type === 'chunk');
if (!chunk) throw new Error('Agent bundle missing.');
const { createAgentEnvironment, replayAgentRun } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
const mode = process.argv[2] ?? 'demo';
const env = mode === 'replay' ? replayAgentRun(JSON.parse(await readFile(process.argv[3], 'utf8'))) : createAgentEnvironment(731);

if (mode === 'serve') {
  // One JSON object in, one JSON object out. Diagnostics go to stderr.
  console.error('Local agent ready. AI credits used: $0. Send {"id":1,"tool":"describe","arguments":{}} to begin.');
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    let id = null;
    try {
      if (line.length > 4096) throw new Error('Request exceeds 4096 characters.');
      const request = JSON.parse(line);
      if (!request || typeof request !== 'object' || Array.isArray(request) ||
          !['string', 'number'].includes(typeof request.id) || typeof request.tool !== 'string') throw new Error('Expected id, tool and arguments.');
      id = request.id;
      const result = request.tool === 'describe' ? env.describe() : request.tool === 'export' ? env.replay() : env.call(request.tool, request.arguments);
      console.log(JSON.stringify({ id, result }));
    } catch (error) { console.log(JSON.stringify({ id, error: error.message })); }
  }
} else if (mode === 'demo' || mode === 'replay') {
  if (mode === 'demo') {
    console.log('Local agent started. AI credits used: $0.');
    const act = (tool, args) => {
      const result = env.call(tool, args);
      if (!result.ok) throw new Error(result.error);
      console.log(`Minute ${result.observation.tick}: ${tool}. AI credits used: $0.`);
      return result;
    };
    act('move', { placeId: 'square' });
    let listener;
    for (let attempt = 0; attempt < 20 && !listener; attempt++) {
      act('wait', { ticks: 10 });
      const person = env.observe().nearby.find(p => p.id !== 'tom');
      if (person && act('approach', { villagerId: person.id, ticks: 20 }).reached) listener = person.id;
    }
    if (!listener) throw new Error('No listener reached within the demo budget.');
    act('whisper', { listener, text: 'Tom brought bread for a neighbour.', about: 'tom', kind: 'kindness', severity: 1 });
    for (let i = 0; i < 4; i++) act('wait', { ticks: 120 });
  }
  const directory = resolve(mode === 'replay' ? (process.argv[4] ?? '.agent-runs/replay') : (process.argv[3] ?? '.agent-runs/demo'));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'actions.json'), JSON.stringify(env.replay(), null, 2));
  await writeFile(resolve(directory, 'research.json'), JSON.stringify(env.research(), null, 2));
  console.log(`Saved replay and research data to ${directory}. AI credits used: $0.`);
} else throw new Error('Use demo, serve or replay <actions.json>.');
