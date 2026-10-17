import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Ban, Hammer, ListChecks, Sparkles, Waypoints } from "lucide-react";
import type { Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import RecommendationCard from "../../components/RecommendationCard";
import SkippableRec, { countRows, skippedLast } from "../../components/SkippableRec";
import EvidenceChips from "../../components/EvidenceChips";
import { Badge, Empty, Panel, SectionTitle, arr } from "../../components/ui";
import { fixProtocolRows, skipKind } from "../../components/workflow";
import { CollapsibleSection } from "../../components/Accordion";
import { NeedPlan } from "./common";

/** Scroll to a recommendation card and expand it (works with the cards' own collapsed state). */
function jumpToCard(recId: string) {
  const title = document.getElementById(`rec-${recId}`);
  const card = title?.closest("article") as HTMLElement | null;
  if (!card) return;
  card.style.scrollMarginTop = "7rem";
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  const toggle = [...card.querySelectorAll<HTMLButtonElement>("button[aria-expanded=false]")].find((b) => /Show steps/.test(b.innerText));
  toggle?.click();
  card.classList.add("resume-highlight");
  setTimeout(() => card.classList.remove("resume-highlight"), 2400);
}

/** Summary of the ways to build soil depth (pits / raised beds / containers) — titles and one-liners straight from the KB records. */
function DepthOptions({ recs }: { recs: Recommendation[] }) {
  return (
    <div className="mb-4 rounded-2xl border border-cyan/25 bg-cyan/[0.05] p-4" role="group" aria-label="Ways to build soil depth">
      <div className="eyebrow mb-2 !text-cyan-100">Ways to build soil depth</div>
      <ul className="grid gap-2">
        {recs.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => jumpToCard(r.id)} className="flex min-h-11 w-full items-start gap-3 rounded-xl border border-white/10 bg-midnight/40 px-3 py-2.5 text-left hover:border-cyan/40">
              <span className="min-w-0 flex-1">
                <span className="block font-heading font-semibold text-ivory">{r.title}</span>
                {r.explanation && <span className="mt-0.5 block text-sm leading-snug text-ivory/75">{r.explanation}</span>}
              </span>
              <span className="mt-0.5 shrink-0 font-heading text-sm font-semibold text-cyan-200">Show</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Column({ title, eyebrow, recs, icon, tone, openId, intro }: { title: string; eyebrow: string; recs: Recommendation[]; icon: ReactNode; tone: "cyan" | "violet" | "coral" | "stone"; openId?: string | null; intro?: ReactNode }) {
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const skipped = useTerraform((s) => s.skippedSteps);
  return (
    <section aria-label={title}>
      <SectionTitle icon={icon} eyebrow={eyebrow} title={title} right={<Badge tone={tone}>{recs.length}</Badge>} />
      {intro}
      {recs.length ? (
        <div className="grid gap-4">
          {skippedLast(recs, skipped).map((r) => (
            <SkippableRec key={r.id} rec={r} kind={skipKind(r, plan, completed)} collapsible defaultOpen={r.id === openId} />
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
  const skipped = useTerraform((s) => s.skippedSteps);
  if (!plan) return <NeedPlan />;
  const fp = plan.workflow.fix_protocol;
  // Every prepare item is a visible row. Readiness checks / sowing tasks only move off this page when they are
  // rendered on their own step (gate page / planting page) — see fixProtocolRows().
  const { doFirst, doNext, optional } = fixProtocolRows(plan);
  const moved = arr(fp.do_first).length + arr(fp.do_next).length + arr(fp.optional).length - doFirst.length - doNext.length - optional.length;
  const depthOptions = doFirst.filter((r) => r.category === "soil_depth");
  const all = [...doFirst, ...doNext, ...optional];
  const firstOpen = all.find((r) => r.task_id && !completed.includes(r.task_id) && !skipped.includes(r.task_id))?.id ?? all[0]?.id ?? null;
  const counts = countRows(all, completed, skipped);
  const pct = counts.total ? Math.round(((counts.done + counts.skipped) / counts.total) * 100) : 0;

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
              <span className="text-mist" aria-live="polite">{counts.done} of {counts.total} done{counts.skipped > 0 ? ` · ${counts.skipped} skipped` : ""}</span>
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
        <Column title="Do first" eyebrow="Priority 1" recs={doFirst} openId={firstOpen} intro={depthOptions.length > 1 ? <DepthOptions recs={depthOptions} /> : undefined} icon={<Hammer className="h-4 w-4" aria-hidden />} tone="cyan" />
        <Column title="Do next" eyebrow="Priority 2" recs={doNext} openId={firstOpen} icon={<ListChecks className="h-4 w-4" aria-hidden />} tone="violet" />
      </div>
      {arr(fp.avoid).length > 0 && (
        <CollapsibleSection icon={<Ban className="h-4 w-4" aria-hidden />} eyebrow="Do not" title="Avoid" count={arr(fp.avoid).length}>
          <div className="grid gap-4">
            {arr(fp.avoid).map((r) => <RecommendationCard key={r.id} rec={r} collapsible />)}
          </div>
        </CollapsibleSection>
      )}
      {optional.length > 0 && (
        <section aria-label="Optional">
          <SectionTitle
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            eyebrow="If you can"
            title="Optional"
            right={<Badge tone="violet">Optional — you can skip this</Badge>}
          />
          <div className="grid gap-4">
            {/* Expanded by default, cautions and limitations up front. */}
            {skippedLast(optional, skipped).map((r) => (
              <SkippableRec key={r.id} rec={r} kind={skipKind(r, plan, completed) ?? "optional"} collapsible defaultOpen detailOpen />
            ))}
          </div>
        </section>
      )}

      {moved > 0 && (
        <p className="rounded-xl border border-dashed border-white/12 px-4 py-3 text-sm text-mist">
          {moved} readiness / planting task{moved > 1 ? "s" : ""} {moved > 1 ? "are" : "is"} listed later, in order: readiness checks on step 5, sowing on step 8.
        </p>
      )}

      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={fp.evidence} />
      </div>
    </div>
  );
}
