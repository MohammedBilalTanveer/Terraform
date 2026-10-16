import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ClipboardList, LoaderCircle, Mountain, Route, ScanSearch } from "lucide-react";
import type { StepId } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import AppShell from "../components/AppShell";
import AssistantPanel from "../components/AssistantPanel";
import RobotAvatar from "../components/RobotAvatar";
import WorkflowStepper from "../components/WorkflowStepper";
import { ErrorState } from "../components/LoadingAndError";
import { STEP_IDS, stepIndex, stepInfo, useStepStatuses } from "../components/workflow";
import StepFrame from "./StepFrame";
import ObservationStep from "./steps/ObservationStep";
import InputEchoStep from "./steps/InputEchoStep";
import MissingAnalysisStep from "./steps/MissingAnalysisStep";
import FixProtocolStep from "./steps/FixProtocolStep";
import NextActionStep from "./steps/NextActionStep";
import CropSuggestionsStep from "./steps/CropSuggestionsStep";
import TimeframeStep from "./steps/TimeframeStep";
import PlantingMethodStep from "./steps/PlantingMethodStep";
import OngoingCareStep from "./steps/OngoingCareStep";
import HarvestStep from "./steps/HarvestStep";

const PAGES: Record<StepId, ComponentType> = {
  observation_log: ObservationStep,
  input_echo: InputEchoStep,
  missing_analysis: MissingAnalysisStep,
  fix_protocol: FixProtocolStep,
  next_action: NextActionStep,
  crop_suggestions: CropSuggestionsStep,
  timeframe: TimeframeStep,
  planting_method: PlantingMethodStep,
  ongoing_care: OngoingCareStep,
  harvest: HarvestStep,
};

type Primary = { label: string; icon: ComponentType<{ className?: string }>; onClick?: () => void; form?: string; disabled?: boolean; busy?: boolean };

function usePrimaryAction(step: StepId, go: (s: StepId) => void): Primary {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const loading = useTerraform((s) => s.loading);
  const generatePlan = useTerraform((s) => s.generatePlan);
  const setMode = useTerraform((s) => s.setMode);
  const introSeen = useTerraform((s) => s.introSeen);
  const idx = stepIndex(step);
  const next = STEP_IDS[idx + 1];

  if (step === "observation_log")
    return { label: loading === "analyze" ? "Analysing…" : "Analyse observation", icon: ScanSearch, form: "observation-form", busy: loading === "analyze", disabled: !!loading };
  if (!analysis) return { label: "Start with an observation", icon: ClipboardList, onClick: () => go("observation_log") };
  if (step === "input_echo") return { label: "Continue to missing analysis", icon: ArrowRight, onClick: () => go("missing_analysis") };
  if (!plan)
    return {
      label: loading === "plan" ? "Generating plan…" : "Generate restoration plan",
      icon: Route,
      busy: loading === "plan",
      disabled: !!loading,
      onClick: async () => {
        const p = await generatePlan();
        if (p) go("fix_protocol");
      },
    };
  if (step === "harvest") return { label: "Explore in the 3D Valley", icon: Mountain, onClick: () => setMode(introSeen ? "explorer" : "intro") };
  return { label: `Continue to ${stepInfo(next).label.toLowerCase()}`, icon: ArrowRight, onClick: () => go(next) };
}

