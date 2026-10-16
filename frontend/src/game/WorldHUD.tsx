import RestartButton from "../components/RestartButton";
// Explorer HUD: top bar, TERRA quest panel, interaction prompt, action progress, minimap, location toast,
// controls help, Esc menu and optional touch controls.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Circle,
  Compass,
  Gamepad2,
  Lock,
  Keyboard,
  LayoutDashboard,
  Menu as MenuIcon,
  MessageSquare,
  Play,
  RotateCcw,
  Settings2,
  Smartphone,
  X,
} from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { WORKFLOW_STEPS } from "../types/terraform";
import { playerState, useGame } from "./gameStore";
import TouchControls, { useTouchVisible } from "./TouchControls";
import { progressCount, unlockTab, type Guidance, type PlanItem, type QuestStep } from "./planData";
import { questSnapshot, useQuest } from "./useQuest";
import { useViewport } from "./useViewport";
import { pinQuestStep } from "./ui/pin";
import { CHANNEL, STATIONS, WORLD, stationById, type StationId } from "./worldConfig";
import { Chips, cx } from "./ui/kit";

const VERB_PROGRESS: Record<string, string> = {
  inspect: "Inspecting",
  dig: "Digging",
  stones: "Laying stones",
  compost: "Adding compost & mulch",
  sow: "Sowing",
  water: "Watering",
  harvest: "Harvesting",
};

