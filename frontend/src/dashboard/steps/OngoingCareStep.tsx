import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bug, ChevronDown, CloudRainWind, Search, Stethoscope, CloudSun, Droplets, Eye, FlaskConical, Info, Layers, Leaf, NotebookPen, Scissors, ShieldAlert, ShieldHalf, Sprout, SunDim, ThermometerSun, Waves, Wind } from "lucide-react";
import type { CareStage, PestCard, StressCard, TroubleCard } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import EvidenceChips from "../../components/EvidenceChips";
import RecommendationCard from "../../components/RecommendationCard";
import { Badge, BulletList, Empty, Panel, SectionTitle, arr, cx } from "../../components/ui";
import { NeedPlan, useGo } from "./common";

export default function OngoingCareStep() {
  const plan = useTerraform((s) => s.plan);
  const go = useGo();
  if (!plan) return <NeedPlan />;
  const oc = plan.workflow.ongoing_care;
  const cs = plan.workflow.crop_suggestions;
  const allCrops = [...arr(cs?.field_crops), ...arr(cs?.tree_options)];
  const crop = allCrops.find((c) => c.crop_id === oc.crop_id);
  const stages = [...arr(oc.stages)].sort((a, b) => a.order - b.order);

  return (
    <div className="grid gap-6">
      <Panel className={cx("flex flex-wrap items-center gap-3 p-4", oc.crop_basis !== "selected" && "!border-amber/30")}>
        <Info className={cx("h-5 w-5 shrink-0", oc.crop_basis === "selected" ? "text-cyan" : "text-amber")} aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          {oc.crop_basis === "selected" && (
            <span className="text-ivory/90">Care shown for your chosen crop: <strong className="font-heading text-ivory">{crop?.name ?? oc.crop_id}</strong>.</span>
          )}
          {oc.crop_basis === "top_ranked_default" && (
            <span className="text-ivory/90">
              No crop chosen yet — showing care for the top-ranked option{crop ? <>: <strong className="font-heading text-ivory">{crop.name}</strong></> : ""}.
            </span>
          )}
          {oc.crop_basis === "none" && <span className="text-ivory/90">No crop is available yet, so only general care is shown.</span>}
        </div>
        {oc.crop_basis !== "selected" && (
          <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => go("crop_suggestions")}>
            Choose a crop
          </button>
        )}
      </Panel>

      <section aria-labelledby="stages-title">
        <SectionTitle icon={<Sprout className="h-4 w-4" aria-hidden />} eyebrow="Growth stages" title={<span id="stages-title">Stage-by-stage care</span>} />
        {stages.length ? (
          <ol className="relative grid gap-4 border-l border-white/10 pl-6 sm:pl-8">
            {stages.map((s, i) => (
              <StageCard key={s.id} stage={s} index={i} />
            ))}
          </ol>
        ) : (
          <Empty>No care stages returned.</Empty>
        )}
      </section>

      <section aria-labelledby="pests-title">
        <SectionTitle icon={<Bug className="h-4 w-4" aria-hidden />} eyebrow="Watch list" title={<span id="pests-title">Pest watch</span>} />
        {arr(oc.pest_watch).length ? (
          <div className="grid gap-4 2xl:grid-cols-2">
            {oc.pest_watch.map((p) => <PestView key={p.id} pest={p} />)}
          </div>
        ) : (
          <Empty>No pests flagged for this crop.</Empty>
        )}
      </section>

      {arr(oc.stress_mitigation).length > 0 && (
        <section aria-labelledby="stress-title">
          <SectionTitle icon={<ShieldHalf className="h-4 w-4" aria-hidden />} eyebrow="Protect the crop" title={<span id="stress-title">Stress mitigation</span>} />
          <div className="grid gap-4 2xl:grid-cols-2">
            {oc.stress_mitigation!.map((c) => <StressView key={c.id} card={c} />)}
          </div>
        </section>
      )}

      {arr(oc.troubleshooting).length > 0 && <Troubleshooting cards={oc.troubleshooting!} />}

      {arr(oc.dry_spell_plan).length > 0 && (
        <section>
          <SectionTitle icon={<SunDim className="h-4 w-4" aria-hidden />} eyebrow="If the rain pauses" title="Dry-spell plan" />
          <div className="grid gap-4">
            {oc.dry_spell_plan.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </div>
        </section>
      )}

      <Journal />

      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={oc.evidence} />
      </div>
    </div>
  );
}

function Field({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="eyebrow mb-1 flex items-center gap-1.5">{icon}{label}</div>
      <p className="text-sm leading-relaxed text-ivory/85">{text}</p>
    </div>
  );
}

