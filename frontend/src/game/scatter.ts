// Deterministic prop scatter for the plateau (instanced) + colliders for the big props.
import type { InstanceItem, ModelKey } from "./assets";
import type { Collider } from "./collision";
import { heightAt, fbm } from "./terrain";
import { STATIONS, WORLD, distToChannel, isReserved, mulberry32, stationById } from "./worldConfig";

export type ScatterGroup = { model: ModelKey; items: InstanceItem[]; castShadow: boolean; tint?: string; tintAmount?: number };

export type Scatter = { groups: ScatterGroup[]; colliders: Collider[] };

let cached: Scatter | null = null;

export function getScatter(): Scatter {
  if (cached) return cached;
  const rnd = mulberry32(5055);
  const groups = new Map<string, ScatterGroup>();
  const colliders: Collider[] = [];
  const push = (model: ModelKey, it: InstanceItem, castShadow: boolean, tint?: string, tintAmount?: number) => {
    const k = `${model}|${tint ?? ""}`;
    let g = groups.get(k);
    if (!g) {
      g = { model, items: [], castShadow, tint, tintAmount };
      groups.set(k, g);
    }
    g.items.push(it);
  };
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const at = (x: number, z: number, scale: number, sink = 0): InstanceItem => ({ x, y: heightAt(x, z) - sink, z, rot: rnd() * Math.PI * 2, scale });
  const polar = (rMin: number, rMax: number) => {
    const a = rnd() * Math.PI * 2;
    const r = rMin + rnd() * (rMax - rMin);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };

  const interiorTrees: ModelKey[] = ["treePlateau", "treeFat", "treeThin", "treeFall", "treeSimple"];
  const borderTrees: ModelKey[] = ["treePlateau", "treeFat", "treeOak", "treeFall", "treeBlocksFall", "treeThin"];
  const bigRocks: ModelKey[] = ["rockLargeA", "rockLargeB", "rockLargeC", "rockLargeD", "rockSandA", "rockSandB", "rockSandC"];
  const tallRocks: ModelKey[] = ["rockTallA", "rockTallB", "rockTallC", "rockLargeD"];
  const smallStones: ModelKey[] = ["rockSmallA", "rockSmallB", "rockSmallC", "stoneSmallA", "stoneSmallB", "rockFlat"];
  const grasses: ModelKey[] = ["grass", "grassLarge", "grassLeafs"];
  const shrubs: ModelKey[] = ["bush", "bushSmall", "bushDetailed", "bushLarge"];

  // interior trees (sparse savanna)
  for (let n = 0, guard = 0; n < 26 && guard < 2000; guard++) {
    const [x, z] = polar(6, WORLD.radius - 6);
    if (isReserved(x, z, 1.5)) continue;
    const s = 2.6 + rnd() * 1.2;
    push(pick(interiorTrees), at(x, z, s), true);
    colliders.push({ x, z, r: 0.45 });
    n++;
  }
  // old grove
  const grove = stationById("grove").pos;
  for (let n = 0, guard = 0; n < 18 && guard < 2000; guard++) {
    const a = rnd() * Math.PI * 2;
    const r = 3.5 + rnd() * 8;
    const x = grove[0] + Math.cos(a) * r;
    const z = grove[1] + Math.sin(a) * r;
    if (Math.hypot(x, z) > WORLD.radius - 3) continue;
    const s = 3.2 + rnd() * 1.1;
    push(pick(["treeOak", "treeFat", "treePlateau"] as const), at(x, z, s), true);
    colliders.push({ x, z, r: 0.55 });
    n++;
  }
  // dense border: trees + boulders + cliff blocks so the edge reads as natural escarpment
  for (let n = 0; n < 150; n++) {
    const [x, z] = polar(WORLD.radius - 3, WORLD.radius + 16);
    const r = Math.hypot(x, z);
    if (distToChannel(x, z) < 3 && r < WORLD.radius + 4) continue;
    const s = 2.8 + rnd() * 1.6;
    push(pick(borderTrees), at(x, z, s), r < WORLD.radius + 6);
    if (r < WORLD.radius + 1.5) colliders.push({ x, z, r: 0.5 });
  }
  for (let n = 0; n < 80; n++) {
    const [x, z] = polar(WORLD.radius - 2, WORLD.radius + 8);
    const s = 3 + rnd() * 3.5;
    push(pick(tallRocks), at(x, z, s, 0.2), true);
    if (Math.hypot(x, z) < WORLD.radius + 2) colliders.push({ x, z, r: 0.38 * s });
  }
  for (let n = 0; n < 60; n++) {
    const [x, z] = polar(WORLD.radius + 3, WORLD.radius + 22);
    const s = 5 + rnd() * 5;
    push(pick(["cliffBlock", "cliffLarge"] as const), at(x, z, s, 1.5), false, "#a0583a", 0.35);
  }
  // interior boulders
  for (let n = 0, guard = 0; n < 34 && guard < 3000; guard++) {
    const [x, z] = polar(5, WORLD.radius - 4);
    if (isReserved(x, z, 1)) continue;
    const s = 1.4 + rnd() * 1.8;
    push(pick(bigRocks), at(x, z, s, 0.05), true, "#b0613f", 0.25);
    colliders.push({ x, z, r: 0.36 * s });
    n++;
  }
  // stone / gravel clusters
  for (let c = 0; c < 70; c++) {
    const [cx, cz] = polar(2, WORLD.radius - 2);
    const count = 3 + Math.floor(rnd() * 6);
    for (let i = 0; i < count; i++) {
      const x = cx + (rnd() - 0.5) * 3;
      const z = cz + (rnd() - 0.5) * 3;
      if (isReserved(x, z, -1.5) && distToChannel(x, z) > 2.5) continue;
      push(pick(smallStones), at(x, z, 1 + rnd() * 1.4), false, "#a5654a", 0.3);
    }
  }
  // pebbles along the runoff channel
  for (let n = 0; n < 140; n++) {
    const [x, z] = polar(0, WORLD.radius);
    if (distToChannel(x, z) > 1.8) continue;
    push(pick(smallStones), at(x, z, 0.8 + rnd()), false, "#c9a07a", 0.35);
  }
  // dry grass tufts, clumped by a noise field
  for (let n = 0, guard = 0; n < 520 && guard < 8000; guard++) {
    const [x, z] = polar(1, WORLD.radius + 2);
    const d = fbm(x * 0.06 - 40, z * 0.06 + 22);
    if (rnd() > d * 1.5 - 0.15) continue;
    if (isReserved(x, z, -2.5)) continue;
    push(pick(grasses), at(x, z, 1.6 + rnd() * 1.4), false, "#cdaa5c", 0.72);
    n++;
  }
  // thorny shrubs
  for (let n = 0, guard = 0; n < 80 && guard < 3000; guard++) {
    const [x, z] = polar(4, WORLD.radius - 1);
    if (isReserved(x, z, 0.5)) continue;
    const s = 2 + rnd() * 1.8;
    push(pick(shrubs), at(x, z, s), false, "#8a7a3c", 0.55);
    if (s > 3.2) colliders.push({ x, z, r: 0.3 });
    n++;
  }
  // a few cacti-like succulents near rocks for silhouette variety
  for (let n = 0, guard = 0; n < 10 && guard < 400; guard++) {
    const [x, z] = polar(10, WORLD.radius - 5);
    if (isReserved(x, z, 0.5)) continue;
    push("cactus", at(x, z, 2 + rnd()), false, "#7f8f4a", 0.3);
    n++;
  }
  // keep station footprints sane: drop anything too close to a station centre
  for (const g of groups.values()) {
    g.items = g.items.filter((it) => !STATIONS.some((s) => s.flatR > 0 && Math.hypot(it.x - s.pos[0], it.z - s.pos[1]) < Math.min(2.5, s.flatR)));
  }
  cached = { groups: [...groups.values()], colliders };
  return cached;
}
