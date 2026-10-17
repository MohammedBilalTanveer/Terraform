// Pure geometry for the world map: bounds, trails, deterministic decor scatter and the label placer.
// Everything here is presentation-only (no agricultural content, no store access).
import { fbm } from "../terrain";
import { CHANNEL, POND, STATIONS, WORLD, distToChannel, isReserved, mulberry32, type StationId } from "../worldConfig";

/** Half-size (metres) of the baked terrain square; the map can never pan outside it. */
export const EXTENT = 82;

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Bounding box of every station plus generous padding (more at the top: pins stand above their spot). */
export function stationBounds(): Bounds {
  const xs = STATIONS.map((s) => s.pos[0]);
  const zs = STATIONS.map((s) => s.pos[1]);
  return {
    minX: Math.min(...xs) - 17,
    maxX: Math.max(...xs) + 21,
    minZ: Math.min(...zs) - 17,
    maxZ: Math.max(...zs) + 11,
  };
}

export type View = { cx: number; cz: number; s: number };

/** px-per-metre that fits the whole box in a W×H viewport. */
export function fitScale(b: Bounds, W: number, H: number) {
  return Math.min(W / (b.maxX - b.minX), H / (b.maxZ - b.minZ));
}

export function fitView(b: Bounds, W: number, H: number): View {
  return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, s: fitScale(b, W, H) };
}

export function clampView(v: View, W: number, H: number, minS: number, maxS: number): View {
  const s = Math.max(minS, Math.min(maxS, v.s));
  const hw = W / (2 * s);
  const hh = H / (2 * s);
  const lim = (c: number, h: number) => (h >= EXTENT ? 0 : Math.max(-EXTENT + h, Math.min(EXTENT - h, c)));
  return { s, cx: lim(v.cx, hw), cz: lim(v.cz, hh) };
}

// ---------------------------------------------------------------------------------------------
// Trails: a minimum spanning tree (Prim, from the camp) plus the camp's nearest extra links.
export type Trail = { a: StationId; b: StationId; d: string };

export function buildTrails(): Trail[] {
  const st = STATIONS;
  const idx = st.findIndex((s) => s.id === "camp");
  const dist = (i: number, j: number) => Math.hypot(st[i].pos[0] - st[j].pos[0], st[i].pos[1] - st[j].pos[1]);
  const inTree = new Set<number>([idx]);
  const edges: [number, number][] = [];
  while (inTree.size < st.length) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < st.length; j++) {
        if (inTree.has(j)) continue;
        const d = dist(i, j);
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  // extra hub links from the camp so it reads as the centre of the trail network
  const linked = new Set(edges.filter((e) => e[0] === idx || e[1] === idx).map((e) => (e[0] === idx ? e[1] : e[0])));
  st.map((_, j) => j)
    .filter((j) => j !== idx && !linked.has(j) && dist(idx, j) < 24)
    .sort((a, b) => dist(idx, a) - dist(idx, b))
    .slice(0, 2)
    .forEach((j) => edges.push([idx, j]));
  return edges.map(([i, j], n) => {
    const [ax, az] = st[i].pos;
    const [bx, bz] = st[j].pos;
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const bend = (n % 2 ? 1 : -1) * len * 0.1;
    const cx = mx + (-(bz - az) / len) * bend;
    const cz = mz + ((bx - ax) / len) * bend;
    return { a: st[i].id, b: st[j].id, d: `M${ax},${az} Q${cx.toFixed(2)},${cz.toFixed(2)} ${bx},${bz}` };
  });
}

