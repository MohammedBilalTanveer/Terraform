// Height + colour fields for the lateritic plateau. Shared by the terrain mesh, the player and prop placement.
import { CHANNEL, POND, STATIONS, WORLD, distToChannel } from "./worldConfig";

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm(x: number, y: number, oct = 3) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return v; // ~0..1
}

function baseHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.045, z * 0.045) - 0.5) * 1.4 + (fbm(x * 0.2 + 13, z * 0.2 - 7, 2) - 0.5) * 0.25;
  // the plateau rises gently to the north (terraces sit on this slope)
  h += smoothstep(-16, -48, z) * 2.2;
  // escarpment ring
  const e = smoothstep(WORLD.radius - 1, WORLD.radius + 14, r);
  h += e * e * 16 + e * (fbm(x * 0.12, z * 0.12) - 0.3) * 6;
  return h;
}

const flatCache = STATIONS.filter((s) => s.flatR > 0).map((s) => ({
  x: s.pos[0],
  z: s.pos[1],
  r: s.flatR,
  h: baseHeight(s.pos[0], s.pos[1]),
}));

export function heightAt(x: number, z: number): number {
  let h = baseHeight(x, z);
  for (const f of flatCache) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.6) {
      const k = 1 - smoothstep(f.r * 0.7, f.r * 1.6, d);
      h = h + (f.h - h) * k;
    }
  }
  // dry runoff channel
  const dc = distToChannel(x, z);
  if (dc < 3) h -= (1 - smoothstep(0.2, 2.6, dc)) * 0.75;
  // waterhole basin
  const dp = Math.hypot(x - POND.x, z - POND.z);
  if (dp < POND.r + 3) h -= (1 - smoothstep(POND.r * 0.3, POND.r + 2.5, dp)) * 1.3;
  return h;
}

export type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const C = {
  laterite: hex("#a35c40"),
  lateriteLight: hex("#b97a5a"),
  lateriteDark: hex("#7a4230"),
  gravel: hex("#a48670"),
  dryGrass: hex("#bba05e"),
  channel: hex("#6e2e1b"),
  channelBed: hex("#c98a5a"),
  cliff: hex("#8a4630"),
  cliffTop: hex("#9d6b45"),
  pond: hex("#5d4a3a"),
};

export function colorAt(x: number, z: number, h: number): RGB {
  const n1 = fbm(x * 0.08 + 31, z * 0.08 - 11);
  const n2 = fbm(x * 0.3 - 5, z * 0.3 + 9, 2);
  let c = mix(C.lateriteDark, C.lateriteLight, smoothstep(0.25, 0.75, n1));
  c = mix(c, C.laterite, 0.35);
  // gravel patches
  c = mix(c, C.gravel, smoothstep(0.62, 0.8, n2) * 0.6);
  // dry grass patches
  const g = fbm(x * 0.06 - 40, z * 0.06 + 22);
  c = mix(c, C.dryGrass, smoothstep(0.58, 0.75, g) * 0.55);
  // channel
  const dc = distToChannel(x, z);
  if (dc < 3) {
    c = mix(c, C.channel, (1 - smoothstep(0.8, 2.8, dc)) * 0.8);
    c = mix(c, C.channelBed, (1 - smoothstep(0, 0.7, dc)) * 0.5);
  }
  // erosion fan below the channel exit near the gully
  const dp = Math.hypot(x - POND.x, z - POND.z);
  if (dp < POND.r + 2) c = mix(c, C.pond, 1 - smoothstep(POND.r - 1, POND.r + 2, dp));
  // escarpment
  const r = Math.hypot(x, z);
  const e = smoothstep(WORLD.radius + 1, WORLD.radius + 9, r);
  c = mix(c, C.cliff, e);
  c = mix(c, C.cliffTop, smoothstep(WORLD.radius + 10, WORLD.radius + 20, r) * 0.7);
  // subtle per-vertex jitter for the low-poly look
  const j = (hash(x * 3.1, z * 2.7) - 0.5) * 0.06 + (h > 0 ? 0 : h * 0.02);
  return [c[0] + j, c[1] + j * 0.8, c[2] + j * 0.6];
}

export { CHANNEL };
