import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Droplets, Layers, Lock, FlaskRound, GitCompare, Hourglass, Sprout, TreePine, TriangleAlert, Users, X } from "lucide-react";
import type { CropCard } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import EvidenceChips from "../../components/EvidenceChips";
import RecommendationCard from "../../components/RecommendationCard";
import { Spinner } from "../../components/LoadingAndError";
import { Badge, BulletList, ConfidenceBadge, Empty, FIT_LABEL_META, Panel, SeasonFitBadge, SectionTitle, Weeks, arr, cx, humanize } from "../../components/ui";
import { NeedPlan, useGo } from "./common";

export default function CropSuggestionsStep() {
  const plan = useTerraform((s) => s.plan);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const go = useGo();
  if (!plan) return <NeedPlan />;
  const gateOpen = plan.workflow.next_action?.planting_readiness !== "not_ready";
  const cs = plan.workflow.crop_suggestions;
  const field = [...arr(cs.field_crops)].sort((a, b) => a.rank - b.rank);
  const longTerm = [...arr(cs.tree_options)].sort((a, b) => a.rank - b.rank);
  const trees = longTerm.filter((c) => c.category !== "soil_builder");
  const soilBuilders = longTerm.filter((c) => c.category === "soil_builder");
  const excluded = arr(cs.excluded);
  const all = [...field, ...trees];
  const compared = compare.map((id) => all.find((c) => c.crop_id === id)).filter((c): c is CropCard => !!c);

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));

  return (
    <div className="grid gap-6">
      {!gateOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-coral/30 bg-coral/[0.07] px-4 py-2.5 text-sm" role="status">
          <Lock className="h-4 w-4 shrink-0 text-coral" aria-hidden />
          <span className="min-w-0 flex-1 text-ivory/90">Readiness gate not yet passed — crops are shown for planning; plant only after the gate passes.</span>
          <button type="button" className="font-heading font-semibold text-coral underline-offset-2 hover:underline" onClick={() => go("next_action")}>
            Open the gate
          </button>
        </div>
      )}
      {cs.local_advice_note && (
        <Panel className="flex items-start gap-3 !border-amber/30 p-4">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
          <div>
            <div className="font-heading font-semibold text-amber-100">About the local advice</div>
            <p className="mt-0.5 text-sm leading-relaxed text-ivory/80">{cs.local_advice_note}</p>
          </div>
        </Panel>
      )}

      <section aria-labelledby="field-crops-title">
        <SectionTitle
          icon={<Sprout className="h-4 w-4" aria-hidden />}
          eyebrow="Ranked for your land"
          title={<span id="field-crops-title">Field crops</span>}
          right={<span className="text-sm text-mist">Select up to 3 to compare</span>}
        />
        {field.length ? (
          <div className="grid gap-4 2xl:grid-cols-2">
            {field.map((c) => (
              <CropCardView key={c.crop_id} crop={c} comparing={compare.includes(c.crop_id)} onCompare={() => toggleCompare(c.crop_id)} compareFull={compare.length >= 3} />
            ))}
          </div>
        ) : (
          <Empty>No field crops matched this land.</Empty>
        )}
      </section>

      {cs.trial_advice && (
        <section>
          <SectionTitle icon={<FlaskRound className="h-4 w-4" aria-hidden />} eyebrow="Start small" title="Trial advice" />
          <RecommendationCard rec={cs.trial_advice} defaultOpen />
        </section>
      )}

      <section aria-labelledby="trees-title">
        <SectionTitle icon={<TreePine className="h-4 w-4" aria-hidden />} eyebrow="Long-term" title={<span id="trees-title">Long-term tree options</span>} />
        {trees.length ? (
          <div className="grid gap-4 2xl:grid-cols-2">
            {trees.map((c) => (
              <CropCardView key={c.crop_id} crop={c} comparing={compare.includes(c.crop_id)} onCompare={() => toggleCompare(c.crop_id)} compareFull={compare.length >= 3} />
            ))}
          </div>
        ) : (
          <Empty>No tree options returned.</Empty>
        )}
        {soilBuilders.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-1 flex items-center gap-2 font-heading font-semibold text-ivory">
              <Layers className="h-4 w-4 text-sprout" aria-hidden /> Soil builders &amp; hedges (not food)
            </h4>
            <p className="mb-3 text-sm text-mist">Listed for building up the land over time — not a food choice.</p>
            <div className="grid gap-4 2xl:grid-cols-2">
              {soilBuilders.map((c) => (
                <CropCardView key={c.crop_id} crop={c} nonFood comparing={false} onCompare={() => {}} compareFull />
              ))}
            </div>
          </div>
        )}
      </section>

      {excluded.length > 0 && (
        <details className="glass group rounded-2xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5">
            <span className="flex items-center gap-2 font-heading font-semibold text-ivory">
              <X className="h-4 w-4 text-mist" aria-hidden /> Excluded for this land
              <Badge tone="stone">{excluded.length}</Badge>
            </span>
            <ChevronDown className="h-5 w-5 text-mist transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="grid gap-3 px-5 pb-5 md:grid-cols-2">
            {excluded.map((c) => (
              <li key={c.crop_id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
                <div className="font-heading font-semibold text-ivory/80">{c.name}</div>
                <BulletList items={[...arr(c.cautions_triggered), ...arr(c.limitations)]} tone="coral" className="mt-1.5" />
                <EvidenceChips evidence={c.evidence} compact className="mt-2" />
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={cs.evidence} />
      </div>

      {/* Compare tray */}
      <AnimatePresence>
        {compare.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="glass-strong fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl p-3 lg:bottom-6"
          >
            <GitCompare className="h-5 w-5 text-cyan" aria-hidden />
            <div className="flex flex-1 flex-wrap gap-1.5">
              {compared.map((c) => (
                <button key={c.crop_id} type="button" onClick={() => toggleCompare(c.crop_id)} className="flex items-center gap-1 rounded-lg border border-cyan/30 bg-cyan/10 px-2 py-1 text-sm text-cyan-100" aria-label={`Remove ${c.name} from compare`}>
                  {c.name} <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>
            <button type="button" className="btn-primary !py-2 text-sm" disabled={compared.length < 2} onClick={() => setShowCompare(true)}>
              Compare {compared.length}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <CompareModal open={showCompare && compared.length >= 2} crops={compared} onClose={() => setShowCompare(false)} />
    </div>
  );
}

function CropCardView({ crop, comparing, onCompare, compareFull, nonFood = false }: { crop: CropCard; comparing: boolean; onCompare: () => void; compareFull: boolean; nonFood?: boolean }) {
  const selectedCropId = useTerraform((s) => s.selectedCropId);
  const selectCrop = useTerraform((s) => s.selectCrop);
  const loading = useTerraform((s) => s.loading);
  const [pending, setPending] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const fit = FIT_LABEL_META[crop.fit_label] ?? FIT_LABEL_META.possible;
  const selected = selectedCropId === crop.crop_id;
  const isTree = crop.category === "tree";

  const choose = async () => {
    setPending(true);
    await selectCrop(crop.crop_id);
    setPending(false);
  };

  return (
    <article className={cx("glass relative overflow-hidden rounded-2xl p-5", selected && "!border-cyan/50 shadow-[0_0_40px_-18px_rgba(56,225,255,0.7)]")} aria-labelledby={`crop-${crop.crop_id}`}>
      {selected && <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan via-violet to-transparent" aria-hidden />}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent font-display text-lg font-black text-ivory">
            {crop.rank}
          </span>
          <div>
            <h4 id={`crop-${crop.crop_id}`} className="font-heading text-lg font-semibold text-ivory">{crop.name}</h4>
            {arr(crop.local_names).length > 0 && <div className="text-sm text-mist">{crop.local_names.join(" · ")}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={fit.tone}>{fit.label}</Badge>
              <SeasonFitBadge fit={crop.season_fit} />
              <ConfidenceBadge value={crop.confidence} />
              {nonFood && <Badge tone="sprout" icon={<Layers className="h-3 w-3" aria-hidden />}>Soil builder · not food</Badge>}
              {isTree && <Badge tone="violet" icon={<TreePine className="h-3 w-3" aria-hidden />}>Long-term</Badge>}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowScore((s) => !s)}
          aria-expanded={showScore}
          className="rounded-xl border border-white/10 bg-midnight/50 px-3 py-2 text-right hover:border-white/25"
          aria-label={`Score ${crop.score}. Show score breakdown`}
        >
          <div className="font-display text-xl font-bold text-gradient-cv">{crop.score}</div>
          <div className="flex items-center gap-1 text-xs text-mist">score <ChevronDown className={cx("h-3 w-3 transition-transform", showScore && "rotate-180")} aria-hidden /></div>
        </button>
      </header>

      {showScore && arr(crop.score_breakdown).length > 0 && (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Score breakdown for {crop.name}</caption>
          <tbody>
            {crop.score_breakdown.map((s, i) => (
              <tr key={i} className="border-t border-white/6">
                <td className="py-1.5 pr-2 font-heading text-ivory/90">{s.factor}</td>
                <td className={cx("py-1.5 pr-2 text-right font-mono", s.points >= 0 ? "text-cyan-200" : "text-coral")}>{s.points > 0 ? `+${s.points}` : s.points}</td>
                <td className="py-1.5 text-mist">{s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {arr(crop.why_it_may_fit).length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-1.5">Why it may fit</div>
          <BulletList items={crop.why_it_may_fit} tone="cyan" />
        </div>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <dt className="eyebrow mb-1 flex items-center gap-1"><Droplets className="h-3.5 w-3.5" aria-hidden /> Water</dt>
          <dd className="text-sm text-ivory/85">{crop.water_needs || "—"}</dd>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <dt className="eyebrow mb-1">Roots</dt>
          <dd className="text-sm text-ivory/85">{crop.rooting_notes || "—"}</dd>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <dt className="eyebrow mb-1 flex items-center gap-1"><Hourglass className="h-3.5 w-3.5" aria-hidden /> Maturity</dt>
          <dd className="text-sm text-ivory/85">
            <Weeks range={crop.maturity_weeks} />
            {crop.maturity_description && <div className="mt-0.5 text-mist">{crop.maturity_description}</div>}
          </dd>
        </div>
      </dl>

      {(arr(crop.missing_resources).length > 0 || arr(crop.cautions_triggered).length > 0 || arr(crop.limitations).length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {arr(crop.cautions_triggered).length > 0 && (
            <div className="rounded-xl border border-coral/25 bg-coral/[0.05] p-3">
              <div className="eyebrow mb-1.5 flex items-center gap-1 !text-rose-100"><TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Cautions</div>
              <BulletList items={crop.cautions_triggered} tone="coral" />
            </div>
          )}
          {arr(crop.limitations).length > 0 && (
            <div className="rounded-xl border border-amber/20 bg-amber/[0.04] p-3">
              <div className="eyebrow mb-1.5">Limitations</div>
              <BulletList items={crop.limitations} tone="amber" />
            </div>
          )}
          {arr(crop.missing_resources).length > 0 && (
            <div className="rounded-xl border border-white/10 p-3">
              <div className="eyebrow mb-1.5">You may be missing</div>
              <div className="flex flex-wrap gap-1.5">
                {crop.missing_resources.map((r) => <Badge key={r} tone="stone">{humanize(r)}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
        <EvidenceChips evidence={crop.evidence} compact />
        {!nonFood && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCompare}
            aria-pressed={comparing}
            disabled={!comparing && compareFull}
            className={cx("btn-ghost !px-3 !py-1.5 text-sm", comparing && "!border-cyan/50 !bg-cyan/10")}
          >
            <GitCompare className="h-4 w-4" aria-hidden /> {comparing ? "Comparing" : "Compare"}
          </button>
          {selected ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-heading text-sm font-semibold text-cyan-100">
              <Check className="h-4 w-4" aria-hidden /> Chosen
            </span>
          ) : (
            <button type="button" className="btn-primary !px-3 !py-1.5 text-sm" onClick={() => void choose()} disabled={pending || !!loading}>
              {pending ? <Spinner label="Updating…" /> : "Choose this crop"}
            </button>
          )}
        </div>
        )}
      </footer>
    </article>
  );
}

function CompareModal({ open, crops, onClose }: { open: boolean; crops: CropCard[]; onClose: () => void }) {
  const rows: { label: string; render: (c: CropCard) => ReactNode }[] = [
    { label: "Rank", render: (c) => <span className="font-display font-bold">{c.rank}</span> },
    { label: "Fit", render: (c) => <Badge tone={(FIT_LABEL_META[c.fit_label] ?? FIT_LABEL_META.possible).tone}>{(FIT_LABEL_META[c.fit_label] ?? FIT_LABEL_META.possible).label}</Badge> },
    { label: "Score", render: (c) => <span className="font-mono">{c.score}</span> },
    { label: "Season fit", render: (c) => <SeasonFitBadge fit={c.season_fit} /> },
    { label: "Maturity", render: (c) => <Weeks range={c.maturity_weeks} /> },
    { label: "Water", render: (c) => c.water_needs || "—" },
    { label: "Roots", render: (c) => c.rooting_notes || "—" },
    { label: "Missing resources", render: (c) => (arr(c.missing_resources).length ? c.missing_resources.map(humanize).join(", ") : "None") },
    { label: "Cautions", render: (c) => (arr(c.cautions_triggered).length ? <BulletList items={c.cautions_triggered} tone="coral" /> : "None") },
    { label: "Confidence", render: (c) => <ConfidenceBadge value={c.confidence} /> },
    { label: "Evidence", render: (c) => <EvidenceChips evidence={c.evidence} compact /> },
  ];
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-3" onKeyDown={(e) => e.key === "Escape" && onClose()}>
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-title"
            className="glass-strong relative max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <header className="flex items-center justify-between border-b border-white/10 p-4">
              <h2 id="compare-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
                <GitCompare className="h-5 w-5 text-cyan" aria-hidden /> Side-by-side
              </h2>
              <button type="button" className="btn-ghost !p-2" onClick={onClose} aria-label="Close comparison" autoFocus>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>
            <div className="scroll-thin max-h-[calc(88vh-4rem)] overflow-auto p-4">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-ink p-2 text-left font-heading text-xs uppercase tracking-wider text-mist" scope="col">Crop</th>
                    {crops.map((c) => (
                      <th key={c.crop_id} scope="col" className="p-2 text-left font-heading text-base font-semibold text-ivory">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="sticky left-0 border-t border-white/8 bg-ink p-2 text-left align-top font-heading text-xs uppercase tracking-wider text-mist">{r.label}</th>
                      {crops.map((c) => (
                        <td key={c.crop_id} className="border-t border-white/8 p-2 align-top text-ivory/85">{r.render(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
