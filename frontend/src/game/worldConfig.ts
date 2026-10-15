// World layout for the Explorer. Pure presentation data: names, coordinates, colliders, prop scatter.
// No agricultural content lives here — stations only declare which workflow steps they *display*.
import type { StepId } from "../types/terraform";

export const WORLD = {
  /** Walkable radius; beyond it the land rises into an escarpment. */
  radius: 60,
  size: 230,
  segments: 140,
  playerRadius: 0.38,
};

export type StationId =
  | "camp"
  | "board"
  | "soil"
  | "plot"
  | "compost"
  | "water"
  | "terraces"
  | "gully"
  | "outpost"
  | "harvest"
  | "grove"
  | "waterhole";

export type Station = {
  id: StationId;
  name: string;
  pos: [number, number];
  /** Distance at which "Press E" appears. */
  interactR: number;
  /** Area radius for the location toast + minimap ring. */
  areaR: number;
  /** Ground flattening radius (0 = none). */
  flatR: number;
  interactive: boolean;
  verb: string;
  steps: StepId[];
  color: string;
};

export const STATIONS: Station[] = [
  { id: "camp", name: "Survivor Camp", pos: [0, 11], interactR: 3, areaR: 7, flatR: 7, interactive: true, verb: "Sit by the fire — ask TERRA", steps: [], color: "#f6c177" },
  { id: "board", name: "Observation Board", pos: [7, 3], interactR: 2.6, areaR: 4, flatR: 4, interactive: true, verb: "Log what you observe", steps: ["observation_log"], color: "#38e1ff" },
  { id: "soil", name: "Soil Inspection Patch", pos: [-7, 0], interactR: 3, areaR: 4.5, flatR: 5, interactive: true, verb: "Inspect the soil", steps: ["input_echo", "missing_analysis"], color: "#e07a5f" },
  { id: "plot", name: "Unknown Land — Cultivation Plot", pos: [0, -13], interactR: 5.2, areaR: 7, flatR: 8, interactive: true, verb: "Work the plot", steps: ["next_action", "crop_suggestions", "timeframe", "planting_method", "ongoing_care"], color: "#7bd389" },
  { id: "compost", name: "Compost & Mulch Station", pos: [12, -8], interactR: 3, areaR: 5, flatR: 5, interactive: true, verb: "Build soil", steps: ["fix_protocol"], color: "#c08552" },
  { id: "water", name: "Water Storage", pos: [-13, -10], interactR: 3, areaR: 5, flatR: 5, interactive: true, verb: "Check water capture", steps: ["fix_protocol", "ongoing_care"], color: "#5ab8e8" },
  { id: "harvest", name: "Harvest Point", pos: [10, -22], interactR: 3, areaR: 4.5, flatR: 5, interactive: true, verb: "Open harvest point", steps: ["harvest"], color: "#f6c177" },
  { id: "terraces", name: "Stone-Line Terraces", pos: [-8, -32], interactR: 5, areaR: 10, flatR: 0, interactive: true, verb: "Lay stone lines", steps: ["fix_protocol", "planting_method"], color: "#b5a48b" },
  { id: "gully", name: "Runoff Gully", pos: [22, -30], interactR: 4, areaR: 9, flatR: 0, interactive: true, verb: "Survey the runoff", steps: ["missing_analysis"], color: "#b5523b" },
  { id: "outpost", name: "Research Outpost", pos: [27, 6], interactR: 3.2, areaR: 10, flatR: 11, interactive: true, verb: "Open field terminal", steps: [], color: "#8b5cf6" },
  { id: "grove", name: "Old Cashew Grove Lookout", pos: [-33, 15], interactR: 0, areaR: 11, flatR: 0, interactive: false, verb: "", steps: [], color: "#9bbf6a" },
  { id: "waterhole", name: "Waterhole", pos: [-31, -24], interactR: 0, areaR: 8, flatR: 0, interactive: false, verb: "", steps: [], color: "#5ab8e8" },
];

export const stationById = (id: StationId) => STATIONS.find((s) => s.id === id)!;

export const SPAWN: [number, number] = [1.5, 8.5];
export const POND = { x: -31, z: -24, r: 5.5 };

/** Dry runoff channel polyline (x, z) — enters from the north escarpment and exits east. */
export const CHANNEL: [number, number][] = [
  [30, -66],
  [26, -46],
  [21, -32],
  [22, -20],
  [29, -9],
  [40, 0],
  [52, 8],
  [70, 12],
];

/** Contour lines for the stone-line terraces (relative to the terraces station). */
export const TERRACE_LINES: { z: number; half: number }[] = [
  { z: 3, half: 7 },
  { z: 0, half: 7.5 },
  { z: -3, half: 7 },
  { z: -6, half: 6 },
];

// ---------------------------------------------------------------------------------------------
// Seeded RNG so the scatter is stable between reloads (and between intro and explorer).
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distToChannel(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < CHANNEL.length - 1; i++) {
    const [ax, az] = CHANNEL[i];
    const [bx, bz] = CHANNEL[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    best = Math.min(best, Math.hypot(px, pz));
  }
  return best;
}

/** True if a prop at (x,z) with radius r would crowd a station, the pond, the channel or the spawn. */
export function isReserved(x: number, z: number, r = 0): boolean {
  for (const s of STATIONS) {
    const keep = s.id === "grove" ? 0 : s.id === "terraces" ? 9 : s.id === "gully" ? 3 : Math.max(s.flatR, 3.5) + 1;
    if (Math.hypot(x - s.pos[0], z - s.pos[1]) < keep + r) return true;
  }
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5 + r) return true;
  if (distToChannel(x, z) < 2.2 + r) return true;
  // keep the walking corridor between camp and the plot open
  if (Math.abs(x) < 3 && z > -8 && z < 9) return true;
  return false;
}
