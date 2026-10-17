// 3D Explorer — a second presentation of the SAME session state as the Dashboard.
// The world renders store data; every advice panel shows API text + KB evidence IDs.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useTerraform } from "../store/terraformStore";
import EvidenceDrawer from "../components/EvidenceDrawer";
import Toasts from "../components/Toasts";
import WorldScene from "./WorldScene";
import PlayerController from "./PlayerController";
import FollowCamera from "./FollowCamera";
import RobotGuide from "./RobotGuide";
import WorldHUD from "./WorldHUD";
import { addColliders, clearColliders } from "./collision";
import { getScatter } from "./scatter";
import { STATION_COLLIDERS } from "./StationProps";
import { farmFor, playerState, useGame } from "./gameStore";
import { clearKeys, installKeyboard, isTypingTarget } from "./input";
import { guidance } from "./planData";
import { SPAWN, stationById, type StationId } from "./worldConfig";
import { preloadModels } from "./assets";
import ObservationPanel from "./ui/ObservationPanel";
import SoilPanel from "./ui/SoilPanel";
import WorldMap from "./WorldMap";
import StationPanel from "./ui/StationPanel";
import PlotWizard from "./ui/PlotWizard";
import { CampPanel, GrovePanel, OutpostPanel, PlaceChecksPanel, SoilStation } from "./ui/PlacePanels";
import { useTouchVisible } from "./TouchControls";
import { dprFor, useViewport } from "./useViewport";
import { cx } from "./ui/kit";
import "./game.css";
import StationCards from "./ui/StationCards";
import HarvestPanel from "./ui/HarvestPanel";
import AskPanel from "./ui/AskPanel";

preloadModels(["player", "treePlateau", "rockLargeA", "grass", "barrel", "tentNature"]);

/** Fade-in veil shown while the world loads; it also swallows clicks for the first moments
 * after entering so a double-click on the intro's last button can't hit a HUD button. */
