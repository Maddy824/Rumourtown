/**
 * Entry point. Mounts the shell on whatever `deps` provides. Until the real engine is wired in
 * (Task 8), the village runs on the fake simulation; the felt renderer is loaded if it is present
 * and the plain stand-in is used if it is missing or fails.
 */
import { createFakeMap, createFakeSimulation } from './sim/fake.js';
import type { Renderer, VillageMap } from './sim/types.js';
import { mountApp, type AppDeps } from './ui/app.js';
import { withFakeReplay } from './ui/fake-replay.js';
import { createStubRenderer } from './ui/stub-renderer.js';

type CreateRenderer = (canvas: HTMLCanvasElement, map: VillageMap) => Renderer;

/** What the shell runs on. Integration swaps in `createSimulation`, the village map and the cast here. */
export const deps: AppDeps = {
  map: createFakeMap(),
  castVersion: 'v1',
  createSim: (seed, interventions) => withFakeReplay(createFakeSimulation(seed), interventions),
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
  try {
    const mod = await load();
    if (typeof mod.createRenderer === 'function') return mod.createRenderer;
  } catch (err) {
    console.warn('The felt renderer did not load; using the plain one.', err);
  }
  return createStubRenderer;
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
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