function StageCard({ stage, index }: { stage: CareStage; index: number }) {
  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="relative">
      <span className="absolute -left-[2.05rem] top-5 grid h-6 w-6 place-items-center rounded-full border border-cyan/50 bg-midnight font-display text-[0.65rem] font-bold text-cyan-100 sm:-left-[2.55rem]" aria-hidden>
        {index + 1}
      </span>
      <article className="glass rounded-2xl p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-heading text-lg font-semibold text-ivory">{stage.label}</h4>
          <Badge tone="violet">{stage.stage.replace(/_/g, " ")}</Badge>
        </header>
        {stage.timing_description && <p className="mt-1 text-sm text-mist">{stage.timing_description}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field icon={<Droplets className="h-3.5 w-3.5" aria-hidden />} label="Water" text={stage.water} />
          <Field icon={<Layers className="h-3.5 w-3.5" aria-hidden />} label="Mulch" text={stage.mulch} />
          <Field icon={<Leaf className="h-3.5 w-3.5" aria-hidden />} label="Nutrients" text={stage.nutrients} />
          <Field icon={<Scissors className="h-3.5 w-3.5" aria-hidden />} label="Weeds" text={stage.weeds} />
          <Field icon={<CloudSun className="h-3.5 w-3.5" aria-hidden />} label="Dry spell" text={stage.dry_spell} />
        </div>
        {arr(stage.actions).length > 0 && (
          <div className="mt-4">
            <div className="eyebrow mb-1.5">Actions</div>
            <BulletList items={stage.actions} ordered />
          </div>
        )}
        {arr(stage.watch_for).length > 0 && (
          <div className="mt-4 rounded-xl border border-amber/20 bg-amber/[0.04] p-3">
            <div className="eyebrow mb-1.5 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden /> Watch for</div>
            <BulletList items={stage.watch_for} tone="amber" />
          </div>
        )}
        <EvidenceChips evidence={stage.evidence} compact className="mt-4" />
      </article>
    </motion.li>
  );
}

