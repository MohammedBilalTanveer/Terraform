import { useState } from "react";
import { motion } from "framer-motion";
import { Ban, ChevronDown, CircleDashed, CircleHelp, Eye, FlaskConical, GitMerge, Lock, Route, ShieldAlert, Sparkles, TriangleAlert, Waypoints } from "lucide-react";
import type { CheckCard, FailureFactor } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import EvidenceChips from "../../components/EvidenceChips";
import { ErrorState, Spinner } from "../../components/LoadingAndError";
import { Badge, BulletList, Empty, Panel, SectionTitle, arr, cx } from "../../components/ui";
import { NeedAnalysis, useGo } from "./common";

const STRENGTH = { weak: 1, partial: 2, strong: 3 } as const;

export default function MissingAnalysisStep() {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const loading = useTerraform((s) => s.loading);
  const error = useTerraform((s) => s.error);
  const generatePlan = useTerraform((s) => s.generatePlan);
  const go = useGo();
  const [planError, setPlanError] = useState(false);
  if (!analysis) return <NeedAnalysis />;
  const ma = analysis.missing_analysis;
  const arch = ma.archetype;
  const strength = STRENGTH[arch?.match_strength] ?? 0;

  const onGenerate = async () => {
    setPlanError(false);
    const p = await generatePlan();
    if (p) go("fix_protocol");
    else setPlanError(true);
  };

  return (
    <div className="grid gap-5">
      {/* Archetype */}
      {arch && (
        <Panel className="hero-ring relative overflow-hidden p-5 sm:p-6">
          <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-terracotta/25 to-coral/5 blur-3xl" aria-hidden />
          <div className="relative grid gap-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="eyebrow">Land archetype</div>
              <h3 className="mt-1 font-display text-xl font-bold tracking-wide text-gradient-tc sm:text-2xl">{arch.label}</h3>
              <p className="mt-2 leading-relaxed text-ivory/85">{arch.statement}</p>
            </div>
            <div className="min-w-[12rem]">
              <div className="eyebrow mb-2">Match strength</div>
              <div className="flex gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={3} aria-valuenow={strength} aria-label={`Match strength: ${arch.match_strength}`}>
                {[1, 2, 3].map((b) => (
                  <motion.span
                    key={b}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: b * 0.12 }}
                    className={cx("h-2.5 flex-1 origin-left rounded-full", b <= strength ? "bg-gradient-to-r from-terracotta to-coral" : "bg-white/10")}
                  />
                ))}
              </div>
              <div className="mt-1.5 font-heading text-sm font-semibold capitalize text-coral">{arch.match_strength}</div>
            </div>
          </div>
          <div className="relative mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">Matched signals</div>
              <div className="flex flex-wrap gap-1.5">
                {arr(arch.matched_signals).length ? arch.matched_signals.map((s) => <Badge key={s} tone="terracotta">{s}</Badge>) : <span className="text-sm text-mist">None yet</span>}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Missing signals</div>
              <div className="flex flex-wrap gap-1.5">
                {arr(arch.missing_signals).length ? (
                  arch.missing_signals.map((s) => <Badge key={s} tone="stone" icon={<CircleDashed className="h-3 w-3" aria-hidden />}>{s}</Badge>)
                ) : (
                  <span className="text-sm text-mist">None</span>
                )}
              </div>
            </div>
          </div>
          <div className="relative mt-4 border-t border-white/8 pt-3">
            <EvidenceChips evidence={arch.evidence} />
          </div>
        </Panel>
      )}

      {/* Root causes (v1.1) */}
      {arr(ma.failure_factors).length > 0 && <FailureFactors factors={ma.failure_factors!} />}

      {/* Conflicts */}
      {arr(ma.conflicts).length > 0 && (
        <Panel className="!border-amber/30 p-5">
          <SectionTitle icon={<GitMerge className="h-4 w-4" aria-hidden />} title="Conflicts to resolve" right={<Badge tone="amber">{ma.conflicts.length}</Badge>} />
          <ul className="space-y-3">
            {ma.conflicts.map((c) => (
              <li key={c.id} className="rounded-xl border border-amber/25 bg-amber/[0.05] p-3.5">
                <div className="flex items-center gap-2 font-heading font-semibold text-amber-100">
                  <TriangleAlert className="h-4 w-4" aria-hidden /> {c.label}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ivory/80">{c.explanation}</p>
                <EvidenceChips evidence={c.evidence} compact className="mt-2" />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Unknowns */}
      <Panel className="p-5">
        <SectionTitle icon={<CircleHelp className="h-4 w-4" aria-hidden />} title="Still unknown" right={<Badge tone="amber">{arr(ma.unknowns).length}</Badge>} />
        {arr(ma.unknowns).length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {ma.unknowns.map((u) => (
              <li key={u.id} className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3.5">
                <div className="font-heading font-semibold text-ivory">{u.label}</div>
                <p className="mt-1 text-sm text-mist">{u.why_it_matters}</p>
                {arr(u.check_ids).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.check_ids.map((cid) => (
                      <a key={cid} href={`#check-${cid}`} className="rounded-md border border-cyan/25 bg-cyan/5 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan/15">
                        Resolve with check ↓
                      </a>
                    ))}
                  </div>
                )}
                <EvidenceChips evidence={u.evidence} compact className="mt-2" />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No open unknowns — your observation covers the key questions.</Empty>
        )}
      </Panel>

      {/* Checks */}
      <section aria-labelledby="checks-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="eyebrow">No instruments needed</div>
            <h3 id="checks-title" className="font-heading text-lg font-semibold text-ivory">Simple field checks</h3>
          </div>
          {(loading === "analyze" || loading === "plan") && <Spinner label={loading === "plan" ? "Updating plan…" : "Re-analysing…"} />}
        </div>
        {arr(ma.checks).length ? (
          <div className="grid gap-4">
            {ma.checks.map((c) => (
              <CheckCardView key={c.id} card={c} />
            ))}
          </div>
        ) : (
          <Empty>No checks suggested for this observation.</Empty>
        )}
      </section>

      {/* Primary */}
      <Panel className="hero-ring flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="font-heading font-semibold text-ivory">{plan ? "Plan generated" : "Ready when you are"}</div>
          <p className="text-sm text-mist">
            {plan ? "Check outcomes you record now will refresh the plan automatically." : "You can generate the plan now and come back to record check outcomes later."}
          </p>
        </div>
        {plan ? (
          <button type="button" className="btn-primary" onClick={() => go("fix_protocol")}>
            <Route className="h-4 w-4" aria-hidden /> Open restoration plan
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void onGenerate()} disabled={!!loading}>
            {loading === "plan" ? <Spinner label="Generating…" /> : <><Sparkles className="h-4 w-4" aria-hidden /> Generate restoration plan</>}
          </button>
        )}
        {planError && error && <ErrorState className="w-full" title="Plan generation failed" message={error} onRetry={() => void onGenerate()} />}
      </Panel>
    </div>
  );
}

function CheckCardView({ card }: { card: CheckCard }) {
  const outcomes = useTerraform((s) => s.checkOutcomes);
  const unable = useTerraform((s) => s.unableChecks ?? []);
  const setCheckOutcome = useTerraform((s) => s.setCheckOutcome);
  const setCheckUnable = useTerraform((s) => s.setCheckUnable);
  const loading = useTerraform((s) => s.loading);
  const [pending, setPending] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const isUnable = unable.includes(card.id);
  const selected = outcomes.find((o) => o.check_id === card.id)?.outcome_id ?? (isUnable ? null : card.user_outcome);
  const chosen = arr(card.possible_outcomes).find((o) => o.outcome_id === selected);
  const busy = !!loading;

  const choose = async (outcome: string | null, key: string) => {
    setPending(key);
    if (isUnable) await setCheckUnable(card.id, false);
    await setCheckOutcome(card.id, outcome);
    setPending(null);
  };
  const markUnable = async () => {
    setPending("unable");
    await setCheckUnable(card.id, !isUnable);
    setPending(null);
  };

  const optBtn = (key: string, label: string, on: boolean, onClick: () => void, tone: "cyan" | "stone" | "coral" = "cyan") => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={cx(
        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-60",
        on
          ? tone === "coral"
            ? "border-coral/60 bg-coral/15 text-rose-100"
            : tone === "stone"
              ? "border-white/30 bg-white/10 text-ivory"
              : "border-cyan/60 bg-gradient-to-r from-cyan/20 to-violet/15 text-ivory"
          : "border-white/10 bg-white/[0.03] text-mist hover:border-white/25 hover:text-ivory",
      )}
    >
      {pending === key && <Spinner />}
      {label}
    </button>
  );

  return (
    <article
      id={`check-${card.id}`}
      className="glass scroll-mt-28 rounded-2xl p-5"
      aria-labelledby={`chk-${card.id}`}
      data-incomplete={!selected && !isUnable ? "true" : undefined}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan-100">
            <FlaskConical className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <h4 id={`chk-${card.id}`} className="font-heading text-[1.05rem] font-semibold text-ivory">{card.title}</h4>
            {card.purpose && <p className="mt-0.5 text-sm text-mist">{card.purpose}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {card.weak_evidence && (
            <Badge tone="amber" icon={<ShieldAlert className="h-3 w-3" aria-hidden />}>Weak clue · not a pH test</Badge>
          )}
          {card.gate_relevant && <Badge tone="violet" icon={<Lock className="h-3 w-3" aria-hidden />}>Affects planting gate</Badge>}
        </div>
      </header>

      {card.weak_evidence && arr(card.limitations).length > 0 && (
        <div className="mt-3 rounded-xl border border-amber/30 bg-amber/[0.07] p-3">
          <BulletList items={card.limitations} tone="amber" />
        </div>
      )}

      {(card.explanation || arr(card.actions).length > 0 || arr(card.everyday_amounts).length > 0 || arr(card.safety_notes).length > 0) && (
        <button
          type="button"
          onClick={() => setHowOpen((o) => !o)}
          aria-expanded={howOpen}
          className="mt-3 flex min-h-10 items-center gap-1.5 font-heading text-sm font-semibold text-cyan-200 hover:text-ivory"
        >
          <ChevronDown className={cx("h-4 w-4 transition-transform", howOpen && "rotate-180")} aria-hidden />
          {howOpen ? "Hide how to do this check" : "How to do this check"}
        </button>
      )}
      {howOpen && (
        <>
      {card.explanation && <p className="mt-3 leading-relaxed text-ivory/85">{card.explanation}</p>}
      {arr(card.actions).length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-2">How to do it</div>
          <BulletList items={card.actions} ordered tone="cyan" />
        </div>
      )}
      {arr(card.everyday_amounts).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.everyday_amounts.map((a, i) => (
            <span key={i} className="rounded-lg border border-cyan/15 bg-cyan/[0.05] px-2.5 py-1 text-sm text-ivory/90">{a}</span>
          ))}
        </div>
      )}
      {arr(card.safety_notes).length > 0 && (
        <div className="mt-3 rounded-xl border border-amber/25 bg-amber/[0.05] p-3">
          <BulletList items={card.safety_notes} tone="amber" />
        </div>
      )}
      {!card.weak_evidence && arr(card.limitations).length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-mist hover:text-ivory">Limitations</summary>
          <BulletList items={card.limitations} tone="amber" className="mt-2" />
        </details>
      )}

        </>
      )}

      <div className="mt-4 rounded-xl border border-white/8 bg-midnight/40 p-3">
        <div className="eyebrow mb-2">What happened?</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Outcome for ${card.title}`}>
          {optBtn("none", "Not tried", !selected && !isUnable, () => void choose(null, "none"), "stone")}
          {arr(card.possible_outcomes).map((o) => optBtn(o.outcome_id, o.label, selected === o.outcome_id, () => void choose(o.outcome_id, o.outcome_id)))}
          {optBtn("unable", "Unable to do", isUnable, () => void markUnable(), "coral")}
        </div>
        {chosen && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border border-cyan/20 bg-cyan/[0.06] px-3 py-2 text-sm text-ivory/90">
            {chosen.interpretation}
          </motion.p>
        )}
        {isUnable && (
          <p className="mt-3 flex items-center gap-2 text-sm text-mist">
            <Ban className="h-4 w-4 text-coral" aria-hidden /> Recorded as not possible — this stays an open unknown.
          </p>
        )}
      </div>

      <footer className="mt-4 border-t border-white/8 pt-3">
        <EvidenceChips evidence={card.evidence} compact />
      </footer>
    </article>
  );
}

const FACTOR_STATUS: Record<FailureFactor["status"], { label: string; tone: "coral" | "amber" | "stone"; ring: string }> = {
  observed: { label: "Observed", tone: "coral", ring: "!border-coral/35" },
  likely: { label: "Likely (inferred, unconfirmed)", tone: "amber", ring: "!border-amber/30" },
  not_indicated: { label: "Not indicated", tone: "stone", ring: "" },
};

function FactorCard({ f }: { f: FailureFactor }) {
  const st = FACTOR_STATUS[f.status] ?? FACTOR_STATUS.likely;
  return (
    <li className={cx("glass rounded-2xl p-4", st.ring)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-heading font-semibold text-ivory">{f.label}</h4>
        <Badge
          tone={st.tone}
          icon={f.status === "observed" ? <Eye className="h-3 w-3" aria-hidden /> : f.status === "likely" ? <TriangleAlert className="h-3 w-3" aria-hidden /> : <CircleDashed className="h-3 w-3" aria-hidden />}
        >
          {st.label}
        </Badge>
      </div>
      {f.what_is_missing && (
        <div className="mt-2 text-sm">
          <span className="text-mist">Missing: </span>
          <span className="font-heading font-semibold text-terracotta">{f.what_is_missing}</span>
        </div>
      )}
      {f.explanation && <p className="mt-1.5 text-sm leading-relaxed text-ivory/80">{f.explanation}</p>}
      {arr(f.triggered_by).length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-ivory/80">You observed:</div>
          <div className="flex flex-wrap gap-1.5">
            {f.triggered_by.map((t) => <Badge key={t} tone="terracotta" icon={<Eye className="h-3 w-3" aria-hidden />}>{t}</Badge>)}
          </div>
        </div>
      )}
      {arr(f.clues).length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-mist">Indirect clue (not proof):</div>
          <div className="flex flex-wrap gap-1.5">
            {f.clues!.map((c) => (
              <span key={c} className="inline-flex items-center rounded-full border border-dashed border-white/20 px-2.5 py-1 text-xs text-mist">{c}</span>
            ))}
          </div>
        </div>
      )}
      {arr(f.addressed_by).length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-mist">Addressed by</div>
          <EvidenceChips evidence={{ kb_ids: f.addressed_by, source_ids: [] }} compact />
        </div>
      )}
      {f.evidence && <EvidenceChips evidence={f.evidence} compact className="mt-3 border-t border-white/8 pt-2" />}
    </li>
  );
}

function FailureFactors({ factors }: { factors: FailureFactor[] }) {
  // Keep API order; not-indicated factors move to a collapsed list at the bottom.
  const active = factors.filter((f) => f.status !== "not_indicated");
  const quiet = factors.filter((f) => f.status === "not_indicated");
  const counts = factors.reduce<Record<string, number>>((m, f) => ((m[f.status] = (m[f.status] ?? 0) + 1), m), {});
  return (
    <section aria-labelledby="factors-title">
      <SectionTitle
        icon={<Waypoints className="h-4 w-4" aria-hidden />}
        eyebrow="Why crops would fail here"
        title={<span id="factors-title">Root causes &amp; dominant failure factors</span>}
        right={
          <div className="flex flex-wrap gap-1.5">
            {counts.observed ? <Badge tone="coral">{counts.observed} observed</Badge> : null}
            {counts.likely ? <Badge tone="amber">{counts.likely} likely</Badge> : null}
            {counts.not_indicated ? <Badge tone="stone">{counts.not_indicated} not indicated</Badge> : null}
          </div>
        }
      />
      {active.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((f) => <FactorCard key={f.id} f={f} />)}
        </ul>
      ) : (
        <Empty>No failure factors indicated by your observation.</Empty>
      )}
      {quiet.length > 0 && (
        <details className="group mt-3 rounded-2xl border border-white/8 bg-white/[0.015]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-mist hover:text-ivory">
            <span className="flex items-center gap-2">
              <CircleDashed className="h-4 w-4" aria-hidden /> Not indicated by your observation ({quiet.length})
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="grid gap-3 px-4 pb-4 opacity-80 md:grid-cols-2">
            {quiet.map((f) => <FactorCard key={f.id} f={f} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
