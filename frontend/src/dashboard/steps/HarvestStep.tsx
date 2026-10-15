import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Archive, Ban, CircleCheck, CircleHelp, Eye, Hand, Recycle, ScrollText, ShieldAlert, Trophy, Wheat, Wind } from "lucide-react";
import { useTerraform } from "../../store/terraformStore";
import EvidenceChips from "../../components/EvidenceChips";
import RecommendationCard from "../../components/RecommendationCard";
import { Badge, Panel, SectionTitle, arr } from "../../components/ui";
import { collectEvidence, planTaskRecs } from "../../components/workflow";
import { ListPanel, NeedPlan } from "./common";

export default function HarvestStep() {
  const markHarvested = useTerraform((st) => st.markHarvested);
  const harvestedAt = useTerraform((st) => st.harvestedAt);
  const season = useTerraform((st) => st.season);
  const plan = useTerraform((s) => s.plan);
  const analysis = useTerraform((s) => s.analysis);
  const completed = useTerraform((s) => s.completedTasks);
  const accepted = useTerraform((s) => s.acceptedRisks);
  const unable = useTerraform((s) => s.unableChecks ?? []);
  const gateResults = useTerraform((s) => s.gateResults ?? {});
  const openEvidence = useTerraform((s) => s.openEvidence);
  if (!plan) return <NeedPlan />;
  const hv = plan.workflow.harvest;
  const cs = plan.workflow.crop_suggestions;
  const crop = [...arr(cs?.field_crops), ...arr(cs?.tree_options)].find((c) => c.crop_id === hv.crop_id);

  const tasks = planTaskRecs(plan);
  const doneTasks = tasks.filter((t) => t.task_id && completed.includes(t.task_id));
  const gates = arr(plan.workflow.next_action?.readiness_gate);
  const acceptedGates = gates.filter((g) => g.accepted_risk || accepted.includes(g.id));
  const failedTests = gates.filter((g) => (gateResults[g.id] ?? g.test_result) === "fail" && !acceptedGates.includes(g));
  const unknowns = arr(analysis?.missing_analysis?.unknowns);
  const checks = arr(analysis?.missing_analysis?.checks);
  const ledger = collectEvidence({ plan, analysis });

  return (
    <div className="grid gap-6">
      {crop && (
        <Panel className="flex items-center gap-3 p-4">
          <Wheat className="h-5 w-5 text-amber" aria-hidden />
          <span className="text-sm text-ivory/90">Harvest guidance for <strong className="font-heading text-ivory">{crop.name}</strong></span>
        </Panel>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <ListPanel title="Ripeness — what you see" icon={<Eye className="h-4 w-4" aria-hidden />} items={hv.ripeness_cues_see} tone="cyan" />
        <ListPanel title="Ripeness — what you feel" icon={<Hand className="h-4 w-4" aria-hidden />} items={hv.ripeness_cues_feel} tone="violet" />
      </div>
      <ListPanel title="How to harvest" icon={<Wheat className="h-4 w-4" aria-hidden />} items={hv.method} ordered />
      <div className="grid gap-5 md:grid-cols-2">
        <ListPanel title="Drying & storage" icon={<Wind className="h-4 w-4" aria-hidden />} items={hv.drying_storage} tone="cyan" />
        <ListPanel title="Do not store" icon={<Ban className="h-4 w-4" aria-hidden />} items={hv.do_not_store} tone="coral" className="!border-coral/25" />
      </div>
      <ListPanel title="Crop residue" icon={<Recycle className="h-4 w-4" aria-hidden />} items={hv.residue_handling} tone="sprout" />

      {arr(hv.regeneration).length > 0 && (
        <section>
          <SectionTitle icon={<Recycle className="h-4 w-4" aria-hidden />} eyebrow="After harvest" title="Regenerate the soil" />
          <div className="grid gap-4">
            {hv.regeneration.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </div>
        </section>
      )}
      <EvidenceChips evidence={hv.evidence} />

      {/* Completion summary */}
      <Panel className="hero-ring relative overflow-hidden p-5 sm:p-7">
        <span className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-violet/25 via-fuchsia-500/10 to-transparent blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-3">
            <motion.span initial={{ rotate: -15, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet to-pink-500 text-ivory">
              <Trophy className="h-6 w-6" aria-hidden />
            </motion.span>
            <div>
              <div className="eyebrow">Expedition summary</div>
              <h3 className="font-display text-xl font-bold tracking-wide text-ivory">Season debrief</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Tasks done" value={`${doneTasks.length}/${tasks.length}`} icon={<CircleCheck className="h-4 w-4 text-sprout" aria-hidden />} />
            <Stat label="Unresolved risks" value={String(acceptedGates.length + failedTests.length + unknowns.length)} icon={<ShieldAlert className="h-4 w-4 text-amber" aria-hidden />} />
            <Stat label="Evidence records" value={String(ledger.kb_ids.length)} icon={<ScrollText className="h-4 w-4 text-violet-300" aria-hidden />} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/25 bg-amber-300/[0.06] p-4">
            <div className="min-w-0 flex-1 text-sm text-ivory/80">
              {harvestedAt
                ? `Season ${season} harvest recorded. Open the ending to start season ${season + 1}.`
                : "When you have picked the crop using the ripeness signs above, record the harvest to finish the season."}
            </div>
            <button type="button" className="btn-primary" onClick={markHarvested}>
              {harvestedAt ? "Open season ending" : "Complete the harvest"}
            </button>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">Completed tasks</div>
              {doneTasks.length ? (
                <ul className="space-y-1.5">
                  {doneTasks.map((t) => (
                    <li key={t.task_id} className="flex items-center gap-2 text-sm text-ivory/90">
                      <CircleCheck className="h-4 w-4 shrink-0 text-sprout" aria-hidden /> {t.task_label ?? t.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mist">No tasks marked done yet.</p>
              )}
            </div>
            <div>
              <div className="eyebrow mb-2">Unresolved risks</div>
              {acceptedGates.length + failedTests.length + unknowns.length === 0 ? (
                <p className="text-sm text-mist">None recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {acceptedGates.map((g) => (
                    <li key={g.id} className="flex items-start gap-2 text-sm text-ivory/90">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
                      <span>{g.label} <Badge tone="amber" className="ml-1">accepted risk</Badge></span>
                    </li>
                  ))}
                  {failedTests.map((g) => (
                    <li key={g.id} className="flex items-start gap-2 text-sm text-ivory/90">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden />
                      <span>{g.label} <Badge tone="coral" className="ml-1">test failed</Badge></span>
                    </li>
                  ))}
                  {unknowns.map((u) => {
                    const notPossible = arr(u.check_ids).some((c) => unable.includes(c));
                    return (
                      <li key={u.id} className="flex items-start gap-2 text-sm text-ivory/90">
                        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-mist" aria-hidden />
                        <span>{u.label} <Badge tone="stone" className="ml-1">{notPossible ? "check not possible" : "unknown"}</Badge></span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {checks.length > 0 && <p className="mt-2 text-xs text-mist">{checks.length} field checks were suggested in step 03.</p>}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-midnight/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-heading font-semibold text-ivory">
                <Archive className="h-4 w-4 text-violet-300" aria-hidden /> Evidence ledger
              </div>
              <span className="text-xs text-mist">{ledger.kb_ids.length} knowledge-base records used by this plan</span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {ledger.kb_ids.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => openEvidence(id)} className="rounded-md border border-violet/30 bg-violet/10 px-2 py-1 font-mono text-xs text-violet-200 hover:border-violet/60">
                    {id}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-1.5 text-sm text-mist">{icon}{label}</div>
      <div className="mt-1 font-display text-3xl font-black text-ivory">{value}</div>
    </div>
  );
}
