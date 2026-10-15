import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { WORKFLOW_STEPS } from "../types/terraform";
import type { StepId } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { STATUS_META, StatusIcon, cx } from "./ui";
import { rubricStage, useStepStatuses } from "./workflow";

export type WorkflowStepperProps = { orientation?: "vertical" | "horizontal"; className?: string; onNavigate?: (id: StepId) => void };

export default function WorkflowStepper({ orientation = "vertical", className, onNavigate }: WorkflowStepperProps) {
  const current = useTerraform((s) => s.currentStep);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const statuses = useStepStatuses();
  const activeRef = useRef<HTMLButtonElement>(null);
  const completeCount = Object.values(statuses).filter((s) => s === "complete").length;

  useEffect(() => {
    if (orientation === "horizontal") activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [current, orientation]);

  const go = (id: StepId) => {
    setCurrentStep(id);
    onNavigate?.(id);
  };

  if (orientation === "horizontal") {
    return (
      <nav aria-label="Workflow steps" className={cx("no-scrollbar -mx-4 overflow-x-auto px-4", className)}>
        <ol className="flex w-max gap-2 pb-1">
          {WORKFLOW_STEPS.map((s) => {
            const st = statuses[s.id];
            const active = s.id === current;
            return (
              <li key={s.id}>
                <button
                  ref={active ? activeRef : undefined}
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${s.n}: ${s.label} (${rubricStage(s.id).full}) — ${STATUS_META[st].label}`}
                  className={cx(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 font-heading text-sm transition-colors",
                    active ? "border-cyan/50 bg-gradient-to-r from-cyan/20 to-violet/20 text-ivory" : "border-white/10 bg-white/[0.03] text-mist",
                  )}
                >
                  <span className="font-display text-xs">{String(s.n).padStart(2, "0")}</span>
                  <span>{s.short}</span>
                  <StatusIcon status={st} className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Workflow steps" className={cx("glass rounded-2xl p-3", className)}>
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <span className="eyebrow">Expedition log</span>
        <span className="font-heading text-xs text-mist">{completeCount}/10 complete</span>
      </div>
      <div className="mx-2 mb-3 h-1 overflow-hidden rounded-full bg-white/8">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan to-violet" initial={false} animate={{ width: `${completeCount * 10}%` }} />
      </div>
      <ol className="relative space-y-1">
        {WORKFLOW_STEPS.map((s, i) => {
          const st = statuses[s.id];
          const active = s.id === current;
          const m = STATUS_META[st];
          return (
            <li key={s.id} className="relative">
              {i < WORKFLOW_STEPS.length - 1 && (
                <span className={cx("absolute left-[1.55rem] top-10 h-[calc(100%-1.5rem)] w-px", st === "complete" ? "bg-sprout/40" : "bg-white/10")} aria-hidden />
              )}
              <button
                type="button"
                onClick={() => go(s.id)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${s.n}: ${s.label} (${rubricStage(s.id).full}) — ${m.label}`}
                className={cx(
                  "group relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                  active ? "text-ivory" : "text-mist hover:bg-white/[0.04] hover:text-ivory",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="stepper-active"
                    className="absolute inset-0 rounded-xl border border-cyan/30 bg-gradient-to-r from-cyan/15 via-violet/12 to-transparent shadow-[0_0_30px_-12px_rgba(56,225,255,0.6)]"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                    aria-hidden
                  />
                )}
                <span
                  className={cx(
                    "relative grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-midnight font-display text-[0.7rem] font-bold",
                    m.ring,
                    active && "shadow-[0_0_0_3px_rgba(56,225,255,0.15)]",
                  )}
                >
                  {st === "complete" || st === "blocked" ? <StatusIcon status={st} className="h-4 w-4" /> : String(s.n).padStart(2, "0")}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-heading text-[0.92rem] font-semibold">{s.label}</span>
                  <span className="block text-xs">
                    <span className={m.text}>{m.label}</span>
                    <span className="text-mist/70"> · {rubricStage(s.id).short}</span>
                  </span>
                </span>
                {st !== "complete" && st !== "blocked" && <StatusIcon status={st} className="relative h-4 w-4 opacity-80" />}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
