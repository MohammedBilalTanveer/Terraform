import SamplePhotos from "../../components/SamplePhotos";
// Step 1 — Observation Board. Everything entered here is the user's own observation (input, not advice).
import { useRef, useState } from "react";
import { Camera, ScanLine, Sparkles } from "lucide-react";
import type { ObservationInput } from "../../types/terraform";
import { api } from "../../api/terraformApi";
import { useTerraform } from "../../store/terraformStore";
import { useGame } from "../gameStore";
import { Busy, Card, ErrorNote, GlassPanel, GhostButton, PrimaryButton, Section, cx } from "./kit";

type Opt = { v: string; l: string };
const TEXTURE: Opt[] = [
  { v: "stony", l: "Stony" },
  { v: "gravelly", l: "Gravelly" },
  { v: "rock_lumps", l: "Rock lumps" },
  { v: "crusted", l: "Crusted" },
];
const DIGGING: Opt[] = [
  { v: "hard_layer_near_surface", l: "Hard layer near surface" },
  { v: "varies_by_spot", l: "Varies by spot" },
  { v: "rock_sheet_everywhere", l: "Rock sheet everywhere" },
  { v: "can_dig_deep", l: "Can dig deep" },
  { v: "unknown", l: "Not sure" },
];
const RAIN: Opt[] = [
  { v: "fast_runoff", l: "Runs off fast" },
  { v: "soaks_in", l: "Soaks in" },
  { v: "red_streams", l: "Red streams" },
  { v: "pools", l: "Pools" },
];
const VEG: Opt[] = [
  { v: "dry_grass", l: "Dry grass" },
  { v: "thorny_shrubs", l: "Thorny shrubs" },
  { v: "trees_nearby", l: "Trees nearby" },
];
const SLOPE: Opt[] = [
  { v: "flat", l: "Flat" },
  { v: "slight", l: "Slight" },
  { v: "steep", l: "Steep" },
  { v: "unknown", l: "Not sure" },
];
const POOL: Opt[] = [
  { v: "none_seen", l: "None seen" },
  { v: "some_areas", l: "Some areas" },
  { v: "widespread", l: "Widespread" },
  { v: "unknown", l: "Not sure" },
];
const RAINWIN: Opt[] = [
  { v: "not_started", l: "Not started" },
  { v: "just_started", l: "Just started" },
  { v: "ongoing", l: "Ongoing" },
  { v: "ending", l: "Ending" },
  { v: "unknown", l: "Not sure" },
];
const RES: Opt[] = [
  { v: "compost", l: "Compost" },
  { v: "manure", l: "Manure" },
  { v: "mulch", l: "Mulch" },
  { v: "leaf_litter", l: "Leaf litter" },
  { v: "stones", l: "Stones" },
  { v: "wood_ash", l: "Wood ash" },
  { v: "crushed_shells", l: "Crushed shells" },
  { v: "water_containers", l: "Water containers" },
  { v: "seeds", l: "Seeds" },
  { v: "hand_tools", l: "Hand tools" },
  { v: "bucket", l: "Bucket" },
  { v: "none_compost", l: "No compost" },
  { v: "little_water", l: "Little water" },
];

