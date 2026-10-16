// "The System Awakens" — skippable intro story (Skip button / Esc at any time).
// Street walk → hooded stranger → rigged shell game → glitch → "You lost…" → wake in the red valley → TERRA boots.
// All text here is narrative; TERRA gives no agricultural advice in the intro.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { SkipForward } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { playerState } from "../game/gameStore";
import { SPAWN } from "../game/worldConfig";
import { dprFor, useViewport } from "../game/useViewport";
import "../game/game.css";
import DialogueBox, { useTypewriter, type Choice, type Speaker } from "./Dialogue";
import ShellGame from "./ShellGame";
import GlitchOverlay, { GlitchStyles } from "./GlitchOverlay";
import StreetScene from "./StreetScene";
import ValleyScene, { type WakeStage } from "./ValleyScene";
import { preloadModels } from "../game/assets";

type Phase = "walk" | "encounter" | "game" | "taunt" | "glitch" | "black" | "wake";
type Line = { s: Speaker; t: string; choices?: Choice[]; onWake?: WakeStage };

const WALK: Line[] = [
  { s: "narrator", t: "07:42. An ordinary Monday. You're walking to college — a little late, as usual." },
  { s: "narrator", t: "Halfway down the street, someone steps out of the alley ahead." },
];
const ENCOUNTER_START: Line[] = [
  {
    s: "stranger",
    t: "Hey… got a minute? Play a little game with me.",
    choices: [
      { label: "Sure — but make it quick.", value: "sure" },
      { label: "Sorry, I'm late for class.", value: "late" },
    ],
  },
];
const ENCOUNTER_REST: Line[] = [
  { s: "stranger", t: "Three cups. One pebble. Find it, and you walk away with everything." },
  { s: "you", t: "And if I lose?" },
  { s: "stranger", t: "Then you'll find out what you wagered. Watch closely." },
];
const TAUNT: Line[] = [
  { s: "you", t: "Wait — that's not fair. It wasn't under any of them!" },
  { s: "stranger", t: "Fair? You agreed to play. Every game has a wager." },
  { s: "stranger", t: "And you wagered your world." },
];

function usePrefersReducedMotion() {
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setV(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return v;
}

function BlackCard({ reduceMotion }: { reduceMotion: boolean }) {
  const { shown, finish } = useTypewriter("You lost. The wager was your world.", 70, reduceMotion, { skipOnKey: true });
  return (
    <div onClick={finish} className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black px-5 text-center">
      <p className="max-w-[34rem] break-words font-display leading-snug tracking-[0.06em] text-ivory sm:tracking-[0.12em]" style={{ fontSize: "clamp(1.15rem, 5.2vw, 2rem)" }}>
        {shown}
      </p>
    </div>
  );
}

function BootHud({ kb }: { kb: string }) {
  const a = useTypewriter("TERRAFORM // SYSTEM AWAKENING…", 45, false, { skipOnKey: true });
  const b = useTypewriter(a.done ? `knowledge base link: ${kb}` : "", 35, false, { skipOnKey: true });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tf-boot pointer-events-none absolute z-20 font-display">
      <div className="tracking-[0.16em] text-cyan-200 drop-shadow-[0_0_10px_rgba(56,225,255,0.6)] sm:tracking-[0.28em]" style={{ fontSize: "clamp(12px, 3.4vw, 16px)" }}>{a.shown}</div>
      <div className={`mt-2 break-words font-mono ${kb === "offline" ? "text-rose-300" : "text-emerald-300"}`} style={{ fontSize: "clamp(12px, 3.2vw, 13px)" }}>{b.shown}</div>
      <div className="mt-3 h-px w-[min(14rem,60vw)] bg-gradient-to-r from-cyan-300/70 to-transparent" />
      <div className="mt-2 font-sans text-[12px] text-ivory/60">KB-only mode · answers come only from the knowledge base</div>
    </motion.div>
  );
}