function TopBar({ onMenu }: { onMenu: () => void }) {
  const health = useTerraform((s) => s.health);
  const online = useTerraform((s) => s.backendOnline);
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const setMode = useTerraform((s) => s.setMode);
  const setOverlay = useGame((s) => s.setOverlay);
  const done = progressCount(analysis, plan);
  return (
    <div className="tf-topbar pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 border-b border-white/10 bg-[#070b1a]/80 pb-1 backdrop-blur-md sm:gap-3 sm:pb-2">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[12px] font-bold tracking-[0.2em] text-ivory sm:text-[15px] sm:tracking-[0.25em]">TERRAFORM</span>
        <span className="hidden font-display text-[9px] tracking-[0.25em] text-cyan-300/80 md:inline">EXPLORER</span>
      </div>
      <span className="hidden truncate text-[11.5px] text-ivory/60 lg:inline">Scenario 5 · Lateritic Hardpan Plateau</span>
      <div className="ml-auto flex items-center gap-2">
        <span
          className={cx(
            "hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] sm:inline-flex",
            online ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : online === false ? "border-rose-300/40 bg-rose-400/10 text-rose-100" : "border-white/15 text-ivory/60",
          )}
          title="TERRA answers only from the knowledge base"
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", online ? "bg-emerald-300" : online === false ? "bg-rose-300" : "bg-ivory/40")} />
          {online ? `KB ${health?.kb_version ?? ""} · KB-only` : online === false ? "KB offline" : "KB…"}
        </span>
        <div className="flex items-center gap-1.5" title={`${done} of 10 workflow steps complete`}>
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all" style={{ width: `${done * 10}%` }} />
          </div>
          <span className="font-display text-[11px] text-ivory/80">{done}/10</span>
        </div>
        <button type="button" onClick={() => setOverlay("ask")} aria-label="Ask TERRA" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[12px] text-cyan-50 hover:bg-cyan-400/20 sm:min-h-0 sm:min-w-0">
          <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ask TERRA</span>
        </button>
        <button type="button" onClick={() => setMode("dashboard")} aria-label="Dashboard" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-amber-300/90 px-2.5 py-1 text-[12px] font-semibold text-[#1a1003] hover:bg-amber-200 sm:min-h-0">
          <LayoutDashboard className="h-3.5 w-3.5" /> <span className="hidden min-[400px]:inline">Dashboard</span>
        </button>
        <button type="button" onClick={onMenu} aria-label="Menu (Esc)" className="grid min-h-11 min-w-11 place-items-center rounded-lg p-1.5 text-ivory/80 hover:bg-white/10 sm:min-h-0 sm:min-w-0">
          <MenuIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Back-compat for callers that hold a PlanItem (Research Outpost list). */
export function focusPlanTask(item: PlanItem) {
  if (item.rec.task_id) pinQuestStep(item.rec.task_id);
}

const DOT = (s: QuestStep) =>
  s.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : s.blocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300/80" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-ivory/35" />;

function QuestPanel({ g, target }: { g: Guidance; target: StationId | null }) {
  const { steps, quest, plan, pinnedId } = useQuest();
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const setMode = useTerraform((s) => s.setMode);
  const setPinned = useGame((s) => s.setPinned);
  const beaconOff = useGame((s) => s.beaconOff);
  const setBeaconOff = useGame((s) => s.setBeaconOff);
  const vp = useViewport();
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && (window.innerWidth < 640 || window.innerHeight < 500));
  // rotating to a short landscape screen collapses the quest panel to its chip (no remount, no state loss)
  useEffect(() => {
    if (vp.short) setCollapsed(true);
  }, [vp.short]);
  const [dist, setDist] = useState<number | null>(null);
  const step = WORKFLOW_STEPS.find((s) => s.id === g.step);
  const real = steps.filter((s) => !s.optional);
  const doneCount = real.filter((s) => s.done).length;
  const upcoming = quest ? real.filter((s) => !s.done && s.id !== quest.id && steps.indexOf(s) > steps.indexOf(quest)).slice(0, 2) : [];
  const off = !!quest && beaconOff === quest.id;

  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => {
      const p = stationById(target).pos;
      setDist(Math.round(Math.hypot(p[0] - playerState.x, p[1] - playerState.z)));
    }, 400);
    return () => window.clearInterval(t);
  }, [target]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="tf-quest-chip pointer-events-auto absolute z-10 flex min-h-11 max-w-[calc(100vw-1rem)] items-center gap-2 rounded-full border border-cyan-300/30 bg-[#0a1124]/90 px-3 py-1.5 text-left shadow-xl"
        aria-label="Show TERRA quest panel"
      >
        <Bot className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="font-display text-[10px] tracking-[0.2em] text-cyan-200">STEP {step?.n ?? "?"}</span>
        <span className="truncate text-[12px] text-ivory/85">{quest ? quest.label : step?.label}</span>
        {real.length > 0 && <span className="shrink-0 font-display text-[10px] text-ivory/60">{doneCount}/{real.length}</span>}
      </button>
    );
  }

  return (
    <div className="tf-quest pointer-events-auto absolute z-10 flex w-[min(340px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0a1124]/92 shadow-xl">
      <button type="button" onClick={() => setCollapsed(true)} className="flex min-h-11 w-full shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 text-left sm:min-h-0">
        <Bot className="h-4 w-4 text-cyan-300" />
        <span className="font-display text-[10px] tracking-[0.25em] text-cyan-200">TERRA · STEP {step?.n ?? "?"}</span>
        <span className="truncate text-[12px] text-ivory/80">{step?.label}</span>
        <span className="ml-auto text-[10px] text-ivory/45">hide</span>
      </button>
      <div className="min-h-0 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-2.5 [scrollbar-width:thin]">
        {g.lines.map((l, i) => (
          <p key={i} className={cx("text-[12.5px] leading-snug", i === 0 ? "text-ivory" : "text-ivory/70")}>
            {l}
          </p>
        ))}
        {g.fromKb && <Chips evidence={g.evidence} />}

        {plan && quest && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] text-ivory/55">
              <span>QUEST</span>
              <span>
                {doneCount}/{real.length} done
              </span>
            </div>
            <div className="rounded-xl border border-cyan-300/40 bg-cyan-400/[0.08] px-2.5 py-2">
              <div className="flex items-start gap-2">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-snug text-ivory">{quest.label}</div>
                  <div className="text-[11px] text-amber-100/85">
                    {stationById(quest.station).name}
                    {dist !== null && !off && <span className="text-ivory/50"> · {dist} m</span>}
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-semibold text-cyan-200">← do this now{pinnedId === quest.id ? " (pinned)" : ""}</div>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3">
                <button type="button" className="min-h-8 text-[11px] text-ivory/65 underline" onClick={() => setBeaconOff(off ? null : quest.id)}>
                  {off ? "Guide me again" : "Stop guiding"}
                </button>
                {pinnedId === quest.id && (
                  <button type="button" className="min-h-8 text-[11px] text-ivory/65 underline" onClick={() => setPinned(null)}>
                    Unpin
                  </button>
                )}
              </div>
            </div>
            {upcoming.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pinQuestStep(s.id)}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left opacity-60 hover:bg-white/5 hover:opacity-100"
              >
                {DOT(s)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] text-ivory/80">{s.label}</span>
                  <span className="block truncate text-[10px] text-ivory/45">{s.blocked && s.blockedText ? s.blockedText : stationById(s.station).name}</span>
                </span>
              </button>
            ))}
            <details className="rounded-lg border border-white/10 bg-white/[0.02] px-2">
              <summary className="min-h-9 cursor-pointer text-[11.5px] text-ivory/70">All tasks ({real.length})</summary>
              <ul className="pb-1">
                {steps.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pinQuestStep(s.id)}
                      title={s.blocked && s.blockedText ? s.blockedText : `Guide me to ${stationById(s.station).name}`}
                      className={cx("flex min-h-9 w-full items-center gap-2 rounded-md px-1 text-left", quest?.id === s.id && "bg-cyan-400/10")}
                    >
                      {DOT(s)}
                      <span className="min-w-0 flex-1">
                        <span className={cx("block truncate text-[11.5px]", s.done ? "text-ivory/40 line-through" : s.blocked ? "text-ivory/45" : "text-ivory/85")}>{s.label}</span>
                        <span className={cx("block truncate text-[10px]", s.blocked && !s.done ? "text-amber-200/70" : "text-ivory/40")}>
                          {s.blocked && !s.done && s.blockedText ? s.blockedText : stationById(s.station).name}
                          {s.optional ? " · optional" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
        {!quest && target && (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5">
            <Compass className="h-3.5 w-3.5 text-amber-200" />
            <span className="flex-1 truncate text-[12px]">
              Next: <span className="font-medium text-amber-100">{stationById(target).name}</span>
              {dist !== null && <span className="text-ivory/50"> · {dist} m</span>}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setCurrentStep(g.step);
            setMode("dashboard");
          }}
          className="min-h-8 text-[11.5px] text-cyan-200 underline hover:text-cyan-100"
        >
          Show details in Dashboard
        </button>
      </div>
    </div>
  );
}