function EnterVeil({ armed }: { armed: boolean }) {
  const { active, progress } = useProgress();
  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMinDone(true), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const [finished, setFinished] = useState(false);
  const show = !finished && (!armed || !minDone || (active && progress < 100));
  useEffect(() => {
    if (!show && !finished) setFinished(true); // latch: later lazy model loads never bring the veil back
  }, [show, finished]);
  useEffect(() => {
    const t = window.setTimeout(() => setFinished(true), 9000); // never block the world for long
    return () => window.clearTimeout(t);
  }, []);
  // Fade out with a plain CSS transition and unmount from a timer (not from animation frames), so the
  // veil can never stay stuck on a device or pane that throttles requestAnimationFrame.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (show) return;
    const t = window.setTimeout(() => setGone(true), 700);
    return () => window.clearTimeout(t);
  }, [show]);
  if (gone) return null;
  return (
    <div
      className="absolute inset-0 z-[60] grid place-items-center bg-[#1a0d08] transition-opacity duration-500"
      style={{ opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center">
        <div className="font-display text-[12px] tracking-[0.4em] text-amber-200/90">ENTERING THE VALLEY…</div>
        <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-cyan-300 transition-all" style={{ width: `${active ? Math.max(8, progress) : 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function LoadingVeil() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center pb-24">
      <div className="rounded-full border border-cyan-300/30 bg-[#070b1a]/80 px-4 py-1.5 font-display text-[10px] tracking-[0.3em] text-cyan-100">
        LOADING WORLD {Math.round(progress)}%
      </div>
    </div>
  );
}

function Overlay({ id, onClose, target }: { id: StationId | "ask" | "map"; onClose: () => void; target: StationId | null }) {
  switch (id) {
    case "map":
      return <WorldMap onClose={onClose} target={target} />;
    case "board":
      return <ObservationPanel onClose={onClose} />;
    case "soil":
      return <SoilStation onClose={onClose} />;
    case "gully":
    case "waterhole":
      return <PlaceChecksPanel station={id} onClose={onClose} />;
    case "grove":
      return <GrovePanel onClose={onClose} />;
    case "camp":
      return <CampPanel onClose={onClose} />;
    case "plot":
      return <PlotWizard onClose={onClose} />;
    case "harvest":
      return <HarvestPanel onClose={onClose} />;
    case "ask":
      return <AskPanel onClose={onClose} />;
    case "terraces":
    case "compost":
    case "water":
      return <StationCards station={id} onClose={onClose} />;
    case "outpost":
      return <OutpostPanel onClose={onClose} />;
    default:
      return null;
  }
}

export default function ExplorerPage() {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const crop = useTerraform((s) => s.selectedCropId);
  const backendOnline = useTerraform((s) => s.backendOnline);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const sessionId = useTerraform((s) => s.sessionId);
  const farm = farmFor(useGame((s) => s.farm), sessionId);
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  const override = useGame((s) => s.targetOverride);
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const pinnedId = useGame((s) => s.pinnedId);
  const beaconOff = useGame((s) => s.beaconOff);
  const area = useGame((s) => s.area);
  const gateResults = useTerraform((s) => s.gateResults);
  const checkOutcomes = useTerraform((s) => s.checkOutcomes);
  const unableChecks = useTerraform((s) => s.unableChecks);
  const pulse = useGame((s) => s.interactPulse);
  const vp = useViewport();
  const touchOn = useTouchVisible();
  const bubble = useGame((s) => s.bubble);
  // TERRA's temporary line (e.g. "Head to <station> — <task>") expires on its own
  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => useGame.setState({ bubble: null }), Math.max(0, bubble.until - Date.now()));
    return () => window.clearTimeout(t);
  }, [bubble]);

  // input guard: ignore HUD clicks + E/Enter/Esc for a moment after entering the Explorer
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      armedRef.current = true;
      setArmed(true);
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  const g = useMemo(
    () => guidance({ backendOnline, analysis, plan, completed, selectedCropId: crop, farm, pinnedId, gateResults, checkOutcomes, unableChecks }),
    [backendOnline, analysis, plan, completed, crop, farm, pinnedId, gateResults, checkOutcomes, unableChecks],
  );
  // The beacon follows the QUEST TASK's station and never moves on arrival — only when that task is
  // completed (or the player pins another one / stops guiding).
  const questId = g.quest?.id ?? null;
  const target = beaconOff && beaconOff === questId ? null : override ?? g.target;

  // a manual "guide me to …" override lives only until the quest task changes; stale quest state never
  // leaks across sessions
  const lastQuest = useRef<string | null>(questId);
  useEffect(() => {
    if (lastQuest.current !== questId) {
      lastQuest.current = questId;
      const st = useGame.getState();
      if (st.targetOverride) st.setTargetOverride(null);
      if (st.beaconOff) st.setBeaconOff(null);
    }
  }, [questId]);
  const lastSession = useRef(sessionId);
  useEffect(() => {
    if (lastSession.current === sessionId) return;
    lastSession.current = sessionId;
    const st = useGame.getState();
    st.setPinned(null);
    st.setLastDone(null);
  }, [sessionId]);

  // world setup: colliders + keyboard
  useEffect(() => {
    clearColliders();
    addColliders(getScatter().colliders);
    addColliders(STATION_COLLIDERS);
    if (!Number.isFinite(playerState.x) || Math.hypot(playerState.x, playerState.z) > 70) {
      playerState.x = SPAWN[0];
      playerState.z = SPAWN[1];
    }
    const off = installKeyboard();
    return () => {
      off();
      clearKeys();
      useGame.getState().setOverlay(null);
    };
  }, []);

  const interact = useCallback((id: StationId) => {
    const game = useGame.getState();
    if (game.action || game.overlay) return;
    clearKeys();
    const st = useTerraform.getState();
    if ((id === "soil" || id === "gully") && st.analysis) {
      game.runAction({ kind: "inspect", label: id === "soil" ? "Inspecting the soil" : "Surveying the runoff", station: id, fast: st.reduceMotion }, () =>
        useGame.getState().setOverlay(id),
      );
      return;
    }
    game.setOverlay(id);
  }, []);

  // touch / HUD interact button
  const firstPulse = useRef(pulse);
  useEffect(() => {
    if (pulse === firstPulse.current || !armedRef.current) return;
    const near = useGame.getState().nearStation;
    if (near) interact(near);
  }, [pulse, interact]);

  // keyboard: E/Enter interact, Esc closes or opens menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!armedRef.current) return;
      const game = useGame.getState();
      if (e.key === "Escape") {
        if (useTerraform.getState().evidenceKbId) return; // the evidence drawer handles its own Esc
        e.preventDefault();
        if (isTypingTarget(e.target)) (e.target as HTMLElement).blur();
        game.setOverlay(game.overlay ? null : "menu");
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.code === "KeyM" && !e.repeat && !game.action) {
        e.preventDefault();
        game.setOverlay(game.overlay === "map" ? null : game.overlay ? game.overlay : "map");
        return;
      }
      if (e.code === "KeyE" || (e.key === "Enter" && !(e.target instanceof HTMLButtonElement))) {
        if (!game.overlay && game.nearStation) {
          e.preventDefault();
          interact(game.nearStation);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interact]);

  // arriving at the quest station only changes TERRA's line — never the beacon
  const arrivalLine =
    g.quest && !override && area && area === g.quest.station && target === g.quest.station
      ? `You're at ${stationById(area).name}. Press E — ${g.quest.label}`
      : null;

  const closeOverlay = useCallback(() => setOverlay(null), [setOverlay]);

  return (
    <div className={cx("tf-game fixed inset-0 overflow-hidden bg-[#2a1610] font-sans text-ivory", touchOn && "tf-touch")}>
      <Canvas
        style={{ touchAction: "none" }}
        shadows
        dpr={dprFor(vp)}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 42, near: 0.3, far: 520, position: [SPAWN[0], 14, SPAWN[1] + 13] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        aria-label="TERRAFORM 3D explorer world"
      >
        <Suspense fallback={null}>
          <WorldScene follow={playerState} reduceMotion={reduceMotion} />
          <PlayerController enabled={!overlay} />
          <RobotGuide target={target} line={bubble && bubble.until > Date.now() ? bubble.text : arrivalLine ?? g.lines[0] ?? ""} reduceMotion={reduceMotion} showBubble={!overlay && !vp.short && !touchOn} />
        </Suspense>
        <FollowCamera />
      </Canvas>
      <WorldHUD g={g} target={target} />
      {overlay && overlay !== "menu" && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <Overlay id={overlay} onClose={closeOverlay} target={target} />
        </div>
      )}
      <LoadingVeil />
      <EnterVeil armed={armed} />
      <EvidenceDrawer />
      <Toasts />
    </div>
  );
}
