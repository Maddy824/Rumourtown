/**
 * Tile regions as cut felt pieces. Traces the outline of a set of tiles into closed contours,
 * then turns each contour into a path with rounded outer corners (scissor-cut felt) or into an
 * inset stitch line whose dashes run unbroken around the whole piece.
 */

/** Is tile (x, y) part of the region? Callers clamp coordinates so pieces run off the map edge. */
export type Inside = (x: number, y: number) => boolean;

export interface Contour {
  /** Corner vertices in tile units, clockwise on screen (region on the right of travel). */
  xs: number[];
  ys: number[];
  /** True where the outline turns right: an outer, convex corner. */
  convex: boolean[];
}

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** Traces every contour of the region over the map plus `margin` tiles of overhang. */
export function traceContours(width: number, height: number, inside: Inside, margin = 1): Contour[] {
  const gw = width + margin * 2;
  const gh = height + margin * 2;
  const grid = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) grid[y * gw + x] = inside(x - margin, y - margin) ? 1 : 0;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && grid[y * gw + x] === 1;

  const vw = gw + 1;
  const outA = new Int32Array(vw * (gh + 1)).fill(-1);
  const outB = new Int32Array(vw * (gh + 1)).fill(-1);
  const ex: number[] = [];
  const ey: number[] = [];
  const ed: number[] = [];
  const addEdge = (sx: number, sy: number, d: number) => {
    const i = ex.length;
    ex.push(sx);
    ey.push(sy);
    ed.push(d);
    const v = sy * vw + sx;
    if (outA[v] === -1) outA[v] = i;
    else outB[v] = i;
  };
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) addEdge(x, y, 0);
      if (!at(x + 1, y)) addEdge(x + 1, y, 1);
      if (!at(x, y + 1)) addEdge(x + 1, y + 1, 2);
      if (!at(x - 1, y)) addEdge(x, y + 1, 3);
    }
  }

  const used = new Uint8Array(ex.length);
  const contours: Contour[] = [];
  for (let s = 0; s < ex.length; s++) {
    if (used[s]) continue;
    const vx: number[] = [];
    const vy: number[] = [];
    const dirs: number[] = [];
    let e = s;
    for (let guard = 0; guard < ex.length + 1; guard++) {
      used[e] = 1;
      const d = ed[e] as number;
      vx.push(ex[e] as number);
      vy.push(ey[e] as number);
      dirs.push(d);
      const v = ((ey[e] as number) + (DY[d] as number)) * vw + (ex[e] as number) + (DX[d] as number);
      const a = outA[v] as number;
      const b = outB[v] as number;
      let next = -1;
      // At a vertex where two pieces touch diagonally, turn right so they stay separate.
      for (const want of [(d + 1) % 4, d, (d + 3) % 4]) {
        if (a !== -1 && ed[a] === want && (!used[a] || a === s)) { next = a; break; }
        if (b !== -1 && ed[b] === want && (!used[b] || b === s)) { next = b; break; }
      }
      if (next === -1 || next === s) break;
      e = next;
    }
    const xs: number[] = [];
    const ys: number[] = [];
    const convex: boolean[] = [];
    const n = dirs.length;
    for (let i = 0; i < n; i++) {
      const prev = dirs[(i + n - 1) % n] as number;
      const cur = dirs[i] as number;
      if (prev === cur) continue;
      xs.push((vx[i] as number) - margin);
      ys.push((vy[i] as number) - margin);
      convex.push(cur === (prev + 1) % 4);
    }
    if (xs.length >= 4) contours.push({ xs, ys, convex });
  }
  return contours;
}

/**
 * Adds a contour to `out` scaled by `z` pixels per tile, pulled inward by `inset` pixels,
 * with outer corners rounded to `radius` (measured on the uninset outline) and inner corners
 * rounded to `innerRadius`.
 */
export function contourPath(out: Path2D, c: Contour, z: number, inset: number, radius: number, innerRadius = 0): void {
  const n = c.xs.length;
  if (n < 3) return;
  const px: number[] = new Array(n);
  const py: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ax = c.xs[(i + n - 1) % n] as number;
    const ay = c.ys[(i + n - 1) % n] as number;
    const bx = c.xs[i] as number;
    const by = c.ys[i] as number;
    const cx = c.xs[(i + 1) % n] as number;
    const cy = c.ys[(i + 1) % n] as number;
    const inx = Math.sign(bx - ax);
    const iny = Math.sign(by - ay);
    const onx = Math.sign(cx - bx);
    const ony = Math.sign(cy - by);
    // Inward normal of a direction (dx, dy) is (-dy, dx) for clockwise contours.
    px[i] = bx * z + (-iny + -ony) * inset;
    py[i] = by * z + (inx + onx) * inset;
  }
  const mid = (i: number, j: number) => [((px[i] as number) + (px[j] as number)) / 2, ((py[i] as number) + (py[j] as number)) / 2] as const;
  const [sx, sy] = mid(n - 1, 0);
  out.moveTo(sx, sy);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + n - 1) % n;
    const lenIn = Math.hypot((px[i] as number) - (px[k] as number), (py[i] as number) - (py[k] as number));
    const lenOut = Math.hypot((px[j] as number) - (px[i] as number), (py[j] as number) - (py[i] as number));
    const want = c.convex[i] ? Math.max(0, radius - inset) : innerRadius > 0 ? innerRadius + inset : 0;
    const r = Math.min(want, lenIn / 2, lenOut / 2);
    if (r > 0.01) out.arcTo(px[i] as number, py[i] as number, px[j] as number, py[j] as number, r);
    else out.lineTo(px[i] as number, py[i] as number);
  }
  out.closePath();
}

/** Calls `fn` for each straight edge of the contour in pixels, with its outward normal. */
export function forEachEdge(c: Contour, z: number, fn: (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => void): void {
  const n = c.xs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = (c.xs[i] as number) * z;
    const y0 = (c.ys[i] as number) * z;
    const x1 = (c.xs[j] as number) * z;
    const y1 = (c.ys[j] as number) * z;
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    fn(x0, y0, x1, y1, dy, -dx);
  }
}

export interface Component {
  /** Tile indices (y * width + x). */
  tiles: number[];
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 4-connected components of the region, inside the map only. */
export function components(width: number, height: number, inside: Inside): Component[] {
  const seen = new Uint8Array(width * height);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || !inside(start % width, Math.floor(start / width))) continue;
    const tiles: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % width;
      const y = (i - x) / width;
      tiles.push(i);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const nb = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const j of nb) {
        if (j < 0 || seen[j]) continue;
        if (!inside(j % width, Math.floor(j / width))) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    out.push({ tiles, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return out;
}
