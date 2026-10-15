// Explorer-only presentation state (player, overlays, animations). Everything that matters for the
// farming workflow stays in the shared terraform store; this is just the game's "view model".
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StationId } from "./worldConfig";
import { SPAWN } from "./worldConfig";

export type ActionKind = "inspect" | "dig" | "stones" | "compost" | "sow" | "water" | "harvest";
export type OverlayId = StationId | "menu" | "ask";

export type ActiveAction = {
  kind: ActionKind;
  label: string;
  station: StationId | null;
  start: number;
  duration: number;
};

/** Per-session farm presentation (keyed by session id so a reset session starts fresh). */
export type FarmView = { key: string | null; sown: boolean; careIdx: number; harvested: boolean };

/** Mutable per-frame player state (not reactive — read inside useFrame / rAF). */
export const playerState = { x: SPAWN[0], z: SPAWN[1], y: 0, rot: Math.PI, speed: 0, vx: 0, vz: 0 };
/** Mobile joystick vector (-1..1). */
export const joystick = { x: 0, z: 0, active: false };

type GameState = {
  overlay: OverlayId | null;
  nearStation: StationId | null;
  area: StationId | null;
  action: ActiveAction | null;
  targetOverride: StationId | null;
  zoom: number;
  showHelp: boolean;
  farm: FarmView;
  interactPulse: number;

  setOverlay: (o: OverlayId | null) => void;
  setNear: (s: StationId | null) => void;
  setArea: (s: StationId | null) => void;
  setTargetOverride: (s: StationId | null) => void;
  setZoom: (z: number) => void;
  setShowHelp: (v: boolean) => void;
  pulseInteract: () => void;
  runAction: (a: { kind: ActionKind; label: string; station: StationId | null; fast?: boolean }, onDone?: () => void | Promise<void>) => boolean;
  updateFarm: (key: string | null, patch: Partial<Omit<FarmView, "key">>) => void;
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      overlay: null,
      nearStation: null,
      area: null,
      action: null,
      targetOverride: null,
      zoom: 1,
      showHelp: true,
      farm: { key: null, sown: false, careIdx: 0, harvested: false },
      interactPulse: 0,

      setOverlay: (overlay) => set({ overlay }),
      setNear: (nearStation) => set({ nearStation }),
      setArea: (area) => set({ area }),
      setTargetOverride: (targetOverride) => set({ targetOverride }),
      setZoom: (zoom) => set({ zoom: Math.max(0.65, Math.min(1.9, zoom)) }),
      setShowHelp: (showHelp) => set({ showHelp }),
      pulseInteract: () => set({ interactPulse: get().interactPulse + 1 }),
      runAction: ({ kind, label, station, fast }, onDone) => {
        if (get().action) return false;
        const duration = fast ? 900 : 2600;
        set({ action: { kind, label, station, start: performance.now(), duration }, overlay: null });
        window.setTimeout(() => {
          set({ action: null });
          void onDone?.();
        }, duration);
        return true;
      },
      updateFarm: (key, patch) => {
        const cur = get().farm;
        const base: FarmView = cur.key === key ? cur : { key, sown: false, careIdx: 0, harvested: false };
        set({ farm: { ...base, ...patch, key } });
      },
    }),
    {
      name: "terraform-explorer-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ zoom: s.zoom, showHelp: s.showHelp, farm: s.farm }),
    },
  ),
);

/** Farm view for the current session (fresh defaults when the session changed). */
export function farmFor(farm: FarmView, key: string | null): FarmView {
  return farm.key === key ? farm : { key, sown: false, careIdx: 0, harvested: false };
}
