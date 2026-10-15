// Collects the survivor's own observations. Option values are exactly the CONTRACT enums; labels
// describe what the user sees (input vocabulary), never advice.
import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, FileText, ScanSearch, Sparkles } from "lucide-react";
import type { ObservationInput } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import PhotoUploader from "./PhotoUploader";
import { ErrorState, Spinner } from "./LoadingAndError";
import { cx } from "./ui";

export type ObservationFormProps = { compact?: boolean; onSubmitted?: () => void };

type Opt<V> = { value: V; label: string };

const SURFACE_COLOUR: Opt<NonNullable<ObservationInput["surface_colour"]>>[] = [
  { value: "reddish", label: "Reddish" },
  { value: "dark", label: "Dark" },
  { value: "pale", label: "Pale" },
  { value: "unknown", label: "Not sure" },
];
const SURFACE_TEXTURE: Opt<string>[] = [
  { value: "stony", label: "Stony" },
  { value: "gravelly", label: "Gravelly" },
  { value: "rock_lumps", label: "Rock lumps" },
  { value: "crusted", label: "Crusted surface" },
];
const DIGGING: Opt<NonNullable<ObservationInput["digging_resistance"]>>[] = [
  { value: "hard_layer_near_surface", label: "Hard layer near the surface" },
  { value: "varies_by_spot", label: "Varies from spot to spot" },
  { value: "rock_sheet_everywhere", label: "Rock sheet everywhere" },
  { value: "can_dig_deep", label: "Can dig deep" },
  { value: "unknown", label: "Haven't tried" },
];
const RAIN: Opt<string>[] = [
  { value: "fast_runoff", label: "Runs off fast" },
  { value: "red_streams", label: "Red streams" },
  { value: "soaks_in", label: "Soaks in" },
  { value: "pools", label: "Forms pools" },
];
const VEGETATION: Opt<string>[] = [
  { value: "dry_grass", label: "Dry grass tufts" },
  { value: "thorny_shrubs", label: "Thorny shrubs" },
  { value: "trees_nearby", label: "Trees nearby" },
];
const SLOPE: Opt<NonNullable<ObservationInput["slope"]>>[] = [
  { value: "flat", label: "Flat" },
  { value: "slight", label: "Slight slope" },
  { value: "steep", label: "Steep" },
  { value: "unknown", label: "Not sure" },
];
const POOLING: Opt<NonNullable<ObservationInput["pooling"]>>[] = [
  { value: "none_seen", label: "None seen" },
  { value: "some_areas", label: "In some areas" },
  { value: "widespread", label: "Widespread" },
  { value: "unknown", label: "Not sure" },
];
const RAIN_WINDOW: Opt<NonNullable<ObservationInput["rain_window"]>>[] = [
  { value: "not_started", label: "Not started" },
  { value: "just_started", label: "Just started" },
  { value: "ongoing", label: "Ongoing" },
  { value: "ending", label: "Ending" },
  { value: "unknown", label: "Not sure" },
];
const WET_WEEKS: Opt<number | "unknown">[] = [
  { value: "unknown", label: "Unknown" },
  { value: 6, label: "~6 weeks" },
  { value: 8, label: "~8 weeks" },
  { value: 10, label: "~10 weeks" },
  { value: 12, label: "~12 weeks" },
  { value: 16, label: "~16+ weeks" },
];
const RESOURCES: Opt<string>[] = [
  { value: "compost", label: "Compost" },
  { value: "manure", label: "Manure" },
  { value: "mulch", label: "Mulch" },
  { value: "leaf_litter", label: "Leaf litter" },
  { value: "stones", label: "Loose stones" },
  { value: "wood_ash", label: "Wood ash" },
  { value: "crushed_shells", label: "Crushed shells" },
  { value: "water_containers", label: "Water containers" },
  { value: "seeds", label: "Seeds" },
  { value: "hand_tools", label: "Hand tools" },
  { value: "bucket", label: "Bucket" },
  { value: "none_compost", label: "No compost or manure" },
  { value: "little_water", label: "Little or no stored water" },
];

