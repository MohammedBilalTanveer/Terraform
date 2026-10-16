// The ending shown after the harvest (from the 3D Harvest Point or Dashboard step 10).
// Celebration + recap are UI copy; every piece of advice shown here comes from the plan (KB records + KB IDs).
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, RotateCcw, Sprout, Trophy, Wheat } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { useGame } from "../game/gameStore";
import EvidenceChips from "./EvidenceChips";
import { restartEverything } from "./RestartButton";

export default function SeasonComplete() {
  const open = useTerraform((s) => s.endingOpen);
  const plan = useTerraform((s) => s.plan);
  const season = useTerraform((s) => s.season);
  const selectedCropId = useTerraform((s) => s.selectedCropId);
  const completed = useTerraform((s) => s.completedTasks);
  const gateResults = useTerraform((s) => s.gateResults);
  const accepted = useTerraform((s) => s.acceptedRisks);
  const mode = useTerraform((s) => s.mode);
  const dismiss = useTerraform((s) => s.dismissEnding);
  const nextSeason = useTerraform((s) => s.startNextSeason);
  const setMode = useTerraform((s) => s.setMode);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);

  const hv = plan?.workflow.harvest;
  const crops = [...(plan?.workflow.crop_suggestions.field_crops ?? []), ...(plan?.workflow.crop_suggestions.tree_options ?? [])];
  const crop = crops.find((c) => c.crop_id === (selectedCropId ?? hv?.crop_id));
  const passed = Object.values(gateResults ?? {}).filter((r) => r === "pass").length;

  const startNext = () => {
    useGame.setState({ farm: { key: null, sown: false, careIdx: 0, harvested: false }, overlay: null });
    nextSeason();
    setMode("dashboard");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="tap-scope fixed inset-0 z-[60] flex overflow-y-auto bg-[#050814]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Season ${season} complete`}
        >
          {/* soft golden sparkles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-amber-200/80"
                style={{ left: `${(i * 37) % 100}%`, top: "105%" }}
                animate={{ y: ["0vh", "-115vh"], opacity: [0, 1, 0] }}
                transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: (i % 8) * 0.6, ease: "easeOut" }}
              />
            ))}
          </div>

          <motion.div
            initial={{ y: 30, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            className="relative m-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-200/25 bg-gradient-to-b from-[#141b35] to-[#0a0f22] p-6 shadow-2xl sm:p-8"
          >
            <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-amber-300/25 via-coral/15 to-transparent blur-3xl" aria-hidden />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-coral text-[#1a1003]">
                  <Trophy className="h-7 w-7" aria-hidden />
                </span>
                <div>
                  <div className="font-display text-[12px] tracking-[0.35em] text-amber-200">TERRAFORM // SEASON {season} COMPLETE</div>
                  <h2 className="font-display text-2xl font-bold tracking-wide text-ivory sm:text-3xl">
                    You harvested {crop?.name ?? "your crop"}.
                  </h2>
                </div>
              </div>

              <p className="mt-4 font-heading text-[15px] leading-relaxed text-ivory/80">
                <span className="text-cyan-200">TERRA:</span> “From bare red stone to food in your hands. The land is not finished — every
                season you return organic matter to it, the soil gets a little deeper and holds a little more water. Here is
                what the knowledge base says to do now.”
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat icon={<Sprout className="h-4 w-4 text-sprout" />} label="Tasks completed" value={String(completed.length)} />
                <Stat icon={<Wheat className="h-4 w-4 text-amber-200" />} label="Readiness tests passed" value={String(passed)} />
                <Stat icon={<RotateCcw className="h-4 w-4 text-coral" />} label="Risks you accepted" value={String(accepted.length)} />
              </div>

              {hv && (
                <div className="mt-6 space-y-4">
                  {!!hv.drying_storage?.length && (
                    <Section title="1 · Store the harvest">
                      <List items={hv.drying_storage.slice(0, 3)} />
                    </Section>
                  )}
                  {!!hv.residue_handling?.length && (
                    <Section title="2 · Return what is left to the soil">
                      <List items={hv.residue_handling.slice(0, 3)} />
                    </Section>
                  )}
                  {!!hv.regeneration?.length && (
                    <Section title="3 · Rebuild the land for next season">
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {hv.regeneration.slice(0, 6).map((r) => (
                          <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="font-heading text-[14px] font-semibold text-ivory">{r.title}</div>
                            {r.explanation && <p className="mt-1 text-[12.5px] leading-relaxed text-ivory/70">{r.explanation}</p>}
                            <EvidenceChips evidence={r.evidence} compact className="mt-2" />
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  <EvidenceChips evidence={hv.evidence} compact />
                </div>
              )}

              <div className="mt-7 flex flex-wrap gap-2">
                <button type="button" onClick={startNext} className="btn-primary inline-flex items-center gap-2">
                  Start season {season + 1} <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismiss();
                    setCurrentStep("harvest");
                    setMode("dashboard");
                  }}
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden /> View season debrief
                </button>
                {mode === "explorer" && (
                  <button type="button" onClick={dismiss} className="btn-ghost inline-flex items-center gap-2">
                    Keep exploring the valley
                  </button>
                )}
                <button type="button" onClick={restartEverything} className="btn-ghost inline-flex items-center gap-2 text-rose-100">
                  <RotateCcw className="h-4 w-4" aria-hidden /> Restart from the beginning
                </button>
              </div>
              <p className="mt-3 text-[12px] text-ivory/45">
                “Start season {season + 1}” keeps your land notes and journal, clears this season’s plan, tasks and tests, and takes you back to
                Step 1 so you can describe what changed (deeper soil, new pits, where water now goes) and get a new plan from the knowledge base.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-[0.15em] text-ivory/55">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-2xl text-ivory">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-heading text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">{title}</h3>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ivory/85">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}
