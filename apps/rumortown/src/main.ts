/** Mount the real village; ?fake=1 keeps the UI stand-in available. */
import { cast, claims, castVersion } from './content/cast/index.js';
import { villageMap } from './content/map/index.js';
import { createSimulation } from './sim/engine.js';
import { createFakeMap, createFakeSimulation } from './sim/fake.js';
import { createTalk } from './sim/talk/index.js';
import { createMover, createWorld } from './sim/world/index.js';
import type { Renderer, VillageMap } from './sim/types.js';
import { mountApp, type AppDeps } from './ui/app.js';
import { createArrival } from './ui/arrival.js';
import { createStubRenderer } from './ui/stub-renderer.js';

type CreateRenderer = (canvas: HTMLCanvasElement, map: VillageMap) => Renderer;

const fake = new URLSearchParams(window.location.search).get('fake') === '1';
const world = { ...createWorld(villageMap), createMover };

export const deps: AppDeps = {
  map: fake ? createFakeMap() : villageMap,
  castVersion,
  createSim: (seed, interventions, tuning) => fake
    ? createFakeSimulation(seed, interventions)
    : createSimulation({ seed, world, cast, claims, talk: createTalk(cast), interventions, tuning }),
  createRenderer: createStubRenderer,

};

/*
 * A glob rather than a bare `import('./render/index.js')`: Vite refuses to serve a module whose literal
 * dynamic import cannot be resolved, which would take the whole page down while the renderer is absent.
 * The glob compiles to the same lazy `import()` when the file exists and to nothing when it does not.
 */
const rendererModules = import.meta.glob<{ createRenderer?: CreateRenderer }>('./render/index.ts');

export async function loadRenderer(): Promise<CreateRenderer> {
  if (new URLSearchParams(window.location.search).get('renderer') === 'stub') return createStubRenderer;
  const load = rendererModules['./render/index.ts'];
  if (!load) return createStubRenderer;
  let deadline = 0;
  try {
    const mod = await Promise.race([load(), new Promise<never>((_, reject) => {
      deadline = window.setTimeout(() => reject(new Error('Renderer loading took too long')), 1500);
    })]);
    if (typeof mod.createRenderer === 'function') return mod.createRenderer;
  } catch (err) {
    console.warn('The felt renderer did not load; using the plain one.', err);
  } finally {
    window.clearTimeout(deadline);
  }
  return createStubRenderer;
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  const arrival = createArrival(root);
  deps.arrival = arrival;
  deps.arrivalDone = arrival.start();
  deps.createRenderer = await loadRenderer();
  if (import.meta.env.DEV) {
    // Development only: ?t=880 opens the run at that tick, to reach the evening card quickly.
    const t = Number(new URLSearchParams(window.location.search).get('t'));
    if (Number.isFinite(t) && t > 0) deps.startTick = Math.floor(t);
  }
  const app = mountApp(root, deps);
  // Development only: lets Playwright find villagers on screen (window.rumortown.locate('mira')).
  if (import.meta.env.DEV) Object.assign(window, { rumortown: app });
}

void start();
