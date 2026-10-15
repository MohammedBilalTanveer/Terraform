// Circle colliders on a coarse spatial grid. The player is pushed out of circles (slides along them)
// and kept inside the walkable radius, which is visually bounded by the escarpment, rocks and trees.
import { WORLD } from "./worldConfig";

export type Collider = { x: number; z: number; r: number };

const CELL = 6;
const grid = new Map<string, Collider[]>();
const key = (cx: number, cz: number) => `${cx},${cz}`;

export function clearColliders() {
  grid.clear();
}

export function addCollider(c: Collider) {
  const minX = Math.floor((c.x - c.r) / CELL);
  const maxX = Math.floor((c.x + c.r) / CELL);
  const minZ = Math.floor((c.z - c.r) / CELL);
  const maxZ = Math.floor((c.z + c.r) / CELL);
  for (let i = minX; i <= maxX; i++)
    for (let j = minZ; j <= maxZ; j++) {
      const k = key(i, j);
      const arr = grid.get(k);
      if (arr) arr.push(c);
      else grid.set(k, [c]);
    }
}

export function addColliders(list: Collider[]) {
  for (const c of list) addCollider(c);
}

/** Resolve a desired position against all colliders. Returns the corrected position. */
export function resolve(x: number, z: number, radius = WORLD.playerRadius): [number, number] {
  for (let iter = 0; iter < 3; iter++) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let moved = false;
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cz - 1; j <= cz + 1; j++) {
        const arr = grid.get(key(i, j));
        if (!arr) continue;
        for (const c of arr) {
          const dx = x - c.x;
          const dz = z - c.z;
          const min = c.r + radius;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.0001;
            const push = min - d;
            x += (dx / d) * push;
            z += (dz / d) * push;
            moved = true;
          }
        }
      }
    if (!moved) break;
  }
  const r = Math.hypot(x, z);
  const max = WORLD.radius - 0.5;
  if (r > max) {
    x = (x / r) * max;
    z = (z / r) * max;
  }
  return [x, z];
}
