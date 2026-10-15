import { restartEverything } from "../components/RestartButton";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, History, LayoutDashboard, Mountain, Pause, Play, ShieldCheck, Trash2 } from "lucide-react";
import { WORKFLOW_STEPS } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import Background from "../components/Background";
import ConfirmDialog from "../components/ConfirmDialog";
import Toasts from "../components/Toasts";
import { Logo } from "../components/AppShell";
import { BackendPill, KbOnlyPill, KbPill } from "../components/StatusPills";
import { cx } from "../components/ui";
import { stepInfo, useStepStatuses } from "../components/workflow";

// Product/navigation copy describing what each step of the tool does (not agricultural advice).
const STEP_BLURB: Record<string, string> = {
  observation_log: "Describe the land in your own words",
  input_echo: "See exactly what the system understood",
  missing_analysis: "Spot unknowns and simple field checks",
  fix_protocol: "Restoration actions, in order",
  next_action: "A readiness gate before planting",
  crop_suggestions: "Options ranked against your land",
  timeframe: "Does it fit the wet season?",
  planting_method: "How to prepare and sow",
  ongoing_care: "Stage-by-stage watch list",
  harvest: "Ripeness, storage and regeneration",
};

function TerrainArt({ warm }: { warm?: boolean }) {
  const c1 = warm ? "#ff8a7a" : "#38e1ff";
  const c2 = warm ? "#e07a5f" : "#8b5cf6";
  return (
    <svg viewBox="0 0 400 160" className="absolute inset-x-0 bottom-0 h-40 w-full opacity-70" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={warm ? "tw" : "tc"} x1="0" x2="1">
          <stop offset="0" stopColor={c1} stopOpacity="0.9" />
          <stop offset="1" stopColor={c2} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M0 ${150 - i * 14} C 60 ${120 - i * 16}, 110 ${150 - i * 10}, 170 ${118 - i * 15} S 290 ${140 - i * 12}, 330 ${112 - i * 14} S 390 ${128 - i * 12}, 400 ${120 - i * 13}`}
          fill="none"
          stroke={`url(#${warm ? "tw" : "tc"})`}
          strokeOpacity={0.15 + i * 0.12}
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}

export default function LandingPage() {
  const setMode = useTerraform((s) => s.setMode);
  const introSeen = useTerraform((s) => s.introSeen);
  const sessionId = useTerraform((s) => s.sessionId);
  const observation = useTerraform((s) => s.observation);
  const plan = useTerraform((s) => s.plan);
  const currentStep = useTerraform((s) => s.currentStep);
  const completedTasks = useTerraform((s) => s.completedTasks);
  const resetSession = useTerraform((s) => s.resetSession);
  const toast = useTerraform((s) => s.toast);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const setReduceMotion = useTerraform((s) => s.setReduceMotion);
  const statuses = useStepStatuses();
  const [confirmClear, setConfirmClear] = useState(false);

  const hasSession = !!(sessionId || observation);
  const completeSteps = Object.values(statuses).filter((s) => s === "complete").length;
  const enterValley = () => setMode(introSeen ? "explorer" : "intro");

  const fade = (d = 0) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: reduceMotion ? 0 : d, duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <div className={cx("relative isolate min-h-screen overflow-x-hidden", reduceMotion && "reduce-motion")}>
      <Background intensity="hero" />

      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 lg:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReduceMotion(!reduceMotion)}
            aria-pressed={reduceMotion}
            className="btn-ghost !px-3 !py-1.5 text-sm"
            title="Toggle reduced motion"
          >
            {reduceMotion ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
            <span className="hidden sm:inline">{reduceMotion ? "Motion off" : "Reduce motion"}</span>
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-20 lg:px-8">
        {/* Hero */}
        <section className="relative pt-8 text-center sm:pt-14" aria-labelledby="hero-title">
          <motion.div {...fade(0)} className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" aria-hidden />
            Scenario 5 · Lateritic Hardpan Plateau
          </motion.div>
          <motion.h1 {...fade(0.08)} id="hero-title" className="font-display text-[clamp(2.6rem,9vw,6.5rem)] font-black leading-[0.95] tracking-[0.08em]">
            <span className="text-gradient-cv drop-shadow-[0_0_40px_rgba(56,225,255,0.25)]">TERRA</span>
            <span className="text-ivory">FORM</span>
          </motion.h1>
          <motion.p {...fade(0.16)} className="mt-4 font-display text-[clamp(0.95rem,2.4vw,1.4rem)] font-medium tracking-[0.42em] text-gradient-tc">
            THE SYSTEM AWAKENS
          </motion.p>
          <motion.p {...fade(0.24)} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-ivory/80">
            No lab. No instruments. Describe the land you're standing on, and TERRAFORM walks you from first observation
            to harvest — every answer drawn only from a cited knowledge base.
          </motion.p>
          <motion.div {...fade(0.32)} className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="System status">
            <BackendPill />
            <KbPill />
            <KbOnlyPill />
          </motion.div>
        </section>

        {/* Mode cards */}
        <section className="mt-14 grid gap-5 md:grid-cols-2" aria-label="Choose how to explore">
          <motion.button
            {...fade(0.4)}
            type="button"
            onClick={enterValley}
            className="glass hero-ring group relative min-h-[17rem] overflow-hidden rounded-3xl p-7 text-left transition-transform hover:-translate-y-1"
          >
            <span className="absolute inset-0 bg-gradient-to-br from-terracotta/25 via-coral/10 to-transparent opacity-80 transition-opacity group-hover:opacity-100" aria-hidden />
            <TerrainArt warm />
            <span className="relative flex h-full flex-col">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-coral to-terracotta text-midnight shadow-[0_10px_30px_-10px_rgba(224,122,95,0.8)]">
                <Mountain className="h-6 w-6" aria-hidden />
              </span>
              <span className="eyebrow mt-5 !text-orange-100/80">3D Explorer</span>
              <span className="mt-1 font-display text-2xl font-bold tracking-wider text-ivory sm:text-3xl">Enter the Valley</span>
              <span className="mt-3 max-w-sm text-ivory/75">Walk the plateau with TERRA·AI, uncover each step as a quest, and watch the land respond.</span>
              <span className="mt-6 inline-flex items-center gap-2 font-heading font-semibold text-coral">
                {introSeen ? "Enter the valley" : "Begin with the intro"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </span>
          </motion.button>

          <motion.button
            {...fade(0.48)}
            type="button"
            onClick={() => setMode("dashboard")}
            className="glass hero-ring group relative min-h-[17rem] overflow-hidden rounded-3xl p-7 text-left transition-transform hover:-translate-y-1"
          >
            <span className="absolute inset-0 bg-gradient-to-br from-cyan/20 via-violet/15 to-transparent opacity-80 transition-opacity group-hover:opacity-100" aria-hidden />
            <TerrainArt />
            <span className="relative flex h-full flex-col">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan to-violet text-midnight shadow-[0_10px_30px_-10px_rgba(56,225,255,0.8)]">
                <LayoutDashboard className="h-6 w-6" aria-hidden />
              </span>
              <span className="eyebrow mt-5 !text-cyan-100/80">Field instrument</span>
              <span className="mt-1 font-display text-2xl font-bold tracking-wider text-ivory sm:text-3xl">Field Dashboard</span>
              <span className="mt-3 max-w-sm text-ivory/75">The full ten-step journal: observations, checks, plan, crops, timing, care and harvest — with evidence on every card.</span>
              <span className="mt-6 inline-flex items-center gap-2 font-heading font-semibold text-cyan-200">
                Open the dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </span>
          </motion.button>
        </section>

        {/* Resume */}
        {hasSession && (
          <motion.section {...fade(0.55)} className="glass mt-5 flex flex-wrap items-center gap-4 rounded-2xl p-5" aria-label="Saved session">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-200">
              <History className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-heading font-semibold text-ivory">Resume session</div>
              <div className="text-sm text-mist">
                Last at step {String(stepInfo(currentStep).n).padStart(2, "0")} · {stepInfo(currentStep).label} · {completeSteps}/10 steps complete
                {plan ? ` · ${completedTasks.length} tasks done` : ""}
                {sessionId ? "" : " · not yet saved to the backend"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary !py-2" onClick={() => setMode("dashboard")}>
                <LayoutDashboard className="h-4 w-4" aria-hidden /> Resume in dashboard
              </button>
              <button type="button" className="btn-ghost !py-2" onClick={enterValley}>
                <Mountain className="h-4 w-4" aria-hidden /> In the valley
              </button>
              <button type="button" className="btn-ghost !py-2 text-coral" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Clear
              </button>
            </div>
          </motion.section>
        )}

        {/* How it works */}
        <section className="mt-16" aria-labelledby="how-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">How it works</div>
              <h2 id="how-title" className="mt-1 font-display text-2xl font-bold tracking-wider text-ivory">Ten steps, observation to harvest</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-mist">
              <ShieldCheck className="h-4 w-4 text-sprout" aria-hidden />
              Every recommendation cites its knowledge-base record
            </div>
          </div>
          <ol className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {WORKFLOW_STEPS.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: reduceMotion ? 0 : i * 0.04 }}
                className="glass relative w-56 shrink-0 snap-start overflow-hidden rounded-2xl p-4 lg:w-auto"
              >
                <span className="pointer-events-none absolute -right-1 -top-2 font-display text-5xl font-black text-white/[0.05]" aria-hidden>{String(s.n).padStart(2, "0")}</span>
                <div className="font-display text-xs font-bold tracking-widest text-cyan-200">{String(s.n).padStart(2, "0")}</div>
                <div className="mt-1 font-heading font-semibold text-ivory">{s.label}</div>
                <p className="mt-1.5 text-sm text-mist">{STEP_BLURB[s.id]}</p>
                {statuses[s.id] === "complete" && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-sprout" title="Complete in your session" />}
              </motion.li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-6 text-sm text-mist">
          <span>TERRAFORM renders knowledge-base responses only — the interface authors no farming advice.</span>
          {hasSession && (
            <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1.5 hover:text-coral">
              <Trash2 className="h-4 w-4" aria-hidden /> Clear session
            </button>
          )}
        </footer>
      </main>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this session?"
        confirmLabel="Clear session"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          restartEverything(); // full reset: session, plan, tests, photo, 3D farm progress, intro
        }}
      >
        <p>This removes your observation, photo, analysis, plan, completed tasks, readiness tests, accepted risks, journal and 3D farm progress from this browser, and replays the intro.</p>
        <p>The backend copy of the session is not deleted, but this device will start fresh.</p>
      </ConfirmDialog>
      <Toasts />
    </div>
  );
}
