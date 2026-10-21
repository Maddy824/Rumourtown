/**
 * A plain stand-in for the felt renderer (Task 6): flat tiles, round villagers, red threads.
 * It implements the same Renderer contract so the UI can be built and tested without the real one,
 * and the app falls back to it if the real renderer fails to load or throws.
 */
import type { Camera, Renderer, RenderOptions, TileKind, Vec2, VillageMap, VillagerView, WorldSnapshot } from '../sim/types.js';

const TABLE = '#4F6637';
const TILE_COLOR: Record<TileKind, string> = {
  grass: '#6B8E4E',
  path: '#E8DCC3',
  water: '#3F5E8A',
  bridge: '#B48C5E',
  floor: '#EFE5CF',
  wall: '#8C5E4A',
  door: '#4A3A2C',
  field: '#C9A54A',
  tree: '#6B8E4E',
  well: '#E8DCC3',
};

export function createStubRenderer(canvas: HTMLCanvasElement, map: VillageMap): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser has no 2D canvas.');
  let width = canvas.clientWidth || 1;
  let height = canvas.clientHeight || 1;
  let dpr = 1;

  const project = (pos: Vec2, cam: Camera): { x: number; y: number } => ({
    x: (pos.x - cam.center.x) * cam.zoom + cam.width / 2,
    y: (pos.y - cam.center.y) * cam.zoom + cam.height / 2,
  });
  const unproject = (px: number, py: number, cam: Camera): Vec2 => ({
    x: (px - cam.width / 2) / cam.zoom + cam.center.x,
    y: (py - cam.height / 2) / cam.zoom + cam.center.y,
  });

  const lerpPos = (prev: WorldSnapshot | null, v: VillagerView, i: number, alpha: number): Vec2 => {
    if (!prev) return v.pos;
    const p = prev.villagers[i]?.id === v.id ? prev.villagers[i] : prev.villagers.find((o) => o.id === v.id);
    if (!p) return v.pos;
    return { x: p.pos.x + (v.pos.x - p.pos.x) * alpha, y: p.pos.y + (v.pos.y - p.pos.y) * alpha };
  };

  function drawTiles(cam: Camera): void {
    if (!ctx) return;
    const tl = unproject(0, 0, cam);
    const br = unproject(width, height, cam);
    const x0 = Math.max(0, Math.floor(tl.x));
    const y0 = Math.max(0, Math.floor(tl.y));
    const x1 = Math.min(map.width - 1, Math.ceil(br.x));
    const y1 = Math.min(map.height - 1, Math.ceil(br.y));
    const z = cam.zoom;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const kind = map.tiles[y * map.width + x] ?? 'grass';
        const p = project({ x, y }, cam);
        ctx.fillStyle = TILE_COLOR[kind];
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(z) + 1, Math.ceil(z) + 1);
        if (kind === 'field' && z > 10) {
          ctx.fillStyle = 'rgba(46, 42, 34, 0.12)';
          ctx.fillRect(p.x, p.y + z * 0.45, z, Math.max(1, z * 0.08));
        } else if (kind === 'tree') {
          ctx.fillStyle = '#4C6B37';
          ctx.beginPath();
          ctx.arc(p.x + z / 2, p.y + z / 2, z * 0.46, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 'well') {
          ctx.strokeStyle = '#8A8478';
          ctx.lineWidth = Math.max(1, z * 0.14);
          ctx.beginPath();
          ctx.arc(p.x + z / 2, p.y + z / 2, z * 0.32, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawVillager(pos: Vec2, v: VillagerView, cam: Camera, selected: boolean): void {
    if (!ctx) return;
    const z = cam.zoom;
    const p = project(pos, cam);
    const s = v.tier === 'core' ? 1.1 : 1;
    const body = z * 0.3 * s;
    if (selected) {
      ctx.fillStyle = '#F6F0E4';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + body * 0.9, body * 1.5, body * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(46, 42, 34, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + body * 0.95, body * 1.05, body * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, z * 0.04);
    ctx.strokeStyle = '#2E2A22';
    ctx.fillStyle = v.look.top;
    ctx.beginPath();
    ctx.arc(p.x, p.y + body * 0.2, body, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = v.look.skin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - body * 0.9, body * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (v.look.hair.style !== 'bald') {
      ctx.fillStyle = v.look.hair.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y - body * 0.95, body * 0.62, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(pos: Vec2, cam: Camera): void {
    if (!ctx) return;
    const z = cam.zoom;
    const p = project(pos, cam);
    const body = z * 0.32;
    ctx.fillStyle = 'rgba(46, 42, 34, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + body * 0.95, body * 1.05, body * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2E2A22';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - body * 1.9);
    ctx.quadraticCurveTo(p.x + body * 1.2, p.y - body * 1.1, p.x + body, p.y + body * 1.1);
    ctx.lineTo(p.x - body, p.y + body * 1.1);
    ctx.quadraticCurveTo(p.x - body * 1.2, p.y - body * 1.1, p.x, p.y - body * 1.9);
    ctx.fill();
    ctx.fillStyle = '#1E1B16';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - body * 0.75, body * 0.38, body * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawThreads(cur: WorldSnapshot, positions: Map<string, Vec2>, playerPos: Vec2, cam: Camera): void {
    if (!ctx) return;
    const n = cur.threads.length;
    cur.threads.forEach((t, i) => {
      const a = t.from === 'stranger' ? playerPos : positions.get(t.from);
      const b = positions.get(t.to);
      if (!a || !b) return;
      const pa = project(a, cam);
      const pb = project(b, cam);
      const age = n - 1 - i;
      const sag = Math.min(40, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.18);
      ctx.globalAlpha = Math.max(0.18, 1 - age * 0.06);
      ctx.strokeStyle = '#A3323B';
      ctx.lineWidth = Math.max(1.25, cam.zoom * 0.07);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.quadraticCurveTo((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + sag, pb.x, pb.y);
      ctx.stroke();
      ctx.fillStyle = '#D9A531';
      for (const p of [pa, pb]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, cam.zoom * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  return {
    resize(w, h, ratio) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      dpr = Math.max(1, Math.min(3, ratio));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    },
    render(previous, current, camera, options: RenderOptions) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = TABLE;
      ctx.fillRect(0, 0, width, height);
      drawTiles(camera);
      const positions = new Map<string, Vec2>();
      current.villagers.forEach((v, i) => positions.set(v.id, lerpPos(previous, v, i, options.alpha)));
      const pp = previous ? previous.player.pos : current.player.pos;
      const playerPos = { x: pp.x + (current.player.pos.x - pp.x) * options.alpha, y: pp.y + (current.player.pos.y - pp.y) * options.alpha };
      const order: { v: VillagerView | null; pos: Vec2 }[] = current.villagers.map((v, i) => ({ v, pos: positions.get(v.id) ?? lerpPos(previous, v, i, options.alpha) }));
      order.push({ v: null, pos: playerPos });
      order.sort((a, b) => a.pos.y - b.pos.y);
      for (const item of order) {
        if (item.v) drawVillager(item.pos, item.v, camera, item.v.id === options.selected);
        else drawPlayer(item.pos, camera);
      }
      if (options.threads) drawThreads(current, positions, playerPos, camera);
    },
    project,
    unproject,
    villagerAt(px, py, snapshot, camera) {
      let best: string | null = null;
      let bestD = Math.max(14, camera.zoom * 0.55);
      for (const v of snapshot.villagers) {
        const p = project(v.pos, camera);
        // Aim at the body and head, which sit a little above the standing point.
        const d = Math.hypot(px - p.x, py - (p.y - camera.zoom * 0.25));
        if (d < bestD) {
          bestD = d;
          best = v.id;
        }
      }
      return best;
    },
  };
}
