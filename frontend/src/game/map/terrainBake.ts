// Bakes the real 3D terrain (height + colour fields from terrain.ts) into ONE small bitmap: laterite colour,
// hillshade, contour lines, grain, escarpment and fog. It runs once, in small time slices, and is drawn as a
// single <image> — so the live map stays cheap on integrated GPUs (no filters, no huge SVG).
import { colorAt, heightAt, smoothstep } from "../terrain";
import { WORLD } from "../worldConfig";
import { EXTENT } from "./mapGeo";

const PPM = 2.2; // pixels per metre
const FOG: [number, number, number] = [9, 15, 33];

let url: string | null = null;
let job: Promise<string> | null = null;

export const bakedTerrainUrl = () => url;

function* work(out: (u: string) => void): Generator<void> {
  const N = Math.round(EXTENT * 2 * PPM);
  const M = N + 2;
  const hs = new Float32Array(M * M);
  const at = (i: number, j: number) => hs[(j + 1) * M + (i + 1)];
  const wx = (i: number) => -EXTENT + (i + 0.5) / PPM;
  for (let j = -1; j <= N; j++) {
    for (let i = -1; i <= N; i++) hs[(j + 1) * M + (i + 1)] = heightAt(wx(i), wx(j));
    if (j % 24 === 0) yield;
  }
  const canvas = document.createElement("canvas");
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const inv = 1 / (2 / PPM);
  // light from the north-west, slightly exaggerated relief
  const L = [-0.55, 0.78, -0.45];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const flat = L[1] / ll;
  const K = 2.1;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = wx(i);
      const z = wx(j);
      const h = at(i, j);
      const dx = (at(i + 1, j) - at(i - 1, j)) * inv * K;
      const dz = (at(i, j + 1) - at(i, j - 1)) * inv * K;
      const nl = Math.hypot(dx, 1, dz);
      const dot = (-dx * L[0] + 1 * L[1] + -dz * L[2]) / (nl * ll);
      const shade = Math.max(0.5, Math.min(1.55, 1 + (dot - flat) * 2.1));
      const c = colorAt(x, z, h);
      let r = c[0] * 255 * shade * 1.08;
      let g = c[1] * 255 * shade * 0.98;
      let b = c[2] * 255 * shade * 0.9;
      const rad = Math.hypot(x, z);
      // contour lines (every 0.32 height units; stronger on the escarpment)
      const lv = Math.floor(h / 0.32);
      if (lv !== Math.floor(at(i + 1, j) / 0.32) || lv !== Math.floor(at(i, j + 1) / 0.32)) {
        const k = rad > WORLD.radius + 2 ? 0.74 : 0.87;
        r *= k;
        g *= k;
        b *= k;
      }
      // fine grain
      const n = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
      const gr = 1 + n * 0.035;
      r *= gr;
      g *= gr;
      b *= gr;
      // dark fog beyond the escarpment + a soft edge vignette on the baked square
      const fog = Math.min(0.96, smoothstep(WORLD.radius + 9, WORLD.radius + 22, rad) * 0.96);
      r += (FOG[0] - r) * fog;
      g += (FOG[1] - g) * fog;
      b += (FOG[2] - b) * fog;
      const p = (j * N + i) * 4;
      d[p] = r > 255 ? 255 : r < 0 ? 0 : r;
      d[p + 1] = g > 255 ? 255 : g < 0 ? 0 : g;
      d[p + 2] = b > 255 ? 255 : b < 0 ? 0 : b;
      d[p + 3] = 255;
    }
    if (j % 16 === 0) yield;
  }
  ctx.putImageData(img, 0, 0);
  out(canvas.toDataURL("image/png"));
}

/** Starts (or joins) the bake. Resolves with a data URL of the terrain square [-EXTENT, EXTENT]². */
export function bakeTerrain(): Promise<string> {
  if (url) return Promise.resolve(url);
  if (job) return job;
  job = new Promise<string>((resolve) => {
    const g = work((u) => {
      url = u;
      resolve(u);
    });
    const slice = () => {
      const t0 = performance.now();
      for (;;) {
        const r = g.next();
        if (r.done) return;
        if (performance.now() - t0 > 7) break;
      }
      window.setTimeout(slice, 0);
    };
    slice();
  });
  return job;
}

/** Warm the cache during idle time after the game has loaded (never blocks gameplay for long). */
export function prebakeTerrainSoon(delayMs = 4000) {
  if (typeof window === "undefined" || url || job) return;
  const run = () => void bakeTerrain();
  window.setTimeout(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(run, { timeout: 10000 });
    else run();
  }, delayMs);
}