function InteractionPrompt() {
  const near = useGame((s) => s.nearStation);
  const overlay = useGame((s) => s.overlay);
  const action = useGame((s) => s.action);
  const pulse = useGame((s) => s.pulseInteract);
  const touch = useTouchVisible();
  if (!near || overlay || action) return null;
  const st = stationById(near);
  return (
    <div className="tf-prompt pointer-events-auto absolute left-1/2 z-10 w-max -translate-x-1/2">
      <button type="button" onClick={pulse} className="flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/40 bg-[#070b1a]/80 px-3 py-2 text-[13px] shadow-[0_0_24px_rgba(56,225,255,0.25)] backdrop-blur">
        <kbd className="grid h-6 w-6 place-items-center rounded-md border border-cyan-200/60 bg-cyan-400/20 font-display text-[11px] text-cyan-50">E</kbd>
        <span>
          {st.verb} <span className="text-ivory/55">— {st.name}</span>
        </span>
      </button>
    </div>
  );
}

function ActionProgress() {
  const action = useGame((s) => s.action);
  const circle = useRef<SVGCircleElement>(null);
  const touch = useTouchVisible();
  useEffect(() => {
    if (!action) return;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - action.start) / action.duration);
      if (circle.current) circle.current.style.strokeDashoffset = String(113 * (1 - p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [action]);
  if (!action) return null;
  return (
    <div className="tf-prompt pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-300/30 bg-[#070b1a]/80 px-3 py-2 backdrop-blur" role="status">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle ref={circle} cx="20" cy="20" r="18" fill="none" stroke="#7bd389" strokeWidth="3" strokeDasharray="113" strokeDashoffset="113" strokeLinecap="round" transform="rotate(-90 20 20)" />
      </svg>
      <div>
        <div className="font-display text-[10px] tracking-[0.2em] text-emerald-200">{VERB_PROGRESS[action.kind]?.toUpperCase()}</div>
        <div className="max-w-[260px] truncate text-[12.5px] text-ivory/90">{action.label}</div>
      </div>
    </div>
  );
}

const MAP = 150;
const toMap = (x: number, z: number) => [((x / (WORLD.radius + 6)) * 0.5 + 0.5) * MAP, ((z / (WORLD.radius + 6)) * 0.5 + 0.5) * MAP] as const;

function Minimap({ target }: { target: string | null }) {
  const arrow = useRef<SVGGElement>(null);
  const touch = useTouchVisible();
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const [mx, my] = toMap(playerState.x, playerState.z);
      arrow.current?.setAttribute("transform", `translate(${mx} ${my}) rotate(${180 - (playerState.rot * 180) / Math.PI})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const channel = CHANNEL.map(([x, z]) => toMap(x, z).join(",")).join(" ");
  return (
    <div
      className={cx(
        "tf-minimap pointer-events-none absolute z-10 hidden rounded-full border border-cyan-300/25 bg-[#070b1a]/70 p-1 shadow-lg backdrop-blur sm:block",
        touch ? "[&_svg]:h-[96px] [&_svg]:w-[96px]" : "bottom-3",
      )}
      aria-label="Minimap"
    >
      <svg width={MAP} height={MAP} viewBox={`0 0 ${MAP} ${MAP}`}>
        <defs>
          <clipPath id="mm-clip">
            <circle cx={MAP / 2} cy={MAP / 2} r={MAP / 2} />
          </clipPath>
        </defs>
        <g clipPath="url(#mm-clip)">
          <rect width={MAP} height={MAP} fill="#5a2a1a" />
          <circle cx={MAP / 2} cy={MAP / 2} r={(WORLD.radius / (WORLD.radius + 6)) * (MAP / 2)} fill="#8f4429" />
          <polyline points={channel} fill="none" stroke="#4a1c10" strokeWidth={2.5} strokeLinecap="round" />
          {STATIONS.map((s) => {
            const [x, y] = toMap(s.pos[0], s.pos[1]);
            const isT = s.id === target;
            return (
              <g key={s.id}>
                {isT && <circle cx={x} cy={y} r={7} fill="none" stroke="#38e1ff" strokeWidth={1.5} className="animate-pulse" />}
                <circle cx={x} cy={y} r={s.interactive ? 3.2 : 2.4} fill={s.color} stroke="#070b1a" strokeWidth={0.8} />
              </g>
            );
          })}
          <g ref={arrow}>
            <path d="M0,-6 L4.5,5 L0,2.5 L-4.5,5 Z" fill="#f4efe6" stroke="#070b1a" strokeWidth={0.8} />
          </g>
        </g>
        <text x={MAP / 2} y={11} textAnchor="middle" fontSize="8" fill="#cfe9f5" fontFamily="Orbitron, sans-serif">N</text>
      </svg>
    </div>
  );
}

function LocationToast() {
  const area = useGame((s) => s.area);
  const [shown, setShown] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!area || area === last.current) {
      if (!area) last.current = null;
      return;
    }
    last.current = area;
    setShown(stationById(area).name);
    const t = window.setTimeout(() => setShown(null), 2600);
    return () => window.clearTimeout(t);
  }, [area]);
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="tf-toast-top pointer-events-none absolute left-1/2 z-10 max-w-[calc(100vw-2rem)] -translate-x-1/2 text-center"
        >
          <div className="font-display text-[10px] tracking-[0.35em] text-amber-200/80">ENTERING</div>
          <div className="font-heading text-xl font-semibold text-ivory drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{shown}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ControlsHelp() {
  const show = useGame((s) => s.showHelp);
  const setShow = useGame((s) => s.setShowHelp);
  const touch = useTouchVisible();
  if (touch) return null;
  if (!show)
    return (
      <button type="button" onClick={() => setShow(true)} className="pointer-events-auto absolute bottom-3 left-3 z-10 hidden rounded-lg border border-white/15 bg-[#070b1a]/70 p-2 text-ivory/70 hover:text-ivory sm:block" aria-label="Show controls">
        <Keyboard className="h-4 w-4" />
      </button>
    );
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-10 hidden rounded-xl border border-white/12 bg-[#070b1a]/75 px-3 py-2 text-[11.5px] text-ivory/75 backdrop-blur sm:block">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="font-display text-[9px] tracking-[0.25em] text-cyan-200/80">CONTROLS</span>
        <button type="button" onClick={() => setShow(false)} aria-label="Hide controls" className="text-ivory/50 hover:text-ivory">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <span className="font-mono text-cyan-100">WASD / ←↑↓→</span><span>Move</span>
        <span className="font-mono text-cyan-100">Shift</span><span>Sprint</span>
        <span className="font-mono text-cyan-100">E / Enter</span><span>Interact</span>
        <span className="font-mono text-cyan-100">Scroll</span><span>Zoom</span>
        <span className="font-mono text-cyan-100">Esc</span><span>Close / menu</span>
      </div>
    </div>
  );
}

function Menu({ onClose }: { onClose: () => void }) {
  const setMode = useTerraform((s) => s.setMode);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const setReduceMotion = useTerraform((s) => s.setReduceMotion);
  const showHelp = useGame((s) => s.showHelp);
  const setShowHelp = useGame((s) => s.setShowHelp);
  const setZoom = useGame((s) => s.setZoom);
  const touchMode = useGame((s) => s.touchMode);
  const setTouchMode = useGame((s) => s.setTouchMode);
  const item = "flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-[13.5px] hover:border-cyan-300/40 hover:bg-white/[0.07]";
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex overflow-y-auto bg-[#070b1a]/70 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Explorer menu" className="m-auto w-[min(380px,calc(100vw-2rem))] space-y-2 rounded-2xl border border-cyan-300/25 bg-[#0a1124]/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[12px] tracking-[0.3em] text-cyan-200">MENU</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-1 text-ivory/70 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className={item} onClick={onClose}>
          <Play className="h-4 w-4 text-emerald-300" /> Resume
        </button>
        <button type="button" className={item} onClick={() => setMode("dashboard")}>
          <LayoutDashboard className="h-4 w-4 text-amber-200" /> Open Dashboard
        </button>
        <button type="button" className={item} onClick={() => setMode("intro")}>
          <RotateCcw className="h-4 w-4 text-violet-300" /> Replay intro
        </button>
        <button type="button" className={item} onClick={() => setZoom(1)}>
          <Compass className="h-4 w-4 text-cyan-300" /> Reset camera zoom
        </button>
        <RestartButton variant="menu" />
        <label className={cx(item, "cursor-pointer")}>
          <Settings2 className="h-4 w-4 text-cyan-300" />
          <span className="flex-1">Reduce motion</span>
          <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
        </label>
        <label className={cx(item, "cursor-pointer")}>
          <Gamepad2 className="h-4 w-4 text-cyan-300" />
          <span className="flex-1">Show controls help</span>
          <input type="checkbox" checked={showHelp} onChange={(e) => setShowHelp(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
        </label>
        <div className={item}>
          <Smartphone className="h-4 w-4 text-cyan-300" />
          <span className="flex-1">Touch controls</span>
          <div className="flex overflow-hidden rounded-lg border border-white/15" role="radiogroup" aria-label="Touch controls">
            {(["auto", "show", "hide"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={touchMode === m}
                onClick={() => setTouchMode(m)}
                className={cx("min-h-9 px-2.5 text-[11.5px] capitalize", touchMode === m ? "bg-cyan-400/25 text-cyan-50" : "text-ivory/70 hover:bg-white/10")}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorldHUD({ g, target }: { g: Guidance; target: StationId | null }) {
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  return (
    <div className="pointer-events-none absolute inset-0">
      <TopBar onMenu={() => setOverlay(overlay === "menu" ? null : "menu")} />
      {(!overlay || overlay === "menu") && <QuestPanel g={g} target={target} />}
      <InteractionPrompt />
      <ActionProgress />
      {!overlay && <Minimap target={target} />}
      <LocationToast />
      <ControlsHelp />
      <TouchControls />
      {overlay === "menu" && <Menu onClose={() => setOverlay(null)} />}
    </div>
  );
}