// ---------------------------------------------------------------------------------------------
// Deterministic decor (stones, dry-grass tufts, thorn shrubs, escarpment hatching).
export type Decor = {
  tufts: string;
  tuftShadow: string;
  stones: { x: number; y: number; rx: number; ry: number; rot: number; t: number }[];
  shrubs: { x: number; y: number; r: number; thorns: string }[];
  hatch: string;
  rim: string;
  rimInner: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildDecor(): Decor {
  const rnd = mulberry32(7351);
  const polar = (rMin: number, rMax: number) => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rMin * rMin + rnd() * (rMax * rMax - rMin * rMin));
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  // dry-grass tufts, clumped by the same noise field the 3D scatter uses
  let tufts = "";
  let tuftShadow = "";
  for (let n = 0, g = 0; n < 340 && g < 9000; g++) {
    const [x, z] = polar(1, WORLD.radius - 0.5);
    const d = fbm(x * 0.06 - 40, z * 0.06 + 22);
    if (rnd() > d * 1.6 - 0.2) continue;
    if (isReserved(x, z, -2.2)) continue;
    const s = 0.55 + rnd() * 0.55;
    tufts += `M${r2(x - s * 0.5)},${r2(z)}q${r2(s * 0.1)},${r2(-s * 0.7)} ${r2(s * 0.2)},${r2(-s)}M${r2(x)},${r2(z)}q0,${r2(-s * 0.9)} ${r2(s * 0.05)},${r2(-s * 1.3)}M${r2(x + s * 0.5)},${r2(z)}q${r2(-s * 0.1)},${r2(-s * 0.7)} ${r2(-s * 0.2)},${r2(-s)}`;
    tuftShadow += `M${r2(x - s * 0.55)},${r2(z + 0.12)}h${r2(s * 1.1)}`;
    n++;
  }
  // scattered stones
  const stones: Decor["stones"] = [];
  for (let n = 0, g = 0; n < 110 && g < 4000; g++) {
    const [x, z] = polar(2, WORLD.radius - 1);
    if (isReserved(x, z, -1.5) && distToChannel(x, z) > 2.6) continue;
    const s = 0.28 + rnd() * rnd() * 0.9;
    stones.push({ x: r2(x), y: r2(z), rx: r2(s), ry: r2(s * (0.6 + rnd() * 0.3)), rot: Math.round(rnd() * 180), t: rnd() });
    n++;
  }
  // thorn shrubs
  const shrubs: Decor["shrubs"] = [];
  for (let n = 0, g = 0; n < 46 && g < 3000; g++) {
    const [x, z] = polar(4, WORLD.radius - 1);
    if (isReserved(x, z, 0.5)) continue;
    const r = 0.55 + rnd() * 0.65;
    let thorns = "";
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rnd();
      thorns += `M${r2(x + Math.cos(a) * r * 0.8)},${r2(z + Math.sin(a) * r * 0.8)}L${r2(x + Math.cos(a) * r * 1.5)},${r2(z + Math.sin(a) * r * 1.5)}`;
    }
    shrubs.push({ x: r2(x), y: r2(z), r: r2(r), thorns });
    n++;
  }
  // escarpment: radial hatching + a jittered rim line
  let hatch = "";
  const R = WORLD.radius;
  for (let deg = 0; deg < 360; deg += 1.6) {
    const a = (deg * Math.PI) / 180;
    const r0 = R + 0.8 + rnd() * 2.2;
    const r1 = r0 + 2.5 + rnd() * 5.5;
    hatch += `M${r2(Math.cos(a) * r0)},${r2(Math.sin(a) * r0)}L${r2(Math.cos(a + 0.012) * r1)},${r2(Math.sin(a + 0.012) * r1)}`;
  }
  let rim = "";
  let rimInner = "";
  for (let deg = 0; deg <= 360; deg += 2) {
    const a = (deg * Math.PI) / 180;
    const j = (fbm(Math.cos(a) * 3 + 5, Math.sin(a) * 3 - 2) - 0.5) * 3.2;
    const rr = R + 0.6 + j;
    rim += `${deg ? "L" : "M"}${r2(Math.cos(a) * rr)},${r2(Math.sin(a) * rr)}`;
    const ri = rr - 0.9;
    rimInner += `${deg ? "L" : "M"}${r2(Math.cos(a) * ri)},${r2(Math.sin(a) * ri)}`;
  }
  return { tufts, tuftShadow, stones, shrubs, hatch, rim: rim + "Z", rimInner: rimInner + "Z" };
}

/** Smooth path (quadratic midpoints) through the channel polyline. */
export function channelPath(): string {
  const p = CHANNEL;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const mz = (p[i][1] + p[i + 1][1]) / 2;
    d += ` Q${p[i][0]},${p[i][1]} ${mx},${mz}`;
  }
  const l = p[p.length - 1];
  return d + ` L${l[0]},${l[1]}`;
}

export { POND };

