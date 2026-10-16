// Step 9 — Ongoing care. Kept SHORT by default: the care stages are an accordion (current stage open), and the long
// reference lists (pest watch, stress mitigation, troubleshooting, dry-spell plan) are collapsed sections whose rows
// open one at a time. Closed panels are not rendered. All text is rendered from the API response.
import { useState, type ReactNode } from "react";
import { Bug, CheckCheck, CloudRainWind, CloudSun, Droplets, Eye, FlaskConical, Info, Layers, Leaf, NotebookPen, Scissors, Search, ShieldAlert, ShieldHalf, SunDim, Sprout, Stethoscope, ThermometerSun, Waves, Wind } from "lucide-react";
import type { CareStage, PestCard, StressCard, TroubleCard } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import Accordion, { CollapsibleSection, type AccordionItem } from "../../components/Accordion";
import EvidenceChips from "../../components/EvidenceChips";
import RecommendationCard from "../../components/RecommendationCard";
import { Badge, BulletList, Empty, Panel, SectionTitle, arr, cx } from "../../components/ui";
import { NeedPlan, useGo } from "./common";

/** "Current stage" is a UI position marker the user can move; it is remembered per crop on this device. */
const stageKey = (cropId: string | null) => `terraform-care-stage-v1:${cropId ?? "none"}`;
function readStage(cropId: string | null): string | null {
  try {
    return localStorage.getItem(stageKey(cropId));
  } catch {
    return null;
  }
}

export default function OngoingCareStep() {
  const plan = useTerraform((s) => s.plan);
  const go = useGo();
  const [, bump] = useState(0);
  if (!plan) return <NeedPlan />;
  const oc = plan.workflow.ongoing_care;
  const cs = plan.workflow.crop_suggestions;
  const allCrops = [...arr(cs?.field_crops), ...arr(cs?.tree_options)];
  const crop = allCrops.find((c) => c.crop_id === oc.crop_id);
  const stages = [...arr(oc.stages)].sort((a, b) => a.order - b.order);
  const saved = readStage(oc.crop_id);
  const currentId = stages.find((s) => s.id === saved)?.id ?? stages[0]?.id ?? null;

  const setCurrent = (id: string) => {
    try {
      localStorage.setItem(stageKey(oc.crop_id), id);
    } catch {
      /* storage unavailable — the marker just won't persist */
    }
    bump((n) => n + 1);
  };

  const stageItems: AccordionItem[] = stages.map((s, i) => ({
    id: s.id,
    title: `${i + 1}. ${s.label}`,
    subtitle: s.timing_description,
    meta: <Badge tone={s.id === currentId ? "cyan" : "violet"}>{s.id === currentId ? "Current stage" : s.stage.replace(/_/g, " ")}</Badge>,
    incomplete: s.id === currentId,
    content: <StageBody stage={s} isCurrent={s.id === currentId} onMakeCurrent={() => setCurrent(s.id)} />,
  }));

  const pests = arr(oc.pest_watch);
  const stress = arr(oc.stress_mitigation);
  const trouble = arr(oc.troubleshooting);
  const dry = arr(oc.dry_spell_plan);

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
        <SectionTitle
          icon={<Sprout className="h-4 w-4" aria-hidden />}
          eyebrow="Growth stages"
          title={<span id="stages-title">Stage-by-stage care</span>}
          right={<span className="text-sm text-mist">One stage open at a time</span>}
        />
        {stageItems.length ? <Accordion key={currentId ?? "none"} items={stageItems} defaultOpenId={currentId} /> : <Empty>No care stages returned.</Empty>}
      </section>

      <div className="grid gap-3">
        {pests.length > 0 && (
          <CollapsibleSection icon={<Bug className="h-4 w-4" aria-hidden />} eyebrow="Watch list" title="Pest watch" count={pests.length} id="pests">
            <Accordion
              single
              items={pests.map((p) => ({
                id: p.id,
                title: p.title,
                subtitle: arr(p.signs)[0],
                icon: <Bug className="h-4 w-4 text-coral" aria-hidden />,
                content: <PestBody pest={p} />,
              }))}
            />
          </CollapsibleSection>
        )}

        {stress.length > 0 && (
          <CollapsibleSection icon={<ShieldHalf className="h-4 w-4" aria-hidden />} eyebrow="Protect the crop" title="Stress mitigation" count={stress.length} id="stress">
            <Accordion
              single
              items={stress.map((c) => {
                const meta = STRESSOR[c.stressor] ?? { label: c.stressor.replace(/_/g, " "), icon: ShieldAlert };
                const Icon = meta.icon;
                return {
                  id: c.id,
                  title: c.title,
                  icon: <Icon className="h-4 w-4 text-coral" aria-hidden />,
                  meta: <Badge tone="terracotta">{meta.label}</Badge>,
                  content: <StressBody card={c} />,
                };
              })}
            />
          </CollapsibleSection>
        )}

        {trouble.length > 0 && (
          <CollapsibleSection icon={<Stethoscope className="h-4 w-4" aria-hidden />} eyebrow="Symptom → likely cause → action" title="Troubleshooting" count={trouble.length} id="trouble">
            <Troubleshooting cards={trouble} />
          </CollapsibleSection>
        )}

        {dry.length > 0 && (
          <CollapsibleSection icon={<SunDim className="h-4 w-4" aria-hidden />} eyebrow="If the rain pauses" title="Dry-spell plan" count={dry.length} id="dry">
            <div className="grid gap-3">
              {dry.map((r) => (
                <RecommendationCard key={r.id} rec={r} collapsible />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

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

function StageBody({ stage, isCurrent, onMakeCurrent }: { stage: CareStage; isCurrent: boolean; onMakeCurrent: () => void }) {
  return (
    <div>
      {stage.timing_description && <p className="text-sm text-mist">{stage.timing_description}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <EvidenceChips evidence={stage.evidence} compact />
        {!isCurrent && (
          <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={onMakeCurrent}>
            <CheckCheck className="h-4 w-4" aria-hidden /> This is my current stage
          </button>
        )}
      </div>
    </div>
  );
}

function PestBody({ pest }: { pest: PestCard }) {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
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
    </div>
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
          {[...journal].reverse().slice(0, 12).map((j, i) => (
            <li key={j.at + i} className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
              <time dateTime={j.at} className="text-xs text-mist">{new Date(j.at).toLocaleString()}</time>
              <p className="mt-0.5 whitespace-pre-line text-sm text-ivory/90">{j.text}</p>
            </li>
          ))}
          {journal.length > 12 && <li className="text-xs text-mist">Showing the latest 12 of {journal.length} entries.</li>}
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

function StressBody({ card }: { card: StressCard }) {
  return (
    <div>
      {card.explanation && <p className="leading-relaxed text-ivory/85">{card.explanation}</p>}
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
    </div>
  );
}

function Troubleshooting({ cards }: { cards: TroubleCard[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term
    ? cards.filter((c) => [c.symptom, ...arr(c.likely_causes), ...arr(c.actions)].some((t) => t.toLowerCase().includes(term)))
    : cards;
  return (
    <div>
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
        <span className="sr-only" role="status">{shown.length} of {cards.length} shown</span>
      </div>
      {shown.length ? (
        <Accordion
          key={term}
          single
          items={shown.map((c) => ({
            id: c.id,
            title: c.symptom,
            icon: <Eye className="h-4 w-4 text-amber" aria-hidden />,
            content: (
              <div className="grid gap-4 md:grid-cols-2">
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
            ),
          }))}
        />
      ) : (
        <Empty>No troubleshooting entry matches “{q}”.</Empty>
      )}
    </div>
  );
}