/** Example observations a survivor might write (user input samples for the demo — not advice). */
const EXAMPLES: { label: string; obs: ObservationInput }[] = [
  {
    label: "Hard red ground",
    obs: {
      description:
        "Reddish, stony ground on a wide flat plateau. When I dig with a stick it stops at about a hand's depth on something hard. After rain the water runs off fast and leaves red streams. Mostly dry grass and thorny shrubs. A neighbour says only cashew trees will grow here.",
      surface_colour: "reddish",
      surface_texture: ["stony", "gravelly"],
      digging_resistance: "hard_layer_near_surface",
      rain_behavior: ["fast_runoff", "red_streams"],
      vegetation: ["dry_grass", "thorny_shrubs"],
      slope: "flat",
      local_advice: "Only cashew trees grow here.",
      available_resources: ["stones", "leaf_litter", "bucket", "seeds", "hand_tools"],
      rain_window: "just_started",
    },
  },
  {
    label: "Patchy depth",
    obs: {
      description:
        "Red gravelly soil with rock lumps. In some spots I can dig deeper than in others. The slope is slight and a few low places hold water after rain. I have some manure, wood ash, stones and two water containers.",
      surface_colour: "reddish",
      surface_texture: ["gravelly", "rock_lumps"],
      digging_resistance: "varies_by_spot",
      rain_behavior: ["fast_runoff"],
      slope: "slight",
      pooling: "some_areas",
      available_resources: ["manure", "wood_ash", "stones", "water_containers", "seeds"],
      rain_window: "ongoing",
      wet_season_weeks_remaining: 14,
    },
  },
  {
    label: "Barely observed",
    obs: { description: "Red, hard ground. I don't know much else yet." },
  },
];

