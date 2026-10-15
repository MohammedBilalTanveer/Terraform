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
  Keyboard,
  LayoutDashboard,
  Menu as MenuIcon,
  MessageSquare,
  Play,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { WORKFLOW_STEPS } from "../types/terraform";
import { joystick, playerState, useGame } from "./gameStore";
import { GROUP_STATION, collectPlanItems, progressCount, taskItems, type Guidance } from "./planData";
import { CHANNEL, STATIONS, WORLD, stationById } from "./worldConfig";
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
    <div className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-[#070b1a]/70 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[15px] font-bold tracking-[0.25em] text-ivory">TERRAFORM</span>
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
        <button type="button" onClick={() => setOverlay("ask")} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[12px] text-cyan-50 hover:bg-cyan-400/20">
          <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ask TERRA</span>
        </button>
        <button type="button" onClick={() => setMode("dashboard")} className="inline-flex items-center gap-1 rounded-lg bg-amber-300/90 px-2.5 py-1 text-[12px] font-semibold text-[#1a1003] hover:bg-amber-200">
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </button>
        <button type="button" onClick={onMenu} aria-label="Menu (Esc)" className="rounded-lg p-1.5 text-ivory/80 hover:bg-white/10">
          <MenuIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function QuestPanel({ g }: { g: Guidance }) {
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const setMode = useTerraform((s) => s.setMode);
  const override = useGame((s) => s.targetOverride);
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const openEvidence = useTerraform((s) => s.openEvidence);
  const [collapsed, setCollapsed] = useState(false);
  const [dist, setDist] = useState<number | null>(null);
  const target = override ?? g.target;
  const tasks = useMemo(() => taskItems(collectPlanItems(plan)), [plan]);
  const doneCount = tasks.filter((t) => completed.includes(t.rec.task_id!)).length;
  const open = tasks.filter((t) => !completed.includes(t.rec.task_id!));
  const step = WORKFLOW_STEPS.find((s) => s.id === g.step);

  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => {
      const p = stationById(target).pos;
      setDist(Math.round(Math.hypot(p[0] - playerState.x, p[1] - playerState.z)));
    }, 400);
    return () => window.clearInterval(t);
  }, [target]);

  return (
    <div className="pointer-events-auto absolute left-3 top-14 z-10 w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0a1124]/80 shadow-xl backdrop-blur-md">
      <button type="button" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2 text-left">
        <Bot className="h-4 w-4 text-cyan-300" />
        <span className="font-display text-[10px] tracking-[0.25em] text-cyan-200">TERRA · STEP {step?.n ?? "?"}</span>
        <span className="truncate text-[12px] text-ivory/80">{step?.label}</span>
        <span className="ml-auto text-[10px] text-ivory/45">{collapsed ? "show" : "hide"}</span>
      </button>
      {!collapsed && (
        <div className="space-y-2.5 px-3 py-2.5">
          {g.lines.map((l, i) => (
            <p key={i} className={cx("text-[12.5px] leading-snug", i === 0 ? "text-ivory" : "text-ivory/70")}>
              {l}
            </p>
          ))}
          {g.fromKb && <Chips evidence={g.evidence} />}
          {target && (
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5">
              <Compass className="h-3.5 w-3.5 text-amber-200" />
              <span className="flex-1 truncate text-[12px]">
                {override ? "Guiding to" : "Next"}: <span className="font-medium text-amber-100">{stationById(target).name}</span>
                {dist !== null && <span className="text-ivory/50"> · {dist} m</span>}
              </span>
              {override && (
                <button type="button" className="text-[10.5px] text-ivory/55 underline" onClick={() => setTargetOverride(null)}>
                  reset
                </button>
              )}
            </div>
          )}
          {tasks.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10.5px] text-ivory/55">
                <span>PLAN TASKS</span>
                <span>
                  {doneCount}/{tasks.length}
                </span>
              </div>
              <ul className="space-y-1">
                {[...open.slice(0, 4), ...tasks.filter((t) => completed.includes(t.rec.task_id!)).slice(0, Math.max(0, 5 - open.length))].map((t) => {
                  const done = completed.includes(t.rec.task_id!);
                  const st = GROUP_STATION[t.group];
                  return (
                    <li key={t.rec.task_id} className="flex items-center gap-1.5">
                      {done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-ivory/35" />}
                      <button
                        type="button"
                        onClick={() => setTargetOverride(st)}
                        title={`Guide me to ${stationById(st).name}`}
                        className={cx("min-w-0 flex-1 truncate text-left text-[12px] hover:text-cyan-100", done ? "text-ivory/45 line-through" : "text-ivory/85")}
                      >
                        {t.rec.task_label ?? t.rec.title}
                      </button>
                      {t.rec.evidence.kb_ids[0] && (
                        <button
                          type="button"
                          onClick={() => openEvidence(t.rec.evidence.kb_ids[0])}
                          title={`Evidence: ${t.rec.evidence.kb_ids.join(", ")}`}
                          aria-label={`Open evidence ${t.rec.evidence.kb_ids[0]}`}
                          className="shrink-0 rounded px-1 py-0.5 text-violet-200/80 hover:bg-violet-500/20 hover:text-violet-100"
                        >
                          <BookOpen className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setCurrentStep(g.step);
              setMode("dashboard");
            }}
            className="text-[11.5px] text-cyan-200 underline hover:text-cyan-100"
          >
            Show details in Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function InteractionPrompt() {
  const near = useGame((s) => s.nearStation);
  const overlay = useGame((s) => s.overlay);
  const action = useGame((s) => s.action);
  const pulse = useGame((s) => s.pulseInteract);
  if (!near || overlay || action) return null;
  const st = stationById(near);
  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-10 -translate-x-1/2 sm:bottom-10">
      <button type="button" onClick={pulse} className="flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-[#070b1a]/80 px-3 py-2 text-[13px] shadow-[0_0_24px_rgba(56,225,255,0.25)] backdrop-blur">
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
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-300/30 bg-[#070b1a]/80 px-3 py-2 backdrop-blur sm:bottom-10" role="status">
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
    <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden rounded-full border border-cyan-300/25 bg-[#070b1a]/70 p-1 shadow-lg backdrop-blur sm:block" aria-label="Minimap">
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
          className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 text-center"
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
  const item = "flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-[13.5px] hover:border-cyan-300/40 hover:bg-white/[0.07]";
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-[#070b1a]/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label="Explorer menu" className="w-[min(360px,calc(100vw-2rem))] space-y-2 rounded-2xl border border-cyan-300/25 bg-[#0a1124]/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

function TouchControls() {
  const [coarse, setCoarse] = useState(false);
  const knob = useRef<HTMLDivElement>(null);
  const pulse = useGame((s) => s.pulseInteract);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (!coarse) return null;
  const R = 46;
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    joystick.x = dx / R;
    joystick.z = dy / R;
    joystick.active = true;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => {
    joystick.x = 0;
    joystick.z = 0;
    joystick.active = false;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };
  return (
    <>
      <div
        className="pointer-events-auto absolute bottom-6 left-6 z-10 grid h-32 w-32 touch-none place-items-center rounded-full border border-white/20 bg-white/5 backdrop-blur"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => joystick.active && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Movement joystick"
      >
        <div ref={knob} className="h-12 w-12 rounded-full border border-cyan-200/60 bg-cyan-400/30" />
      </div>
      <button type="button" onClick={pulse} className="pointer-events-auto absolute bottom-10 right-6 z-10 grid h-16 w-16 place-items-center rounded-full border border-cyan-200/60 bg-cyan-400/25 font-display text-lg text-cyan-50" aria-label="Interact">
        E
      </button>
    </>
  );
}

export default function WorldHUD({ g }: { g: Guidance }) {
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  const override = useGame((s) => s.targetOverride);
  return (
    <div className="pointer-events-none absolute inset-0">
      <TopBar onMenu={() => setOverlay(overlay === "menu" ? null : "menu")} />
      {(!overlay || overlay === "menu") && <QuestPanel g={g} />}
      <InteractionPrompt />
      <ActionProgress />
      <Minimap target={override ?? g.target} />
      <LocationToast />
      <ControlsHelp />
      <TouchControls />
      {overlay === "menu" && <Menu onClose={() => setOverlay(null)} />}
    </div>
  );
}
