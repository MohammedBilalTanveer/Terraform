import type { ReactNode } from "react";
import { Droplets, GlassWater, Shovel, Sprout } from "lucide-react";
import type { Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import RecommendationCard from "../../components/RecommendationCard";
import EvidenceChips from "../../components/EvidenceChips";
import { Badge, Empty, arr } from "../../components/ui";
import { NeedPlan } from "./common";

function Phase({ n, title, icon, recs, start }: { n: number; title: string; icon: ReactNode; recs: Recommendation[]; start: number }) {
  return (
    <section className="relative pl-12 sm:pl-14" aria-label={title}>
      <span className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan/30 to-violet/30 text-ivory shadow-[0_0_24px_-8px_rgba(56,225,255,0.7)] sm:h-10 sm:w-10">
        {icon}
      </span>
      <span className="absolute bottom-0 left-[1.1rem] top-12 w-px bg-gradient-to-b from-cyan/40 to-transparent sm:left-5" aria-hidden />
      <div className="mb-3 flex items-center gap-2 pt-1.5">
        <span className="eyebrow">Phase {n}</span>
        <h3 className="font-heading text-lg font-semibold text-ivory">{title}</h3>
        <Badge tone="stone">{recs.length}</Badge>
      </div>
      {recs.length ? (
        <ol className="grid gap-4">
          {recs.map((r, i) => (
            <li key={r.id}>
              <RecommendationCard rec={r} index={start + i} />
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
  if (!plan) return <NeedPlan />;
  const pm = plan.workflow.planting_method;
  const methods = arr(pm.methods);
  const water = arr(pm.water_capture);
  const sowing = arr(pm.sowing);
  const irrigation = arr(pm.irrigation);

  return (
    <div className="grid gap-8">
      <Phase n={1} title="Planting methods" icon={<Shovel className="h-5 w-5" aria-hidden />} recs={methods} start={1} />
      <Phase n={2} title="Water capture" icon={<Droplets className="h-5 w-5" aria-hidden />} recs={water} start={methods.length + 1} />
      <Phase n={3} title="Sowing" icon={<Sprout className="h-5 w-5" aria-hidden />} recs={sowing} start={methods.length + water.length + 1} />
      {irrigation.length > 0 && (
        <Phase
          n={4}
          title="Irrigation matched to scarce water"
          icon={<GlassWater className="h-5 w-5" aria-hidden />}
          recs={irrigation}
          start={methods.length + water.length + sowing.length + 1}
        />
      )}
      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={pm.evidence} />
      </div>
    </div>
  );
}
