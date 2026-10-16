import { useState, type ReactNode } from "react";
import { Eye, Lock } from "lucide-react";
import type { StepId, StepStatus } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import EvidenceChips from "../components/EvidenceChips";
import { Badge, BulletList, Panel, StatusBadge, arr } from "../components/ui";
import { getStepMeta, goToStep, rubricStage, stepIndex, stepInfo, useStepPrereqs } from "../components/workflow";

export default function StepFrame({ step, status, children }: { step: StepId; status: StepStatus; children: ReactNode }) {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const [viewAnyway, setViewAnyway] = useState(false);
  const info = stepInfo(step);
  const meta = getStepMeta(step, analysis, plan);
  const blockedUntil = stepIndex(step) > stepIndex("next_action") ? arr(plan?.workflow?.next_action?.blocked_until) : [];
  const prereqs = useStepPrereqs(step);
  const lockedByPrereq = prereqs.length > 0;
  const blocked = status === "blocked" || lockedByPrereq;
  // The readiness gate is where a block gets resolved, so its content is never hidden.
  const gatePage = step === "next_action";
  // Planting / Care / Harvest always show their content: their tasks are individually locked, so nothing can be ticked early.
  const showContent = !blocked || viewAnyway || gatePage || lockedByPrereq;

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-sm font-bold tracking-[0.25em] text-cyan-200">
            STEP {String(info.n).padStart(2, "0")}<span className="text-mist/50"> / 10</span>
          </span>
          <Badge tone="violet" title="Official evaluation rubric stage">{rubricStage(step).full}</Badge>
          <StatusBadge status={status} />
        </div>
        <h2 className="mt-2 font-display text-[clamp(1.6rem,3.6vw,2.4rem)] font-bold leading-tight tracking-wide text-ivory">{info.label}</h2>
        {meta?.title && meta.title !== info.label && <p className="mt-1 font-heading text-lg text-ivory/75">{meta.title}</p>}
        {meta && arr(meta.evidence?.kb_ids).length > 0 && (
          <EvidenceChips evidence={meta.evidence} compact className="mt-3" />
        )}
      </header>

      {blocked && (
        <Panel className="mb-6 !border-coral/35 p-5" role="status">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-[12rem] flex-1">
              <div className="font-heading font-semibold text-rose-100">{lockedByPrereq ? "Locked until the earlier steps are done" : "This step is blocked"}</div>
              {lockedByPrereq && (
                <ul className="mt-2 grid gap-2">
                  {prereqs.map((p) => (
                    <li key={p.key} className="flex flex-wrap items-center gap-2 text-sm text-ivory/90">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-coral" aria-hidden />
                      <span className="min-w-0 flex-1">{p.label}</span>
                      <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => goToStep(p.step)}>{p.cta}</button>
                    </li>
                  ))}
                </ul>
              )}
              {meta?.summary && <p className="mt-1 text-sm leading-relaxed text-ivory/80">{meta.summary}</p>}
              {arr(meta?.warnings).length > 0 && <BulletList items={meta!.warnings} tone="coral" className="mt-2" />}
              {!lockedByPrereq && blockedUntil.length > 0 && (
                <div className="mt-3">
                  <div className="eyebrow mb-1">Blocked until</div>
                  <BulletList items={blockedUntil} tone="coral" />
                </div>
              )}
            </div>
            {!showContent && (
              <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => setViewAnyway(true)}>
                <Eye className="h-4 w-4" aria-hidden /> View anyway
              </button>
            )}
          </div>
        </Panel>
      )}

      {showContent && children}
    </div>
  );
}
