import { useState, type ReactNode } from "react";
import { ChevronDown, Droplets, FlaskConical, GlassWater, Shovel, Sprout } from "lucide-react";
import type { Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import SkippableRec, { countRows, skippedLast } from "../../components/SkippableRec";
import EvidenceChips from "../../components/EvidenceChips";
import { Badge, Empty, arr, cx } from "../../components/ui";
import { CollapsibleSection } from "../../components/Accordion";
import CheckCardView, { useCheckProgress } from "../../components/CheckCardView";
import { checksOfPhase, plantingRows, skipKind, useAllChecks } from "../../components/workflow";
import { NeedPlan } from "./common";

type RowCtx = { kindOf: (r: Recommendation) => ReturnType<typeof skipKind>; noteOf: (r: Recommendation) => string | undefined; skipped: string[] };

function Phase({ n, title, icon, recs, start, openId, foldable = false, ctx }: { n: number; title: string; icon: ReactNode; recs: Recommendation[]; start: number; openId: string | null; foldable?: boolean; ctx: RowCtx }) {
  // A fold-away phase stays open when it holds real tasks — no step may hide behind a closed section.
  const [open, setOpen] = useState(!foldable || recs.some((r) => r.task_id));
  return (
    <section className="relative pl-12 sm:pl-14" aria-label={title}>
      <span className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan/30 to-violet/30 text-ivory shadow-[0_0_24px_-8px_rgba(56,225,255,0.7)] sm:h-10 sm:w-10">
        {icon}
      </span>
      <span className="absolute bottom-0 left-[1.1rem] top-12 w-px bg-gradient-to-b from-cyan/40 to-transparent sm:left-5" aria-hidden />
      <div className="mb-3 flex items-center gap-2 pt-1.5">
        <span className="eyebrow">Phase {n}</span>
        {foldable ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-10 items-center gap-1.5 font-heading text-lg font-semibold text-ivory">
            {title} <ChevronDown className={cx("h-4 w-4 text-mist transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        ) : (
          <h3 className="font-heading text-lg font-semibold text-ivory">{title}</h3>
        )}
        <Badge tone="stone">{recs.length}</Badge>
      </div>
      {!open ? null : recs.length ? (
        <ol className="grid gap-4">
          {skippedLast(recs, ctx.skipped).map((r, i) => (
            <li key={r.id}>
              <SkippableRec rec={r} kind={ctx.kindOf(r)} noteText={ctx.noteOf(r)} index={start + i} collapsible defaultOpen={r.id === openId} />
            </li>
          ))}
        </ol>
      ) : (
        <Empty>Nothing in this phase for your land.</Empty>
      )}
    </section>
  );
}

export default function PlantingMethodStep() {
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const preChecks = checksOfPhase(useAllChecks(), "pre_plant");
  const preProgress = useCheckProgress(preChecks);
  const selectedCropId = useTerraform((s) => s.selectedCropId);
  if (!plan) return <NeedPlan />;
  const skipped = useTerraform((s) => s.skippedSteps);
  // Readiness checks are completed at the gate (step 5); everything else is listed here (see plantingRows()).
  const { methods, water, sowing, irrigation } = plantingRows(plan);
  const crops = [...arr(plan.workflow.crop_suggestions?.field_crops), ...arr(plan.workflow.crop_suggestions?.tree_options)];
  const isTree = crops.find((c) => c.crop_id === selectedCropId)?.category === "tree";
  // Planting tree seedlings is REQUIRED for a tree crop, otherwise it is an optional long-term step.
  const ctx: RowCtx = {
    kindOf: (r) => (r.task_id === "task_plant_tree_seedlings" ? (isTree ? null : "optional") : skipKind(r, plan, completed)),
    noteOf: (r) => (r.task_id === "task_plant_tree_seedlings" ? (isTree ? "Required for tree crops" : "Optional — long-term") : undefined),
    skipped,
  };
  const all = [...methods, ...water, ...sowing, ...irrigation];
  const counts = countRows(all, completed, skipped);
  // Cards start collapsed so the page stays short; the first actionable card is highlighted by the resume scroll.
  const openId: string | null = null;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <Badge tone={counts.done === counts.total && counts.total > 0 ? "sprout" : "cyan"}>
          {counts.done} of {counts.total} done{counts.skipped > 0 ? ` · ${counts.skipped} skipped` : ""}
        </Badge>
        <span className="text-sm text-mist">Planting tasks unlock after a crop is chosen and the readiness gate has passed.</span>
      </div>
      <Phase n={1} title="Planting methods" icon={<Shovel className="h-5 w-5" aria-hidden />} recs={methods} start={1} openId={openId} ctx={ctx} />
      <Phase n={2} title="Water capture" foldable icon={<Droplets className="h-5 w-5" aria-hidden />} recs={water} start={methods.length + 1} openId={openId} ctx={ctx} />
      {preChecks.length > 0 && (
        <CollapsibleSection
          icon={<FlaskConical className="h-4 w-4" aria-hidden />}
          eyebrow={`${preProgress.done} of ${preChecks.length} checks done`}
          title="Before you sow"
          count={preChecks.length}
          defaultOpen
          id="before-you-sow"
        >
          <p className="mb-3 text-sm text-mist">Do these quick checks first — the results decide which seeds go in which spot.</p>
          <div className="grid gap-4">
            {preChecks.map((c) => (
              <CheckCardView key={c.id} card={c} />
            ))}
          </div>
        </CollapsibleSection>
      )}
      <Phase n={3} title="Sowing" icon={<Sprout className="h-5 w-5" aria-hidden />} recs={sowing} start={methods.length + water.length + 1} openId={openId} ctx={ctx} />
      {irrigation.length > 0 && (
        <Phase
          n={4}
          title="Irrigation matched to scarce water"
          foldable
          icon={<GlassWater className="h-5 w-5" aria-hidden />}
          recs={irrigation}
          start={methods.length + water.length + sowing.length + 1}
          openId={openId}
          ctx={ctx}
        />
      )}
      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={plan.workflow.planting_method.evidence} />
      </div>
    </div>
  );
}
