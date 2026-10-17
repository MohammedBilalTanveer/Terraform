import { useState, type ReactNode } from "react";
import { ChevronDown, Droplets, FlaskConical, GlassWater, Shovel, Sprout } from "lucide-react";
import type { Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import RecommendationCard from "../../components/RecommendationCard";
import EvidenceChips from "../../components/EvidenceChips";
import { Badge, Empty, arr, cx } from "../../components/ui";
import { CollapsibleSection } from "../../components/Accordion";
import CheckCardView, { useCheckProgress } from "../../components/CheckCardView";
import { checksOfPhase, recLock, taskPhase, useAllChecks } from "../../components/workflow";
import { NeedPlan } from "./common";

function Phase({ n, title, icon, recs, start, openId, foldable = false }: { n: number; title: string; icon: ReactNode; recs: Recommendation[]; start: number; openId: string | null; foldable?: boolean }) {
  const [open, setOpen] = useState(!foldable);
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
          {recs.map((r, i) => (
            <li key={r.id}>
              <RecommendationCard rec={r} index={start + i} collapsible defaultOpen={r.id === openId} />
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
  const pm = plan.workflow.planting_method;
  // Readiness checks are completed at the gate (step 5) — keep this page in the one visible order.
  const notReadiness = (r: Recommendation) => taskPhase(r, plan) !== "readiness";
  const methods = arr(pm.methods).filter(notReadiness);
  const water = arr(pm.water_capture).filter(notReadiness);
  const sowing = arr(pm.sowing).filter(notReadiness);
  const irrigation = arr(pm.irrigation).filter(notReadiness);
  // Open the first card whose task can be done now; otherwise the first card.
  const ordered = [...methods, ...water, ...sowing, ...irrigation];
  // Cards start collapsed so the page stays short; the first actionable card is highlighted by the resume scroll.
  const openId: string | null = null;

  return (
    <div className="grid gap-8">
      <Phase n={1} title="Planting methods" icon={<Shovel className="h-5 w-5" aria-hidden />} recs={methods} start={1} openId={openId} />
      <Phase n={2} title="Water capture" foldable icon={<Droplets className="h-5 w-5" aria-hidden />} recs={water} start={methods.length + 1} openId={openId} />
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
      <Phase n={3} title="Sowing" icon={<Sprout className="h-5 w-5" aria-hidden />} recs={sowing} start={methods.length + water.length + 1} openId={openId} />
      {irrigation.length > 0 && (
        <Phase
          n={4}
          title="Irrigation matched to scarce water"
          foldable
          icon={<GlassWater className="h-5 w-5" aria-hidden />}
          recs={irrigation}
          start={methods.length + water.length + sowing.length + 1}
          openId={openId}
        />
      )}
      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={pm.evidence} />
      </div>
    </div>
  );
}