function ChipGroup({ label, opts, value, multi, onChange }: { label: string; opts: Opt[]; value: string[] | string | null | undefined; multi?: boolean; onChange: (v: string[] | string | null) => void }) {
  const sel = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-ivory/65">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => {
          const on = sel.includes(o.v);
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (multi) onChange(on ? sel.filter((x) => x !== o.v) : [...sel, o.v]);
                else onChange(on ? null : o.v);
              }}
              className={cx(
                "rounded-full border px-2.5 py-1 text-[11.5px] transition",
                on ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-50" : "border-white/12 bg-white/[0.04] text-ivory/75 hover:border-white/30",
              )}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ObservationPanel({ onClose }: { onClose: () => void }) {
  const stored = useTerraform((s) => s.observation);
  const analyze = useTerraform((s) => s.analyze);
  const loading = useTerraform((s) => s.loading);
  const error = useTerraform((s) => s.error);
  const photoPreviewUrl = useTerraform((s) => s.photoPreviewUrl);
  const setPhotoPreviewUrl = useTerraform((s) => s.setPhotoPreviewUrl);
  const toast = useTerraform((s) => s.toast);
  const runAction = useGame((s) => s.runAction);
  const [o, setO] = useState<ObservationInput>(stored ?? { description: "" });
  const [more, setMore] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ObservationInput>(k: K, v: ObservationInput[K]) => setO((p) => ({ ...p, [k]: v }));

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setPhotoMsg(null);
    try {
      const r = await api.uploadPhoto(f);
      set("photo_id", r.photo_id);
      setPhotoPreviewUrl(URL.createObjectURL(f));
      setPhotoMsg(r.message);
    } catch (e) {
      setPhotoMsg((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!o.description.trim()) return;
    runAction({ kind: "inspect", label: "Logging observations", station: "board", fast: true });
    const res = await analyze(o);
    if (res) toast("success", "Observations logged — TERRA has updated your next step.");
    else useGame.getState().setOverlay("board");
  };

  return (
    <GlassPanel
      title="Observation Board"
      kicker="LOG WHAT YOU SEE"
      steps={["observation_log"]}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ivory/55">Describe the land in your own words. Unknown is fine.</span>
          <PrimaryButton onClick={() => void submit()} disabled={!o.description.trim() || loading === "analyze"}>
            <ScanLine className="h-4 w-4" /> Analyse observations
          </PrimaryButton>
        </div>
      }
    >
      {loading === "analyze" && <Busy label="Matching your observations against the knowledge base…" />}
      {error && <ErrorNote message={error} onRetry={() => void submit()} />}
      <Section title="Load an example">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <GhostButton key={e.label} onClick={() => setO({ ...e.obs })}>
              <Sparkles className="h-3.5 w-3.5" /> {e.label}
            </GhostButton>
          ))}
        </div>
      </Section>
      <Section title="Description">
        <textarea
          value={o.description}
          onChange={(e) => set("description", e.target.value)}
          rows={5}
          placeholder="What colour is the ground? What happens when you dig? Where does rainwater go? What grows nearby? What do you have?"
          className="w-full resize-y rounded-xl border border-white/12 bg-[#060a18]/70 px-3 py-2 text-[13px] leading-relaxed text-ivory placeholder:text-ivory/35 focus:border-cyan-300/60 focus:outline-none"
        />
      </Section>
      <Section title="Quick observations">
        <div className="space-y-3">
          <ChipGroup label="Surface colour" opts={[{ v: "reddish", l: "Reddish" }, { v: "dark", l: "Dark" }, { v: "pale", l: "Pale" }, { v: "unknown", l: "Not sure" }]} value={o.surface_colour} onChange={(v) => set("surface_colour", v as ObservationInput["surface_colour"])} />
          <ChipGroup label="Texture" opts={TEXTURE} value={o.surface_texture} multi onChange={(v) => set("surface_texture", v as string[])} />
          <ChipGroup label="When you dig" opts={DIGGING} value={o.digging_resistance} onChange={(v) => set("digging_resistance", v as ObservationInput["digging_resistance"])} />
          <ChipGroup label="When it rains" opts={RAIN} value={o.rain_behavior} multi onChange={(v) => set("rain_behavior", v as string[])} />
          <ChipGroup label="Available resources" opts={RES} value={o.available_resources} multi onChange={(v) => set("available_resources", v as string[])} />
        </div>
      </Section>
      <button type="button" className="text-[12px] text-cyan-200 underline" onClick={() => setMore(!more)}>
        {more ? "Hide" : "Show"} more fields (vegetation, slope, pooling, rain window, season, local advice)
      </button>
      {more && (
        <div className="space-y-3">
          <ChipGroup label="Vegetation" opts={VEG} value={o.vegetation} multi onChange={(v) => set("vegetation", v as string[])} />
          <ChipGroup label="Slope" opts={SLOPE} value={o.slope} onChange={(v) => set("slope", (v ?? undefined) as ObservationInput["slope"])} />
          <ChipGroup label="Water pooling" opts={POOL} value={o.pooling} onChange={(v) => set("pooling", (v ?? undefined) as ObservationInput["pooling"])} />
          <ChipGroup label="Rainy season" opts={RAINWIN} value={o.rain_window} onChange={(v) => set("rain_window", (v ?? undefined) as ObservationInput["rain_window"])} />
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ivory/65">Weeks of wet season left (your estimate — leave empty if unknown)</span>
            <input
              type="number"
              min={0}
              max={52}
              value={o.wet_season_weeks_remaining ?? ""}
              onChange={(e) => set("wet_season_weeks_remaining", e.target.value === "" ? null : Number(e.target.value))}
              className="w-28 rounded-lg border border-white/12 bg-[#060a18]/70 px-2 py-1 text-[13px] focus:border-cyan-300/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ivory/65">What locals told you (treated as a claim to check)</span>
            <input
              type="text"
              value={o.local_advice ?? ""}
              onChange={(e) => set("local_advice", e.target.value || null)}
              className="w-full rounded-lg border border-white/12 bg-[#060a18]/70 px-2 py-1 text-[13px] focus:border-cyan-300/60 focus:outline-none"
            />
          </label>
        </div>
      )}
      <Section title="Land photo (optional)">
        <Card className="flex items-center gap-3">
          {photoPreviewUrl ? (
            <img src={photoPreviewUrl} alt="Attached land photo" className="h-14 w-20 rounded-md object-cover" />
          ) : (
            <div className="grid h-14 w-20 place-items-center rounded-md border border-dashed border-white/20 text-ivory/40">
              <Camera className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 text-[12px] text-ivory/70">
            {uploading ? "Uploading…" : photoMsg ?? (o.photo_id ? "Photo attached." : "Attach a photo of the ground. It is stored with your log.")}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          <GhostButton onClick={() => fileRef.current?.click()}>{o.photo_id ? "Replace" : "Attach"}</GhostButton>
        </Card>
        <div className="mt-2">
          <SamplePhotos onPick={(f) => void onPhoto(f)} disabled={uploading} />
        </div>
      </Section>
    </GlassPanel>
  );
}