export default function DashboardPage() {
  const step = useTerraform((s) => s.currentStep);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const loading = useTerraform((s) => s.loading);
  const error = useTerraform((s) => s.error);
  const clearError = useTerraform((s) => s.clearError);
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const observation = useTerraform((s) => s.observation);
  const analyze = useTerraform((s) => s.analyze);
  const generatePlan = useTerraform((s) => s.generatePlan);
  const reduce = useTerraform((s) => s.reduceMotion);
  const statuses = useStepStatuses();
  const [assistantOpen, setAssistantOpen] = useState(false);

  const safeStep: StepId = STEP_IDS.includes(step) ? step : "observation_log";
  const idx = stepIndex(safeStep);
  const go = (s: StepId) => {
    setCurrentStep(s);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const primary = usePrimaryAction(safeStep, go);
  const Page = PAGES[safeStep];
  const PrimaryIcon = primary.icon;

  // New step → start at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [safeStep]);

  // Resume where you left off: after the step transition, bring the first incomplete item
  // (undone task, unanswered check, unmet gate…) into view and pulse it briefly.
  useEffect(() => {
    if (safeStep === "observation_log") return;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('#main-content [data-incomplete="true"]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const visible = r.top >= 100 && r.top <= window.innerHeight - 140;
      if (!visible) {
        // Aim a little below the sticky header, but CLAMP to the real scroll range so we never land past the content.
        const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const desired = window.scrollY + r.top - Math.round(window.innerHeight * 0.25);
        window.scrollTo({ top: Math.min(Math.max(0, desired), maxTop), behavior: reduce ? "auto" : "smooth" });
      }
      el.classList.add("resume-highlight");
      clear = setTimeout(() => el.classList.remove("resume-highlight"), 2400);
    }, reduce ? 150 : 650);
    return () => {
      clearTimeout(t);
      if (clear) clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeStep]);

  // Keyboard: Alt+← / Alt+→ moves between steps (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight" && idx < STEP_IDS.length - 1) go(STEP_IDS[idx + 1]);
      if (e.key === "ArrowLeft" && idx > 0) go(STEP_IDS[idx - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Errors from store actions surface here (the observation form shows its own inline).
  const showGlobalError = !!error && !loading && safeStep !== "observation_log" && safeStep !== "missing_analysis";
  const retry = () => {
    clearError();
    if (analysis) void generatePlan();
    else if (observation) void analyze();
  };

  const renderPrimary = (className = "") => (
    <button
      type={primary.form ? "submit" : "button"}
      form={primary.form}
      onClick={primary.form ? undefined : () => void primary.onClick?.()}
      disabled={primary.disabled}
      className={`btn-primary min-w-0 ${className}`}
    >
      {primary.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <PrimaryIcon className="h-4 w-4" aria-hidden />}
      <span className="truncate">{primary.label}</span>
    </button>
  );

  return (
    <AppShell>
      {(loading === "plan" || loading === "analyze") && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" role="progressbar" aria-label="Working">
          <motion.div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan to-violet" animate={{ x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} />
        </div>
      )}

      <div className="mx-auto grid max-w-[1680px] gap-6 px-4 pb-32 pt-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-6 lg:pb-28 xl:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <aside className="hidden lg:block" aria-label="Workflow">
          <div className="sticky top-24">
            <WorkflowStepper orientation="vertical" />
          </div>
        </aside>

        <main id="main-content" className="min-w-0" tabIndex={-1}>
          <div className="mb-4 lg:hidden">
            <WorkflowStepper orientation="horizontal" />
          </div>

          {showGlobalError && (
            <ErrorState className="mb-5" title="The field system hit a problem" message={error!} onRetry={retry} />
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={safeStep}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: reduce ? 0.1 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <StepFrame step={safeStep} status={statuses[safeStep]}>
                <Page />
              </StepFrame>
            </motion.div>
          </AnimatePresence>

          {/* Desktop step nav */}
          <nav className="mt-10 hidden items-center justify-between gap-3 border-t border-white/8 pt-5 lg:flex" aria-label="Step navigation">
            <button type="button" className="btn-ghost" disabled={idx === 0} onClick={() => go(STEP_IDS[idx - 1])}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden whitespace-nowrap 2xl:inline">{idx > 0 ? stepInfo(STEP_IDS[idx - 1]).label : "Previous"}</span>
              <span className="2xl:hidden">Back</span>
            </button>
            {renderPrimary()}
            <button type="button" className="btn-ghost" disabled={idx === STEP_IDS.length - 1} onClick={() => go(STEP_IDS[idx + 1])}>
              <span className="hidden whitespace-nowrap 2xl:inline">{idx < STEP_IDS.length - 1 ? stepInfo(STEP_IDS[idx + 1]).label : "Next"}</span>
              <span className="2xl:hidden">Next</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        </main>

        <aside className="hidden xl:block" aria-label="Assistant">
          <div className="sticky top-24 h-[calc(100vh-7.5rem)]">
            <AssistantPanel className="h-full" />
          </div>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-midnight/85 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button type="button" className="btn-ghost !p-3" disabled={idx === 0} onClick={() => go(STEP_IDS[idx - 1])} aria-label="Previous step">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          {renderPrimary("min-w-0 flex-1 !py-3")}
          <button type="button" className="btn-ghost !p-3" disabled={idx === STEP_IDS.length - 1} onClick={() => go(STEP_IDS[idx + 1])} aria-label="Next step">
            <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Assistant toggle (below xl) */}
      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        className="glass-strong fixed bottom-24 right-3 z-40 flex items-center gap-2 rounded-2xl p-1.5 sm:pr-3.5 lg:bottom-6 xl:hidden"
        aria-label="Open TERRA·AI assistant"
        aria-expanded={assistantOpen}
      >
        <RobotAvatar size={36} />
        <span className="hidden font-display text-xs font-bold tracking-[0.18em] sm:inline">TERRA·AI</span>
      </button>
      <AnimatePresence>
        {assistantOpen && (
          <div className="fixed inset-0 z-[70] xl:hidden">
            <motion.div className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAssistantOpen(false)} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="TERRA·AI assistant"
              className="absolute inset-x-0 bottom-0 h-[92dvh] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[26rem]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onKeyDown={(e) => e.key === "Escape" && setAssistantOpen(false)}
            >
              <AssistantPanel className="glass-strong h-full" onClose={() => setAssistantOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
