// Teleport the player to a map location. Pure presentation logic: picks a free spot beside the station
// (inside its "Press E" range) so the player never lands inside a prop, then snaps camera + TERRA.
import { resolve } from "./collision";
import { playerState, useGame } from "./gameStore";
import { SPAWN, STATIONS, WORLD, stationById, type Station, type StationId } from "./worldConfig";

const free = (x: number, z: number) => {
  if (Math.hypot(x, z) > WORLD.radius - 3) return false; // stay off the escarpment
  const [rx, rz] = resolve(x, z);
  return Math.hypot(rx - x, rz - z) < 0.05;
};

/** A walkable spot next to the station, on the camp side of it where possible. */
export function findLandingSpot(s: Station): [number, number] {
  const [sx, sz] = s.pos;
  const base = Math.atan2(SPAWN[1] - sz, SPAWN[0] - sx); // from the station toward the camp
  const radii = s.interactive
    ? [s.interactR * 0.8, s.interactR * 0.92, s.interactR * 0.65, s.interactR * 0.55]
    : [s.areaR * 0.45, s.areaR * 0.3, s.areaR * 0.6];
  const steps = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6];
  for (const r of radii) {
    for (const k of steps) {
      const a = base + (k * Math.PI) / 6;
      const x = sx + Math.cos(a) * r;
      const z = sz + Math.sin(a) * r;
      if (free(x, z)) return [x, z];
    }
  }
  const [fx, fz] = resolve(sx + Math.cos(base) * radii[0], sz + Math.sin(base) * radii[0]);
  return [fx, fz];
}

export function distanceTo(id: StationId): number {
  const [sx, sz] = stationById(id).pos;
  return Math.hypot(sx - playerState.x, sz - playerState.z);
}

/** Close the map, fade for a moment, then move the player and snap the camera. */
export function teleportTo(id: StationId) {
  const s = stationById(id);
  const g = useGame.getState();
  g.setOverlay(null);
  useGame.setState({ teleportFx: Date.now() });
  window.setTimeout(() => {
    const [x, z] = findLandingSpot(s);
    playerState.x = x;
    playerState.z = z;
    playerState.vx = 0;
    playerState.vz = 0;
    playerState.speed = 0;
    playerState.rot = Math.atan2(s.pos[0] - x, s.pos[1] - z); // face the station
    playerState.teleportedAt = performance.now();
    useGame.getState().say(s.interactive ? `You're at ${s.name}. Press E — ${s.verb.toLowerCase()}.` : `You're at ${s.name}.`, 5000);
  }, 170); // timer (not rAF) so it also fires in throttled tabs
}

export const MAP_STATIONS = STATIONS;