/** User-input example descriptions (what a survivor might say). Not advice. */
const EXAMPLES: { id: string; label: string; text: string }[] = [
  {
    id: "standard",
    label: "Standard scenario",
    text: "The ground is reddish and stony. I cannot dig past a hand's depth — it stops as if hitting a board. During rain, water rushes off in red streams without soaking in. Dry tufts of grass and a few thorny shrubs grow here.",
  },
  {
    id: "rock_sheet",
    label: "Variation: rock sheet",
    text: "A continuous sheet of rock blocks digging everywhere I try — every spot I probe stops at the same hard layer about a hand's depth down. The surface is reddish with loose stones, and rain runs straight off.",
  },
  {
    id: "flat_pooling",
    label: "Variation: flat & pooling",
    text: "The plateau is completely flat and after rain water pools in low places for days. The soil is reddish and gravelly, and my digging stick stops at a hard layer near the surface.",
  },
];

// Survives step navigation within the tab (not persisted): an unsubmitted draft.
let draftCache: ObservationInput | null = null;
let pendingFocusId: string | null = null;
/** Ask the form to scroll to / highlight a field group the next time it mounts (e.g. "wet_season"). */
export function requestObservationFieldFocus(id: string) {
  pendingFocusId = id;
}

function clean(o: ObservationInput): ObservationInput {
  const out: ObservationInput = { description: o.description.trim() };
  (Object.keys(o) as (keyof ObservationInput)[]).forEach((k) => {
    if (k === "description") return;
    const v = o[k];
    if (v === undefined || v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    (out as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() || undefined : v;
  });
  if (!out.local_advice) delete out.local_advice;
  return out;
}

function ChipGroup<V extends string | number>({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  multi,
  highlight,
}: {
  id: string;
  label: string;
  hint?: string;
  options: Opt<V>[];
  value: V | V[] | null | undefined;
  onChange: (v: V | V[] | undefined) => void;
  multi?: boolean;
  highlight?: boolean;
}) {
  const selected = (v: V) => (multi ? ((value as V[] | undefined) ?? []).includes(v) : value === v);
  const toggle = (v: V) => {
    if (multi) {
      const cur = (value as V[] | undefined) ?? [];
      onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    } else onChange(value === v ? undefined : v);
  };
  return (
    <fieldset
      id={`field-${id}`}
      className={cx("rounded-xl border p-3 transition-colors", highlight ? "border-cyan/60 bg-cyan/5 ring-2 ring-cyan/30" : "border-white/8 bg-white/[0.02]")}
    >
      <legend className="sr-only">{label}</legend>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-heading text-sm font-semibold text-ivory" aria-hidden>
          {label}
        </span>
        <span className="text-xs text-mist">{hint ?? (multi ? "Pick any" : "Pick one")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected(o.value);
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={cx(
                "rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                on
                  ? "border-cyan/60 bg-gradient-to-r from-cyan/20 to-violet/20 text-ivory shadow-[0_0_0_1px_rgba(56,225,255,0.15)]"
                  : "border-white/10 bg-white/[0.03] text-mist hover:border-white/25 hover:text-ivory",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

export default function ObservationForm({ compact = false, onSubmitted }: ObservationFormProps) {
  const stored = useTerraform((s) => s.observation);
  const analyze = useTerraform((s) => s.analyze);
  const generatePlan = useTerraform((s) => s.generatePlan);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const loading = useTerraform((s) => s.loading);
  const storeError = useTerraform((s) => s.error);
  const clearError = useTerraform((s) => s.clearError);
  const toast = useTerraform((s) => s.toast);
  const hadPlan = useTerraform((s) => !!s.plan);

  const [draft, setDraftState] = useState<ObservationInput>(() => draftCache ?? stored ?? { description: "" });
  const [showDetail, setShowDetail] = useState(!compact);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);
  const textId = useId();

  const setDraft = (patch: Partial<ObservationInput>) =>
    setDraftState((d) => {
      const next = { ...d, ...patch };
      draftCache = next;
      return next;
    });

  useEffect(() => {
    if (!pendingFocusId) return;
    const id = pendingFocusId;
    pendingFocusId = null;
    setShowDetail(true);
    setFocusField(id);
    setTimeout(() => document.getElementById(`field-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    const t = setTimeout(() => setFocusField(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const busy = loading === "analyze" || loading === "plan";
  const descOk = draft.description.trim().length > 0;
  const detailCount = Object.entries(draft).filter(
    ([k, v]) => k !== "description" && k !== "user_confirmed_checks" && v !== undefined && v !== null && !(Array.isArray(v) && !v.length) && v !== "",
  ).length;

  const submit = async () => {
    setTouched(true);
    if (!descOk || busy) return;
    setSubmitError(null);
    clearError();
    const obs = clean(draft);
    const res = await analyze(obs);
    if (!res) {
      setSubmitError(useTerraform.getState().error ?? storeError ?? "Analysis failed.");
      return;
    }
    draftCache = null;
    if (hadPlan) {
      const plan = await generatePlan();
      if (plan) toast("info", "Plan refreshed for your updated observation.");
    }
    setCurrentStep("input_echo");
    onSubmitted?.();
  };

  const wetValue: number | "unknown" | undefined =
    draft.wet_season_weeks_remaining === null ? "unknown" : draft.wet_season_weeks_remaining ?? undefined;

  return (
    <form
      id="observation-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
      aria-busy={busy}
    >
      <div>
        <label htmlFor={textId} className="mb-2 flex items-center justify-between gap-2">
          <span className="font-heading text-base font-semibold text-ivory">
            Describe what you can see, feel, and what happens when it rains
            <span className="ml-1 text-coral" aria-hidden>*</span>
          </span>
        </label>
        <div className="relative">
          <textarea
            id={textId}
            value={draft.description}
            onChange={(e) => setDraft({ description: e.target.value })}
            onBlur={() => setTouched(true)}
            rows={compact ? 4 : 6}
            required
            aria-required="true"
            aria-invalid={touched && !descOk}
            aria-describedby={`${textId}-help`}
            disabled={busy}
            placeholder="In your own words: colour of the ground, how deep you can dig, what grows, where the water goes…"
            className="scroll-thin w-full resize-y rounded-2xl border border-white/12 bg-midnight/60 px-4 py-3.5 text-[1.02rem] leading-relaxed text-ivory placeholder:text-mist/50 focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/30 disabled:opacity-60"
          />
          <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-mist/60">{draft.description.length} chars</span>
        </div>
        <div id={`${textId}-help`} className="mt-1.5 text-sm text-mist">
          {touched && !descOk ? <span className="text-coral">A short description is required — everything else is optional.</span> : "Only this description is required. Short is fine."}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-mist">
            <FileText className="h-4 w-4" aria-hidden /> Load example:
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              disabled={busy}
              onClick={() => setDraft({ description: ex.text })}
              className="rounded-lg border border-violet/30 bg-violet/10 px-2.5 py-1.5 text-sm text-violet-100 transition-colors hover:border-violet/60 hover:bg-violet/20 disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <PhotoUploader
        photoId={draft.photo_id}
        onChange={(photo_id) => setDraft(photo_id ? { photo_id } : { photo_id: null, photo_confirmed_tags: undefined })}
        compact={compact}
        confirmedTags={draft.photo_confirmed_tags ?? []}
        onConfirmedTagsChange={(tags) => setDraft({ photo_confirmed_tags: tags.length ? tags : undefined })}
      />

      <div className="rounded-2xl border border-white/8 bg-white/[0.015]">
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-heading font-semibold text-ivory">
            <Sparkles className="h-4 w-4 text-cyan" aria-hidden />
            Add detail (optional)
            {detailCount > 0 && <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-xs text-cyan-100">{detailCount} set</span>}
          </span>
          <ChevronDown className={cx("h-5 w-5 text-mist transition-transform", showDetail && "rotate-180")} aria-hidden />
        </button>
        {showDetail && (
          <div className="space-y-5 border-t border-white/8 p-4">
            <Group title="Ground">
              <ChipGroup id="surface_colour" label="Surface colour" options={SURFACE_COLOUR} value={draft.surface_colour} onChange={(v) => setDraft({ surface_colour: v as ObservationInput["surface_colour"] })} />
              <ChipGroup id="surface_texture" label="Surface texture" multi options={SURFACE_TEXTURE} value={draft.surface_texture} onChange={(v) => setDraft({ surface_texture: v as string[] })} />
              <ChipGroup id="digging_resistance" label="When you dig" options={DIGGING} value={draft.digging_resistance} onChange={(v) => setDraft({ digging_resistance: v as ObservationInput["digging_resistance"] })} />
              <ChipGroup id="vegetation" label="What grows" multi options={VEGETATION} value={draft.vegetation} onChange={(v) => setDraft({ vegetation: v as string[] })} />
            </Group>
            <Group title="Water & land shape">
              <ChipGroup id="rain_behavior" label="When it rains" multi options={RAIN} value={draft.rain_behavior} onChange={(v) => setDraft({ rain_behavior: v as string[] })} />
              <ChipGroup id="pooling" label="Standing water after rain" options={POOLING} value={draft.pooling} onChange={(v) => setDraft({ pooling: v as ObservationInput["pooling"] })} />
              <ChipGroup id="slope" label="Slope" options={SLOPE} value={draft.slope} onChange={(v) => setDraft({ slope: v as ObservationInput["slope"] })} />
            </Group>
            <Group title="Season">
              <ChipGroup id="rain_window" label="Rainy season" options={RAIN_WINDOW} value={draft.rain_window} onChange={(v) => setDraft({ rain_window: v as ObservationInput["rain_window"] })} />
              <ChipGroup
                id="wet_season"
                label="Wet season weeks remaining (your estimate)"
                hint="e.g. from locals"
                options={WET_WEEKS}
                value={wetValue}
                highlight={focusField === "wet_season"}
                onChange={(v) => setDraft({ wet_season_weeks_remaining: v === undefined ? undefined : v === "unknown" ? null : (v as number) })}
              />
            </Group>
            <div>
              <div className="eyebrow mb-2">What you have</div>
              <ChipGroup id="available_resources" label="Available resources" multi options={RESOURCES} value={draft.available_resources} onChange={(v) => setDraft({ available_resources: v as string[] })} />
            </div>
            <div>
              <label htmlFor={`${textId}-advice`} className="eyebrow mb-2 block">Local advice you were given</label>
              <input
                id={`${textId}-advice`}
                type="text"
                value={draft.local_advice ?? ""}
                onChange={(e) => setDraft({ local_advice: e.target.value })}
                placeholder='e.g. what neighbours told you about this land'
                className="w-full rounded-xl border border-white/12 bg-midnight/60 px-4 py-2.5 text-ivory placeholder:text-mist/50 focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/30"
              />
              <p className="mt-1.5 text-sm text-mist">The system treats this as a claim to check, not as fact.</p>
            </div>
          </div>
        )}
      </div>

      {submitError && (
        <ErrorState title="Could not analyse the observation" message={submitError} onRetry={() => void submit()} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary min-w-[14rem] !py-3 text-base" disabled={!descOk || busy}>
          {busy ? <Spinner label={loading === "plan" ? "Refreshing plan…" : "Analysing…"} className="!text-midnight" /> : <><ScanSearch className="h-5 w-5" aria-hidden /> Analyse observation</>}
        </button>
        <span className="text-sm text-mist">Your text is kept if anything fails.</span>
      </div>
    </form>
  );
}
