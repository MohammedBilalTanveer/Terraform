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
import { SPAWN, type StationId } from "./worldConfig";
import { preloadModels } from "./assets";
import ObservationPanel from "./ui/ObservationPanel";
import SoilPanel from "./ui/SoilPanel";
import StationPanel from "./ui/StationPanel";
import PlotPanel from "./ui/PlotPanel";
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
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="veil"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          className="absolute inset-0 z-[60] grid place-items-center bg-[#1a0d08]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="font-display text-[12px] tracking-[0.4em] text-amber-200/90">ENTERING THE VALLEY…</div>
            <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-cyan-300 transition-all" style={{ width: `${active ? Math.max(8, progress) : 100}%` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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

function Overlay({ id, onClose }: { id: StationId | "ask"; onClose: () => void }) {
  switch (id) {
    case "board":
      return <ObservationPanel onClose={onClose} />;
    case "soil":
      return <SoilPanel onClose={onClose} />;
    case "gully":
      return <SoilPanel onClose={onClose} mode="gully" />;
    case "plot":
      return <PlotPanel onClose={onClose} />;
    case "harvest":
      return <HarvestPanel onClose={onClose} />;
    case "ask":
    case "camp":
      return <AskPanel onClose={onClose} />;
    case "terraces":
    case "compost":
    case "water":
    case "outpost":
      return <StationPanel station={id} onClose={onClose} />;
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
  const pulse = useGame((s) => s.interactPulse);

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
    () => guidance({ backendOnline, analysis, plan, completed, selectedCropId: crop, farm }),
    [backendOnline, analysis, plan, completed, crop, farm],
  );
  const target = override ?? g.target;

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

  // reaching the overridden target clears the override
  useEffect(() => {
    const t = window.setInterval(() => {
      const o = useGame.getState().targetOverride;
      const area = useGame.getState().area;
      if (o && area === o) setTargetOverride(null);
    }, 500);
    return () => window.clearInterval(t);
  }, [setTargetOverride]);

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

  const closeOverlay = useCallback(() => setOverlay(null), [setOverlay]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#2a1610] font-sans text-ivory">
      <Canvas
        shadows
        dpr={[1, 1.5]}
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
          <RobotGuide target={target} line={g.lines[0] ?? ""} reduceMotion={reduceMotion} showBubble={!overlay} />
        </Suspense>
        <FollowCamera />
      </Canvas>
      <WorldHUD g={g} />
      {overlay && overlay !== "menu" && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <Overlay id={overlay} onClose={closeOverlay} />
        </div>
      )}
      <LoadingVeil />
      <EnterVeil armed={armed} />
      <EvidenceDrawer />
      <Toasts />
    </div>
  );
}
