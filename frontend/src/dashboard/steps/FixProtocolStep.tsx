import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Ban, Hammer, ListChecks, Sparkles, Waypoints } from "lucide-react";
import type { Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import RecommendationCard from "../../components/RecommendationCard";
import EvidenceChips from "../../components/EvidenceChips";
import { Badge, Empty, Panel, SectionTitle, arr } from "../../components/ui";
import { NeedPlan } from "./common";

function Column({ title, eyebrow, recs, icon, tone }: { title: string; eyebrow: string; recs: Recommendation[]; icon: ReactNode; tone: "cyan" | "violet" | "coral" | "stone" }) {
  return (
    <section aria-label={title}>
      <SectionTitle icon={icon} eyebrow={eyebrow} title={title} right={<Badge tone={tone}>{recs.length}</Badge>} />
      {recs.length ? (
        <div className="grid gap-4">
          {recs.map((r) => (
            <RecommendationCard key={r.id} rec={r} />
          ))}
        </div>
      ) : (
        <Empty>Nothing in this group for your land.</Empty>
      )}
    </section>
  );
}

export default function FixProtocolStep() {
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  if (!plan) return <NeedPlan />;
  const fp = plan.workflow.fix_protocol;
  const all = [...arr(fp.do_first), ...arr(fp.do_next), ...arr(fp.optional)];
  const taskIds = [...new Set(all.map((r) => r.task_id).filter((t): t is string => !!t))];
  const done = taskIds.filter((t) => completed.includes(t)).length;
  const pct = taskIds.length ? Math.round((done / taskIds.length) * 100) : 0;

  return (
    <div className="grid gap-6">
      <Panel className="hero-ring relative overflow-hidden p-5 sm:p-6">
        <span className="pointer-events-none absolute -left-10 -top-20 h-56 w-72 rounded-full bg-gradient-to-br from-cyan/20 to-violet/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="eyebrow">Situation</div>
          <p className="mt-1 text-[1.05rem] leading-relaxed text-ivory/90">{plan.situation_summary}</p>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-heading font-semibold text-ivory">
                <ListChecks className="h-4 w-4 text-cyan" aria-hidden /> Restoration tasks
              </span>
              <span className="text-mist">{done}/{taskIds.length} done</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Restoration tasks complete">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan via-violet to-sprout" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
            </div>
          </div>
        </div>
      </Panel>

      {arr(plan.adaptations).length > 0 && (
        <Panel className="relative overflow-hidden !border-violet/30 p-5 sm:p-6">
          <span className="absolute inset-0 bg-gradient-to-br from-violet/15 via-fuchsia-500/5 to-transparent" aria-hidden />
          <div className="relative">
            <SectionTitle icon={<Sparkles className="h-4 w-4" aria-hidden />} eyebrow="Adapted to your observation" title="Why this plan" />
            <ul className="grid gap-3 md:grid-cols-2">
              {plan.adaptations.map((a, i) => (
                <motion.li
                  key={a.trigger_tag + i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-xl border border-violet/25 bg-midnight/50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Waypoints className="h-4 w-4 text-violet-300" aria-hidden />
                    <span className="font-heading font-semibold text-ivory">{a.label}</span>
                    <code className="rounded bg-violet/15 px-1.5 py-0.5 font-mono text-xs text-violet-200">{a.trigger_tag}</code>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ivory/80">{a.effect}</p>
                  <EvidenceChips evidence={{ kb_ids: arr(a.kb_ids), source_ids: [] }} compact className="mt-2" />
                </motion.li>
              ))}
            </ul>
          </div>
        </Panel>
      )}

      <div className="grid gap-6 2xl:grid-cols-2">
        <Column title="Do first" eyebrow="Priority 1" recs={arr(fp.do_first)} icon={<Hammer className="h-4 w-4" aria-hidden />} tone="cyan" />
        <Column title="Do next" eyebrow="Priority 2" recs={arr(fp.do_next)} icon={<ListChecks className="h-4 w-4" aria-hidden />} tone="violet" />
      </div>
      <Column title="Avoid" eyebrow="Do not" recs={arr(fp.avoid)} icon={<Ban className="h-4 w-4" aria-hidden />} tone="coral" />
      {arr(fp.optional).length > 0 && <Column title="Optional" eyebrow="If you can" recs={fp.optional} icon={<Sparkles className="h-4 w-4" aria-hidden />} tone="stone" />}

      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={fp.evidence} />
      </div>
    </div>
  );
}