export default function IntroCinematic() {
  const setMode = useTerraform((s) => s.setMode);
  const setIntroSeen = useTerraform((s) => s.setIntroSeen);
  const storeReduce = useTerraform((s) => s.reduceMotion);
  const health = useTerraform((s) => s.health);
  const online = useTerraform((s) => s.backendOnline);
  const vp = useViewport();
  const prefersReduced = usePrefersReducedMotion();
  const reduceMotion = storeReduce || !!prefersReduced;
  const kb = online && health?.kb_version ? `v${health.kb_version} · ${health.kb_record_count} records` : online === false ? "offline" : health?.kb_version ? `v${health.kb_version}` : "offline";

  const [phase, setPhase] = useState<Phase>("walk");
  const [queue, setQueue] = useState<Line[]>(WALK);
  const [idx, setIdx] = useState(0);
  const [wake, setWake] = useState<WakeStage>("lying");

  const finish = useCallback(() => {
    playerState.x = SPAWN[0];
    playerState.z = SPAWN[1];
    playerState.vx = 0;
    playerState.vz = 0;
    playerState.rot = Math.PI;
    setIntroSeen(true);
    setMode("explorer");
  }, [setIntroSeen, setMode]);

  // Prefetch the Explorer chunk + key models so the hand-off after the intro is instant.
  useEffect(() => {
    void import("../game/ExplorerPage");
    preloadModels(["player", "treePlateau", "treeFat", "rockLargeA", "grass", "grassLarge", "barrel", "tentNature", "houseD", "bush"]);
  }, []);

  // Esc skips at any time
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  const go = useCallback((p: Phase, lines: Line[] = []) => {
    setPhase(p);
    setQueue(lines);
    setIdx(0);
  }, []);

  const wakeLines: Line[] = useMemo(
    () => [
      { s: "narrator", t: "Heat on your face. Red dust in your mouth. The street is gone." },
      { s: "terra", t: "Survivor detected. Vital signs stable. Hello — I'm TERRA, a field unit.", onWake: "boot" },
      { s: "terra", t: "I can only speak from my knowledge base. If something isn't in it, I'll tell you — I won't guess.", onWake: "standing" },
      {
        s: "terra",
        t: "This plateau is unknown land. Let's start by observing it — the Observation Board is just ahead.",
        choices: [{ label: "Begin exploring ▸", value: "begin" }],
      },
    ],
    [],
  );

  // timed phases
  useEffect(() => {
    if (phase === "glitch") {
      const t = window.setTimeout(() => go("black"), reduceMotion ? 1600 : 2500);
      return () => window.clearTimeout(t);
    }
    if (phase === "black") {
      const t = window.setTimeout(() => go("wake", wakeLines), 4800);
      return () => window.clearTimeout(t);
    }
  }, [phase, go, reduceMotion, wakeLines]);

  const line = queue[idx];
  useEffect(() => {
    if (phase === "wake" && line?.onWake) setWake(line.onWake);
  }, [phase, line]);

  const next = useCallback(() => {
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      return;
    }
    if (phase === "walk") go("encounter", ENCOUNTER_START);
    else if (phase === "encounter") go("game");
    else if (phase === "taunt") go("glitch");
  }, [idx, queue.length, phase, go]);

  const choose = useCallback(
    (v: string) => {
      if (v === "begin") return finish();
      const reply: Line[] =
        v === "late"
          ? [
              { s: "you", t: "Sorry, I'm late for class." },
              { s: "stranger", t: "Late? This will only take a moment. It always does." },
            ]
          : [
              { s: "you", t: "Sure — but make it quick." },
              { s: "stranger", t: "Quick. Of course. It never takes long." },
            ];
      setQueue([...reply, ...ENCOUNTER_REST]);
      setIdx(0);
    },
    [finish],
  );

  const street = phase === "walk" || phase === "encounter" || phase === "game" || phase === "taunt" || phase === "glitch";

  return (
    <div className="tf-game fixed inset-0 overflow-hidden bg-black font-sans text-ivory" style={{ touchAction: "manipulation" }}>
      <GlitchStyles />
      <div className={phase === "glitch" ? (reduceMotion ? "tf-glitch-scene-calm absolute inset-0" : "tf-glitch-scene absolute inset-0") : "absolute inset-0"}>
        {phase !== "black" && (
          <Canvas
            shadows
            dpr={dprFor(vp)}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{ fov: 45, near: 0.2, far: 520, position: [3, 3, 22] }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.1;
            }}
          >
            <Suspense fallback={null}>
              {street && <StreetScene phase={phase as "walk" | "encounter" | "game" | "taunt" | "glitch"} reduceMotion={reduceMotion} />}
              {phase === "wake" && <ValleyScene stage={wake} reduceMotion={reduceMotion} />}
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* letterbox bars for a cinematic feel */}
      <div className="tf-letterbox pointer-events-none absolute inset-x-0 top-0 z-10 bg-black/80" />
      <div className="tf-letterbox pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black/80" />

      {phase === "glitch" && <GlitchOverlay reduceMotion={reduceMotion} />}
      {phase === "black" && <BlackCard reduceMotion={reduceMotion} />}
      {phase === "wake" && wake !== "lying" && <BootHud kb={kb} />}
      {phase === "game" && <ShellGame reduceMotion={reduceMotion} onDone={() => go("taunt", TAUNT)} />}

      <AnimatePresence mode="wait">
        {line && (phase === "walk" || phase === "encounter" || phase === "taunt" || phase === "wake") && (
          <DialogueBox
            key={`${phase}-${idx}-${line.t}`}
            speaker={line.s}
            text={line.t}
            choices={line.choices}
            onNext={next}
            onChoice={choose}
            reduceMotion={reduceMotion}
            autoAdvanceMs={phase === "walk" ? 1800 : 2600}
          />
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={finish}
        className="tf-skip tf-keep absolute z-40 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/60 px-4 font-display text-[12px] tracking-[0.2em] text-ivory/90 hover:border-cyan-300/60 hover:text-cyan-100"
        aria-label="Skip intro (Esc)"
      >
        SKIP <SkipForward className="h-3.5 w-3.5" /> <span className="hidden text-ivory/45 sm:inline">ESC</span>
      </button>
    </div>
  );
}