function PestView({ pest }: { pest: PestCard }) {
  return (
    <article className="glass rounded-2xl p-5">
      <h4 className="flex items-center gap-2 font-heading text-lg font-semibold text-ivory">
        <Bug className="h-4 w-4 text-coral" aria-hidden /> {pest.title}
      </h4>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {arr(pest.signs).length > 0 && (
          <div>
            <div className="eyebrow mb-1.5">Signs</div>
            <BulletList items={pest.signs} tone="coral" />
          </div>
        )}
        {arr(pest.actions).length > 0 && (
          <div>
            <div className="eyebrow mb-1.5">Actions</div>
            <BulletList items={pest.actions} tone="cyan" />
          </div>
        )}
      </div>
      {arr(pest.bio_options).length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="eyebrow">Biological options</div>
          {pest.bio_options.map((b, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="font-heading font-semibold text-ivory">{b.name}</div>
              {b.preparation && <p className="mt-1 text-sm text-ivory/80">{b.preparation}</p>}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {arr(b.safe_use).length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-mist">Safe use</div>
                    <BulletList items={b.safe_use} tone="cyan" />
                  </div>
                )}
                {arr(b.cautions).length > 0 && (
                  <div className="rounded-lg border border-amber/25 bg-amber/[0.05] p-2.5">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-100"><ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Cautions</div>
                    <BulletList items={b.cautions} tone="amber" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {arr(pest.cautions).length > 0 && (
        <div className="mt-4 rounded-xl border border-amber/25 bg-amber/[0.05] p-3">
          <BulletList items={pest.cautions} tone="amber" />
        </div>
      )}
      <EvidenceChips evidence={pest.evidence} compact className="mt-4" />
    </article>
  );
}

function Journal() {
  const journal = useTerraform((s) => s.journal);
  const addJournal = useTerraform((s) => s.addJournal);
  const saveStatus = useTerraform((s) => s.saveStatus);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await addJournal(text.trim());
    setText("");
    setSaving(false);
  };
  return (
    <Panel className="p-5">
      <SectionTitle icon={<NotebookPen className="h-4 w-4" aria-hidden />} eyebrow="Field journal" title="What changed?" right={<Badge tone="stone">{journal.length} entries</Badge>} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="journal-entry" className="sr-only">Journal entry</label>
        <textarea
          id="journal-entry"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Note what you saw today — sprouting, wilting, insects, rain, soil changes…"
          className="w-full rounded-xl border border-white/12 bg-midnight/60 px-4 py-3 text-ivory placeholder:text-mist/50 focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/30"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-mist">{saveStatus === "offline" ? "Saved on this device only (backend offline)" : "Entries are saved with your session"}</span>
          <button type="submit" className="btn-primary !py-2 text-sm" disabled={!text.trim() || saving}>Add entry</button>
        </div>
      </form>
      {journal.length > 0 && (
        <ol className="mt-4 space-y-2">
          {[...journal].reverse().map((j, i) => (
            <li key={j.at + i} className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
              <time dateTime={j.at} className="text-xs text-mist">{new Date(j.at).toLocaleString()}</time>
              <p className="mt-0.5 whitespace-pre-line text-sm text-ivory/90">{j.text}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

const STRESSOR: Record<string, { label: string; icon: typeof Wind }> = {
  heat: { label: "Heat", icon: ThermometerSun },
  hot_wind: { label: "Hot wind", icon: Wind },
  dry_spell: { label: "Dry spell", icon: SunDim },
  waterlogging: { label: "Waterlogging", icon: Waves },
  heavy_rain_washout: { label: "Heavy-rain washout", icon: CloudRainWind },
  acidity_stress: { label: "Acidity stress", icon: FlaskConical },
  nutrient_stress: { label: "Nutrient stress", icon: Leaf },
};

function StressView({ card }: { card: StressCard }) {
  const meta = STRESSOR[card.stressor] ?? { label: card.stressor.replace(/_/g, " "), icon: ShieldAlert };
  const Icon = meta.icon;
  return (
    <article className="glass rounded-2xl p-5" aria-labelledby={`stress-${card.id}`}>
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-terracotta/25 to-coral/15 text-coral">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <Badge tone="terracotta">{meta.label}</Badge>
          <h4 id={`stress-${card.id}`} className="mt-1 font-heading text-lg font-semibold text-ivory">{card.title}</h4>
        </div>
      </header>
      {card.explanation && <p className="mt-3 leading-relaxed text-ivory/85">{card.explanation}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {arr(card.signs).length > 0 && (
          <div className="rounded-xl border border-amber/20 bg-amber/[0.04] p-3">
            <div className="eyebrow mb-1.5 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden /> Signs</div>
            <BulletList items={card.signs} tone="amber" />
          </div>
        )}
        {arr(card.actions).length > 0 && (
          <div>
            <div className="eyebrow mb-1.5">Actions</div>
            <BulletList items={card.actions} ordered />
          </div>
        )}
      </div>
      {arr(card.everyday_amounts).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {card.everyday_amounts.map((a, i) => (
            <li key={i} className="rounded-lg border border-cyan/15 bg-cyan/[0.05] px-2.5 py-1 text-sm text-ivory/90">{a}</li>
          ))}
        </ul>
      )}
      {arr(card.safety_notes).length > 0 && (
        <div className="mt-3 rounded-xl border border-amber/25 bg-amber/[0.05] p-3">
          <BulletList items={card.safety_notes} tone="amber" />
        </div>
      )}
      {arr(card.limitations).length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-mist hover:text-ivory">Limitations</summary>
          <BulletList items={card.limitations} tone="amber" className="mt-2" />
        </details>
      )}
      <EvidenceChips evidence={card.evidence} compact className="mt-4 border-t border-white/8 pt-3" />
    </article>
  );
}

function Troubleshooting({ cards }: { cards: TroubleCard[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term
    ? cards.filter((c) => [c.symptom, ...arr(c.likely_causes), ...arr(c.actions)].some((t) => t.toLowerCase().includes(term)))
    : cards;
  return (
    <section aria-labelledby="trouble-title">
      <SectionTitle
        icon={<Stethoscope className="h-4 w-4" aria-hidden />}
        eyebrow="Symptom → likely cause → action"
        title={<span id="trouble-title">Troubleshooting</span>}
        right={<Badge tone="stone">{shown.length}/{cards.length}</Badge>}
      />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" aria-hidden />
        <label htmlFor="trouble-search" className="sr-only">Filter troubleshooting by symptom</label>
        <input
          id="trouble-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search what you see…"
          className="w-full rounded-xl border border-white/12 bg-midnight/60 py-2.5 pl-9 pr-3 text-sm text-ivory placeholder:text-mist/50 focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/30"
        />
      </div>
      {shown.length ? (
        <ul className="grid gap-2">
          {shown.map((c) => (
            <li key={c.id}>
              <details className="glass group rounded-2xl">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-2 font-heading font-semibold text-ivory">
                    <Eye className="h-4 w-4 shrink-0 text-amber" aria-hidden /> {c.symptom}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-mist transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="grid gap-4 border-t border-white/8 px-4 pb-4 pt-3 md:grid-cols-2">
                  {arr(c.likely_causes).length > 0 && (
                    <div>
                      <div className="eyebrow mb-1.5">Likely causes</div>
                      <BulletList items={c.likely_causes} tone="amber" />
                    </div>
                  )}
                  {arr(c.actions).length > 0 && (
                    <div>
                      <div className="eyebrow mb-1.5">What to do</div>
                      <BulletList items={c.actions} ordered />
                    </div>
                  )}
                  <EvidenceChips evidence={c.evidence} compact className="md:col-span-2" />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No troubleshooting entry matches “{q}”.</Empty>
      )}
    </section>
  );
}