// ---------------------------------------------------------------------------------------------
// Label placer (screen space). Tries right / left / below / above and rejects collisions.
export type Rect = { x: number; y: number; w: number; h: number };
export type LabelReq = {
  id: string;
  /** centre of the pin head, px */
  px: number;
  py: number;
  /** pin head radius */
  r: number;
  w: number;
  h: number;
  forced: boolean;
  priority: number;
  /** extra reserved area (e.g. the NEXT flag above the pin) */
  reserve?: Rect;
};

const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

export function placeLabels(reqs: LabelReq[], W: number, H: number, blocked: Rect[] = []): Map<string, Rect> {
  const out = new Map<string, Rect>();
  const placed: Rect[] = [];
  const pinRect = (q: LabelReq): Rect => ({ x: q.px - q.r - 3, y: q.py - q.r - 3, w: q.r * 2 + 6, h: q.r * 2 + 6 + 14 });
  const order = [...reqs].sort((a, b) => Number(b.forced) - Number(a.forced) || b.priority - a.priority);
  const gap = 5;
  for (const q of order) {
    const cands: Rect[] = [
      { x: q.px + q.r + gap, y: q.py - q.h / 2, w: q.w, h: q.h },
      { x: q.px - q.r - gap - q.w, y: q.py - q.h / 2, w: q.w, h: q.h },
      { x: q.px - q.w / 2, y: q.py + q.r + gap + 14, w: q.w, h: q.h }, // below (clears the stem)
      { x: q.px - q.w / 2, y: q.py - q.r - gap - q.h, w: q.w, h: q.h },
      { x: q.px + q.r * 0.2, y: q.py - q.r - gap - q.h, w: q.w, h: q.h }, // above-right
      { x: q.px - q.r * 0.2 - q.w, y: q.py - q.r - gap - q.h, w: q.w, h: q.h }, // above-left
      { x: q.px + q.r * 0.2, y: q.py + q.r + gap + 14, w: q.w, h: q.h }, // below-right
      { x: q.px - q.r * 0.2 - q.w, y: q.py + q.r + gap + 14, w: q.w, h: q.h }, // below-left
    ];
    const others = reqs.filter((o) => o.id !== q.id);
    const cost = (c: Rect) => {
      let k = 0;
      for (const p of placed) k += overlap(c, p);
      for (const o of others) {
        k += overlap(c, pinRect(o));
        if (o.reserve) k += overlap(c, o.reserve);
      }
      // own pin head only (not its stem) so "below" stays a valid candidate
      for (const b of blocked) k += overlap(c, b);
      k += overlap(c, { x: q.px - q.r - 3, y: q.py - q.r - 3, w: q.r * 2 + 6, h: q.r * 2 + 6 });
      if (q.reserve) k += overlap(c, q.reserve);
      // out of the viewport
      const ox = Math.max(0, 4 - c.x) + Math.max(0, c.x + c.w - (W - 4));
      const oy = Math.max(0, 4 - c.y) + Math.max(0, c.y + c.h - (H - 4));
      k += (ox + oy) * 200;
      return k;
    };
    let best: Rect | null = null;
    let bc = Infinity;
    for (const c of cands) {
      const k = cost(c);
      if (k < bc) {
        bc = k;
        best = c;
      }
      if (k === 0) break;
    }
    if (!best) continue;
    if (bc > 0 && !q.forced) continue;
    // forced chips that still overflow the viewport are clamped inside it
    const fin = { ...best, x: Math.max(4, Math.min(W - 4 - best.w, best.x)), y: Math.max(4, Math.min(H - 4 - best.h, best.y)) };
    out.set(q.id, fin);
    placed.push(fin);
  }
  return out;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
/** Text width at 600-weight Space Grotesk (cached; falls back to a per-character estimate). */
export function textWidth(text: string, size = 12): number {
  const key = `${size}|${text}`;
  const hit = widths.get(key);
  if (hit != null) return hit;
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement("canvas").getContext("2d");
    } catch {
      measureCtx = null;
    }
  }
  let w = text.length * size * 0.6;
  if (measureCtx) {
    measureCtx.font = `600 ${size}px "Space Grotesk", Inter, system-ui, sans-serif`;
    w = measureCtx.measureText(text).width;
  }
  w = Math.ceil(w * 1.04);
  widths.set(key, w);
  return w;
}
