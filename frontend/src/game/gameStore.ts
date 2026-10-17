// Explorer-only presentation state (player, overlays, animations). Everything that matters for the
// farming workflow stays in the shared terraform store; this is just the game's "view model".
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StationId } from "./worldConfig";
import { SPAWN } from "./worldConfig";

export type ActionKind = "inspect" | "dig" | "stones" | "compost" | "sow" | "water" | "harvest";
export type OverlayId = StationId | "menu" | "ask" | "map";

export type ActiveAction = {
  kind: ActionKind;
  label: string;
  station: StationId | null;
  start: number;
  duration: number;
};

/** Per-session farm presentation (keyed by session id so a reset session starts fresh). */
export type FarmView = { key: string | null; sown: boolean; careIdx: number; careDone?: boolean; timeSeen?: boolean; echoSeen?: boolean; skipChecks?: boolean; regenIdx?: number; harvested: boolean };

/** Mutable per-frame player state (not reactive — read inside useFrame / rAF). */
export const playerState = { x: SPAWN[0], z: SPAWN[1], y: 0, rot: Math.PI, speed: 0, vx: 0, vz: 0, /** performance.now() of the last teleport — camera + TERRA snap instead of gliding */ teleportedAt: 0 };
/** Mobile joystick vector (-1..1). */
export const joystick = { x: 0, z: 0, active: false, sprint: false };

export type TouchMode = "auto" | "show" | "hide";
export type Bubble = { text: string; until: number };
/** what the player just completed — shown as TERRA's completion message when the station panel reopens */
export type LastDone = { id: string; label: string; station: StationId; phase: string; sessionKey: string | null; note?: string };

type GameState = {
  overlay: OverlayId | null;
  /** timestamp of the last map teleport (drives the quick fade) */
  teleportFx: number;
  nearStation: StationId | null;
  area: StationId | null;
  action: ActiveAction | null;
  targetOverride: StationId | null;
  zoom: number;
  showHelp: boolean;
  farm: FarmView;
  interactPulse: number;
  touchMode: TouchMode;
  /** task the user picked in the quest list — its station panel scrolls to + highlights it */
  focusTaskId: string | null;
  /** last open tab per station panel */
  lastTab: Record<string, string>;
  bubble: Bubble | null;
  /** ask the Plot panel to open on a tab (e.g. "crops" / "gate"); consumed by PlotPanel */
  forceTab: string | null;
  /** quest step pinned by the player (quest list / "Go there"); the beacon stays on it until it is done */
  pinnedId: string | null;
  /** optional offers the player said "Skip for now" to (this session) */
  declinedOptional: string[];
  lastDone: LastDone | null;
  /** quest step id for which the beacon was switched off ("stop guiding") */
  beaconOff: string | null;

  setOverlay: (o: OverlayId | null) => void;
  setNear: (s: StationId | null) => void;
  setArea: (s: StationId | null) => void;
  setTargetOverride: (s: StationId | null) => void;
  setZoom: (z: number) => void;
  setShowHelp: (v: boolean) => void;
  pulseInteract: () => void;
  runAction: (a: { kind: ActionKind; label: string; station: StationId | null; fast?: boolean }, onDone?: () => void | Promise<void>) => boolean;
  updateFarm: (key: string | null, patch: Partial<Omit<FarmView, "key">>) => void;
  setTouchMode: (m: TouchMode) => void;
  setFocusTask: (id: string | null) => void;
  setLastTab: (station: string, tab: string) => void;
  say: (text: string, ms?: number) => void;
  setForceTab: (t: string | null) => void;
  setPinned: (id: string | null) => void;
  declineOptional: (id: string) => void;
  setLastDone: (d: LastDone | null) => void;
  setBeaconOff: (id: string | null) => void;
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      overlay: null,
      teleportFx: 0,
      nearStation: null,
      area: null,
      action: null,
      targetOverride: null,
      zoom: 1,
      showHelp: true,
      farm: { key: null, sown: false, careIdx: 0, careDone: false, harvested: false },
      interactPulse: 0,
      touchMode: "auto",
      focusTaskId: null,
      lastTab: {},
      bubble: null,
      forceTab: null,
      pinnedId: null,
      declinedOptional: [],
      lastDone: null,
      beaconOff: null,

      // closing a panel also dismisses any pending completion message
      setOverlay: (overlay) => set(overlay === null ? { overlay, lastDone: null } : { overlay }),
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
      setForceTab: (forceTab) => set({ forceTab }),
      setPinned: (pinnedId) => set({ pinnedId, beaconOff: null, targetOverride: null }),
      declineOptional: (id) => set({ declinedOptional: [...get().declinedOptional.filter((x) => x !== id), id] }),
      setLastDone: (lastDone) => set(lastDone && get().pinnedId === lastDone.id ? { lastDone, targetOverride: null, pinnedId: null } : { lastDone, targetOverride: null }),
      setBeaconOff: (beaconOff) => set({ beaconOff }),
      setTouchMode: (touchMode) => set({ touchMode }),
      setFocusTask: (focusTaskId) => set({ focusTaskId }),
      setLastTab: (station, tab) => set({ lastTab: { ...get().lastTab, [station]: tab } }),
      say: (text, ms = 8000) => set({ bubble: { text, until: Date.now() + ms } }),
      updateFarm: (key, patch) => {
        const cur = get().farm;
        const base: FarmView = cur.key === key ? cur : { key, sown: false, careIdx: 0, careDone: false, harvested: false };
        set({ farm: { ...base, ...patch, key } });
      },
    }),
    {
      name: "terraform-explorer-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ zoom: s.zoom, showHelp: s.showHelp, farm: s.farm, touchMode: s.touchMode, lastTab: s.lastTab }),
    },
  ),
);

/** Farm view for the current session (fresh defaults when the session changed). */
export function farmFor(farm: FarmView, key: string | null): FarmView {
  return farm.key === key ? farm : { key, sown: false, careIdx: 0, careDone: false, harvested: false };
}
