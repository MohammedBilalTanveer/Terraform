// Shown INSTEAD of a checkbox whenever a task is locked (v1.4): lock icon + reason + a button to what unlocks it.
import { Lock } from "lucide-react";
import type { StepId } from "../types/terraform";
import type { LockReason } from "../store/workflowRules";
import { LOCK_MESSAGE } from "../store/workflowRules";
import { goToStep } from "./workflow";
import { cx } from "./ui";

export default function LockedTask({ reason, label, compact = false, className }: { reason: LockReason | null; label?: string; compact?: boolean; className?: string }) {
  const r: LockReason = reason ?? "choose_crop_and_pass_gate";
  // Crop is the first missing piece when both are; otherwise go straight to what is missing.
  const target: { step: StepId; cta: string } = r === "pass_gate" ? { step: "next_action", cta: "Open the readiness gate" } : { step: "crop_suggestions", cta: "Choose a crop" };
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber/30 bg-amber/[0.07] px-3 py-2", className)} role="group" aria-label={`Locked${label ? `: ${label}` : ""}`}>
      <Lock className="h-4 w-4 shrink-0 text-amber" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        {label && !compact && <div className="font-heading font-semibold text-ivory">{label}</div>}
        <div className="text-amber-100">Locked · {LOCK_MESSAGE[r]}</div>
        {r === "choose_crop_and_pass_gate" && !compact && (
          <button type="button" onClick={() => goToStep("next_action")} className="mt-0.5 text-xs text-amber-100/80 underline-offset-2 hover:underline">
            or open the readiness gate
          </button>
        )}
      </div>
      <button type="button" onClick={() => goToStep(target.step)} className="btn-ghost !px-3 !py-1.5 text-sm">
        {target.cta}
      </button>
    </div>
  );
}
