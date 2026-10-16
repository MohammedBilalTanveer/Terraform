import type { ReactNode } from "react";
import { ClipboardList, Route, ScanSearch } from "lucide-react";
import type { StepId } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import { EmptyState, SkeletonCards, Spinner } from "../../components/LoadingAndError";
import { BulletList, cx } from "../../components/ui";

export function useGo() {
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  return (id: StepId) => {
    setCurrentStep(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

export function NeedAnalysis() {
  const go = useGo();
  const loading = useTerraform((s) => s.loading);
  if (loading === "analyze") return <SkeletonCards count={2} />;
  return (
    <EmptyState
      icon={<ScanSearch className="h-7 w-7" aria-hidden />}
      title="No observation analysed yet"
      body="This step is built from the analysis of your observation. Describe the land first."
      action={
        <button type="button" className="btn-primary" onClick={() => go("observation_log")}>
          <ClipboardList className="h-4 w-4" aria-hidden /> Go to observation log
        </button>
      }
    />
  );
}

export function NeedPlan() {
  const go = useGo();
  const analysis = useTerraform((s) => s.analysis);
  const loading = useTerraform((s) => s.loading);
  const generatePlan = useTerraform((s) => s.generatePlan);
  if (loading === "plan") return <SkeletonCards count={3} />;
  if (!analysis) return <NeedAnalysis />;
  return (
    <EmptyState
      icon={<Route className="h-7 w-7" aria-hidden />}
      title="No restoration plan yet"
      body="Your observation has been analysed. Generate the plan to unlock this step — you can still refine checks afterwards."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => void generatePlan()} disabled={!!loading}>
            {loading ? <Spinner label="Working…" /> : <><Route className="h-4 w-4" aria-hidden /> Generate restoration plan</>}
          </button>
          <button type="button" className="btn-ghost" onClick={() => go("missing_analysis")}>
            Review checks first
          </button>
        </div>
      }
    />
  );
}

/** A titled list block for API string arrays. Renders nothing when empty. */
export function ListPanel({
  title,
  icon,
  items,
  tone = "stone",
  ordered,
  className,
  emptyText,
}: {
  title: string;
  icon?: ReactNode;
  items: string[] | null | undefined;
  tone?: "stone" | "cyan" | "amber" | "coral" | "sprout" | "violet";
  ordered?: boolean;
  className?: string;
  emptyText?: string;
}) {
  const list = items ?? [];
  if (!list.length && !emptyText) return null;
  return (
    <section className={cx("glass rounded-2xl p-5", className)}>
      <h3 className="mb-3 flex items-center gap-2 font-heading font-semibold text-ivory">
        {icon && <span className="text-cyan-200">{icon}</span>}
        {title}
      </h3>
      {list.length ? <BulletList items={list} tone={tone} ordered={ordered} /> : <p className="text-sm text-mist">{emptyText}</p>}
    </section>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const tone: Record<string, string> = {
    form: "border-cyan/30 bg-cyan/10 text-cyan-100",
    description: "border-violet/30 bg-violet/10 text-violet-100",
    local_advice: "border-amber/30 bg-amber/10 text-amber-100",
    check: "border-sprout/30 bg-sprout/10 text-emerald-100",
    photo: "border-white/15 bg-white/5 text-mist",
  };
  const label: Record<string, string> = { form: "Form", description: "Your words", local_advice: "Local advice", check: "Field check", photo: "Photo" };
  return (
    <span className={cx("inline-flex items-center rounded-md border px-1.5 py-0.5 font-heading text-[0.75rem] font-semibold uppercase tracking-wider", tone[source] ?? tone.photo)}>
      {label[source] ?? source}
    </span>
  );
}
