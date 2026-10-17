# TERRAFORM — Shared Contract (binding for every session)

This file is the single agreement between the Knowledge Base, Backend, Dashboard and Explorer sessions.
**Do not rename fields, IDs, tags or endpoints defined here.** If something is missing, add it in a
backward-compatible way and note it at the bottom under "Change log".

Naming: **snake_case everywhere** (JSON, Python, and the TypeScript types — no camelCase mapping layer).
Ports: backend `http://127.0.0.1:8000`, frontend `http://localhost:5173`.

---

## 0. The non-negotiable rule

All agricultural content (checks, treatments, amounts, crops, maturity, care, pests, harvest, regeneration)
lives **only** in `knowledge_base/*.json`. The backend *selects and combines* records using tags; it never
authors advice in Python strings. The frontend *renders* API responses; it never authors advice.
Every advice object carries `evidence: { kb_ids, source_ids }` and every listed ID must exist in the KB.
The optional LLM may only re-word already-selected text and is validated + falls back to deterministic.

No scientific readings, no lab values, no pH numbers. Amounts are everyday ("a handful", "a bucketful",
"a forearm deep", "knee-high", "a few paces"). Durations in weeks are allowed (crop maturity, buffer).

---

## 1. Canonical workflow step IDs (use everywhere: stepper, progress, quests, robot)

```
01 observation_log
02 input_echo
03 missing_analysis
04 fix_protocol
05 next_action
06 crop_suggestions
07 timeframe
08 planting_method
09 ongoing_care
10 harvest
```
Step status enum: `needs_input | ready | in_progress | complete | blocked`

---

## 2. Observation tag vocabulary (derived facts)

The backend converts the observation (form fields + free text + check outcomes) into **tags**, using the
KB file `observation_cues.json` (keyword phrases and field→value mappings live in the KB, not in Python).

| Group | Tags |
|---|---|
| colour | `colour_reddish`, `colour_dark`, `colour_pale` |
| texture | `texture_stony`, `texture_gravelly`, `texture_rock_lumps`, `texture_crusted` |
| digging | `digging_shallow` (stops ~hand's depth), `digging_deep_possible` |
| hardpan | `hardpan_patchy` (depth varies / deeper pockets), `hardpan_continuous` (rock sheet everywhere) — if neither: unknown |
| rain behaviour | `runoff_fast`, `rain_soaks_in`, `erosion_marks` |
| slope | `slope_flat`, `slope_slight`, `slope_steep` — if none: `slope_unknown` |
| pooling | `pooling_none`, `pooling_some`, `pooling_widespread` — if none: `pooling_unknown` |
| rain window | `rain_not_started`, `rain_just_started`, `rain_ongoing`, `rain_ending` — if none: `rain_unknown` |
| season length | `season_known` (user gave weeks remaining) else `season_unknown` |
| vegetation | `vegetation_dry_grass`, `vegetation_thorny_shrubs`, `vegetation_trees_nearby` |
| local advice | `local_advice_trees_only`, `local_advice_other` — if none: `local_advice_none` |
| resources | `res_compost`, `res_manure`, `res_mulch`, `res_leaf_litter`, `res_stones`, `res_wood_ash`, `res_crushed_shells`, `res_water_containers`, `res_seeds`, `res_hand_tools`, `res_bucket` |
| scarcity | `no_compost` (user said no compost/manure), `low_water` (little/no stored water) |
| checks | `fizz_seen`, `fizz_none` (weak clues only), `drains_fast`, `drains_slow` |
| photo | `photo_attached` |

Unknown is a real state. Missing fields → the `_unknown` tag (never `false`).

---

## 3. Knowledge base files (`knowledge_base/`)

Every file has this envelope:
```json
{ "collection": "crop_profiles", "version": "1.0.0", "records": [ ... ] }
```
Every record has these **common fields**:
```json
{
  "id": "crop_pearl_millet",             // globally unique, stable, prefix by collection
  "topic": "crop",
  "title": "Pearl millet (bajra)",
  "scenario_tags": ["scenario_05_lateritic_hardpan"],
  "applies_when": { "any_tags": [], "all_tags": [], "none_tags": [] },   // empty = always
  "summary": "One or two plain-language sentences.",
  "instructions": ["..."],
  "everyday_amounts": ["..."],
  "limitations": ["..."],
  "safety_notes": ["..."],
  "evidence_level": "general_guidance | locally_verified | needs_local_confirmation",
  "source_ids": ["src_..."],
  "created_by": "TERRAFORM team — original synthesis",
  "version": "1.0.0"
}
```
`applies_when` semantics: record applies if (any_tags empty OR ≥1 present) AND (all present) AND (none of none_tags present).

ID prefixes: `scenario_`, `cue_`, `check_`, `treat_`, `crop_`, `plant_`, `care_`, `pest_`, `harvest_`, `regen_`, `time_`, `gate_`, `src_`.

### 3.1 `scenario_catalog.json`
records: `{ id, title, tags, file, status: "available" | "planned" }` (Scenario 5 available; others "planned").

### 3.2 `scenario_05_lateritic_hardpan.json` (single scenario record in `records`)
```json
{
  "id": "scenario_05_lateritic_hardpan",
  "title": "Lateritic Hardpan Plateau",
  "soil_archetype": "shallow acidic lateritic soil over a hard layer (hardpan)",
  "climate": "...", "main_constraints": ["..."],
  "signals": [ { "tag": "colour_reddish", "label": "reddish surface", "weight": 2 }, ... ],
  "match_thresholds": { "strong": 6, "partial": 3 },
  "unknowns": [
    { "id": "unknown_hardpan_continuity", "label": "How deep and how continuous the hard layer is",
      "why_it_matters": "...", "resolved_by_tags": ["hardpan_patchy","hardpan_continuous"],
      "check_ids": ["check_probe_multiple_spots"] }
  ],
  "readiness_gate": [
    { "id": "gate_beds_or_pits_ready", "label": "...", "detail": "...", "required": true,
      "satisfied_by_tasks": ["task_build_pits", "task_build_raised_beds"],   // ANY of these completes it
      "applies_when": { ... }, "source_ids": [] }
  ],
  ...common fields
}
```

### 3.3 `observation_cues.json`
```json
{ "id": "cue_reddish", "tag": "colour_reddish", "label": "reddish surface",
  "keywords": ["red", "reddish", "rust", "laterite"],            // lowercase phrases matched in text
  "negation_guard": ["not red"],                                  // optional: phrases that cancel a match
  "text_fields": ["description"],                                  // which free-text fields to scan ("description","local_advice","resources_text")
  "field_matches": [ { "field": "surface_colour", "values": ["reddish"] } ],  // structured form mapping
  "meaning": "...", "limitations": ["..."] }
```

### 3.4 `diagnostic_checks.json`
Adds: `purpose`, `weak_evidence` (bool — true for the baking-soda fizz check), `gate_relevant` (bool),
`resolves_unknowns: ["unknown_..."]`,
`possible_outcomes: [ { "outcome_id": "resistance_varies", "label": "...", "interpretation": "...", "implies_tags": ["hardpan_patchy"] } ]`.

### 3.5 `soil_treatments.json` (soil depth, fertility, acidity, mulch, water capture, "avoid" rules)
Adds: `category: soil_depth | fertility | acidity | mulch | water_capture | safety`,
`priority: do_first | do_next | avoid | optional`, `purpose`, `target_constraints: [...]`,
`requires_resources: [res_* tags]`, `alternatives_if_missing: ["..."]`, `expected_observable_change: ["..."]`,
`task: { "task_id": "task_build_pits", "label": "Dig and fill planting pits" } | null`.

### 3.6 `crop_profiles.json`
Adds:
```json
{ "name": "Pearl millet", "local_names": ["bajra"], "category": "field_crop | tree",
  "suitability_tags": ["acid_tolerant","shallow_rooting_ok","drought_tolerant","short_season","nitrogen_fixing","low_fertility_ok","needs_deep_soil","high_water_demand"],
  "cautions": [ { "when_tag": "hardpan_continuous", "effect": "penalize | exclude", "reason": "..." } ],
  "water_needs_plain": "...", "rooting_notes": "...",
  "maturity_weeks": { "min": 10, "max": 13 }, "maturity_description": "...",
  "resource_needs": ["res_seeds"], "care_stage_ids": [...], "pest_ids": [...],
  "harvest_profile_id": "harvest_pearl_millet", "planting_method_ids": [...] }
```
Trees use `category: "tree"` and are always shown separately as long-term options.

### 3.7 `planting_methods.json`
Adds `method_type: planting_pit | raised_bed | container | stone_line | half_moon | sowing | water_storage | mulching`, `steps: [...]`, `when_to_sow: "..."`, `task: {task_id,label}|null`.

### 3.8 `care_stages.json`
Adds `crop_ids: ["*"]` (generic) or specific crop ids, `stage: germination | seedling | vegetative | flowering | pre_harvest`,
`order`, `label`, `timing_description`, `water`, `mulch`, `nutrients`, `weeds`, `watch_for: [...]`, `dry_spell`, `actions: [...]`.

### 3.9 `pest_management.json`
Adds `crop_ids`, `signs: [...]`, `actions: [...]`, `bio_options: [ { "name", "preparation", "safe_use": [...], "cautions": [...] } ]`.

### 3.10 `harvest_profiles.json`
Adds `crop_id`, `ripeness_cues_see: [...]`, `ripeness_cues_feel: [...]`, `method: [...]`, `drying_storage: [...]`, `do_not_store: [...]`, `residue_handling: [...]`.

### 3.11 `regeneration.json` — post-harvest soil regeneration (residue return, organic matter, extend pits/stone lines, gradual expansion).

### 3.12 `timeframe_rules.json`
```json
{ "id": "time_buffer_late_start", "buffer_weeks": { "min": 2, "max": 3 }, "explanation": "...", ...common }
{ "id": "time_rule_unknown_season", ... }   // text used when season length unknown
```

### 3.13 `sources.json`
records: `{ id, title, organization, url, accessed_on, supports_kb_ids: [...], notes, verification: "fetched_and_read" | "recorded_not_fetched" }`.

---

## 4. Shared response building blocks

```ts
type Evidence = { kb_ids: string[]; source_ids: string[] };
type Confidence = "low" | "medium" | "high";
// confidence rule: high = record evidence_level locally_verified OR (≥1 source AND all required tags known);
// medium = ≥1 source but some relevant unknowns; low = no sources or key unknowns (hardpan/season) unresolved.

type Recommendation = {
  id: string;                 // usually the kb record id
  title: string;
  explanation: string;        // from record.summary / purpose
  actions: string[];          // from record.instructions / steps
  everyday_amounts: string[];
  why_this_matches: string[]; // which observed tags triggered it (labels from cues)
  limitations: string[];
  safety_notes: string[];
  confidence: Confidence;
  priority: "do_first" | "do_next" | "avoid" | "optional" | null;
  category: string | null;
  task_id: string | null;     // completable task (fix protocol / planting)
  task_label: string | null;
  evidence: Evidence;
};

type StepMeta = { step_id: string; status: StepStatus; title: string; summary: string;
                  questions: string[]; warnings: string[]; evidence: Evidence };
```

Error shape (any non-2xx): `{ "error": { "code": "KB_RECORD_NOT_FOUND", "message": "...", "retryable": false } }`

---

## 5. Endpoints

### `GET /api/health`
`{ status: "ok", kb_loaded: bool, kb_version: string, kb_record_count: number, kb_errors: string[], llm_enabled: bool, generation_mode_default: "deterministic" | "llm_rewrite", kb_only_mode: true }`

### `GET /api/knowledge/scenarios` → `{ scenarios: [{ id, title, tags, status }] }`
### `GET /api/knowledge/scenarios/{scenario_id}` → the scenario record
### `GET /api/knowledge/records/{kb_id}` → `{ record: {...}, collection: string, sources: [source records] }` (powers the Evidence drawer)
### `GET /api/knowledge/sources` → `{ sources: [...] }`
### `GET /api/knowledge/stats` → `{ collections: { name: count }, kb_version }`

### `POST /api/sessions` → `SessionState` (new empty)
### `GET /api/sessions/{session_id}` → `SessionState`
### `PUT /api/sessions/{session_id}` (partial update) body: any subset of `{ observation, selected_crop_id, completed_tasks, accepted_risks, check_outcomes, journal, current_step, plan_id }` → `SessionState`
```ts
type SessionState = {
  session_id: string; scenario_id: string; created_at: string; updated_at: string;
  observation: ObservationInput | null; analysis_id: string | null; plan_id: string | null;
  selected_crop_id: string | null; completed_tasks: string[]; accepted_risks: string[];
  check_outcomes: { check_id: string; outcome_id: string }[];
  journal: { at: string; text: string }[]; current_step: string;
};
```

### `POST /api/uploads/land-photo` (multipart field `file`; jpeg/png/webp; max 8 MB)
→ `{ photo_id, filename, media_type, size_bytes, url: "/api/uploads/{photo_id}", analysis_status: "attached_not_analyzed", message: "Photo attached; visual analysis is not enabled. The text description was used." }`
### `GET /api/uploads/{photo_id}` → the image bytes

### `POST /api/observations/analyze`
Request:
```ts
type ObservationInput = {
  description: string;                       // required free text (may be short)
  photo_id?: string | null;
  surface_colour?: "reddish" | "dark" | "pale" | "unknown" | null;
  surface_texture?: string[];                // "stony" | "gravelly" | "rock_lumps" | "crusted"
  digging_resistance?: "hard_layer_near_surface" | "varies_by_spot" | "rock_sheet_everywhere" | "can_dig_deep" | "unknown" | null;
  rain_behavior?: string[];                  // "fast_runoff" | "soaks_in" | "red_streams" | "pools"
  vegetation?: string[];                     // "dry_grass" | "thorny_shrubs" | "trees_nearby"
  slope?: "flat" | "slight" | "steep" | "unknown";
  pooling?: "none_seen" | "some_areas" | "widespread" | "unknown";
  local_advice?: string | null;              // free text claim, e.g. "only tree crops grow here"
  available_resources?: string[];            // "compost","manure","mulch","leaf_litter","stones","wood_ash","crushed_shells","water_containers","seeds","hand_tools","bucket","none_compost","little_water"
  rain_window?: "not_started" | "just_started" | "ongoing" | "ending" | "unknown";
  wet_season_weeks_remaining?: number | null; // user's estimate (e.g. from locals); null = unknown
  user_confirmed_checks?: { check_id: string; outcome_id: string }[];
};
type AnalyzeRequest = { session_id?: string | null; scenario_id: string; observation: ObservationInput };
```
Response:
```ts
type DerivedTag = { tag: string; label: string; source: "form" | "description" | "local_advice" | "check" | "photo"; matched_text: string | null; cue_id: string | null };

type AnalysisResponse = {
  analysis_id: string; session_id: string; scenario_id: string;
  meta: { generation_mode: "deterministic" | "llm_rewrite"; llm_used: boolean; kb_version: string; created_at: string };
  derived_tags: DerivedTag[];
  steps: { observation_log: StepMeta; input_echo: StepMeta; missing_analysis: StepMeta };
  input_echo: {
    user_text: string;                          // verbatim
    faithful_summary: string;                   // assembled only from derived tag labels
    observed_facts: { fact: string; source: string; cue_id: string | null; matched_text: string | null }[];
    not_provided: { field: string; label: string; why_it_matters: string }[];
    photo_status: "not_provided" | "attached_not_analyzed";
    photo_message: string;
    local_advice: { provided: boolean; text: string | null; handling: string } ; // "Treated as a claim to check, not as fact."
    checks_already_done: { check_id: string; outcome_id: string; label: string }[];
  };
  missing_analysis: {
    archetype: { scenario_id: string; label: string; match_strength: "strong" | "partial" | "weak";
                 matched_signals: string[]; missing_signals: string[]; statement: string; evidence: Evidence };
    unknowns: { id: string; label: string; why_it_matters: string; check_ids: string[]; evidence: Evidence }[];
    checks: CheckCard[];
    conflicts: { id: string; label: string; explanation: string; evidence: Evidence }[];  // e.g. local advice vs. observations
  };
  evidence: Evidence;
};
type CheckCard = Recommendation & { purpose: string; weak_evidence: boolean; gate_relevant: boolean;
  possible_outcomes: { outcome_id: string; label: string; interpretation: string; implies_tags: string[] }[];
  user_outcome: string | null };
```

### `POST /api/plans/generate`
Request: `{ session_id?: string | null; scenario_id: string; observation: ObservationInput; selected_crop_id?: string | null; completed_tasks?: string[]; accepted_risks?: string[] }`
Response:
```ts
type CropCard = {
  crop_id: string; name: string; local_names: string[]; category: "field_crop" | "tree";
  rank: number; score: number; fit_label: "good_fit" | "possible" | "high_risk" | "excluded";
  why_it_may_fit: string[]; water_needs: string; rooting_notes: string;
  maturity_weeks: { min: number; max: number } | null; maturity_description: string;
  season_fit: "fits" | "tight" | "high_risk" | "unknown";
  resource_needs: string[]; missing_resources: string[];
  limitations: string[]; cautions_triggered: string[];
  score_breakdown: { factor: string; points: number; reason: string }[];
  confidence: Confidence; evidence: Evidence;
};
type TimeframeRow = { crop_id: string; name: string; maturity_weeks: { min: number; max: number };
  buffer_weeks: { min: number; max: number }; total_weeks: { min: number; max: number };
  season_fit: "fits" | "tight" | "high_risk" | "unknown"; explanation: string; evidence: Evidence };
type CareStage = { id: string; stage: string; order: number; label: string; timing_description: string;
  water: string; mulch: string; nutrients: string; weeds: string; watch_for: string[]; dry_spell: string;
  actions: string[]; evidence: Evidence };
type PestCard = { id: string; title: string; signs: string[]; actions: string[];
  bio_options: { name: string; preparation: string; safe_use: string[]; cautions: string[] }[];
  cautions: string[]; evidence: Evidence };
type GateItem = { id: string; label: string; detail: string; required: boolean;
  satisfied_by_tasks: string[]; satisfied: boolean; accepted_risk: boolean; evidence: Evidence };

type PlanResponse = {
  plan_id: string; session_id: string; scenario_id: string; status: "draft";
  meta: { plan_id: string; session_id: string; generation_mode: "deterministic" | "llm_rewrite"; llm_used: boolean; created_at: string; kb_version: string };
  derived_tags: DerivedTag[];
  situation_summary: string;
  adaptations: { trigger_tag: string; label: string; effect: string; kb_ids: string[] }[];  // why this plan differs (variation demo)
  workflow: {
    fix_protocol: StepMeta & { do_first: Recommendation[]; do_next: Recommendation[]; avoid: Recommendation[]; optional: Recommendation[] };
    next_action: StepMeta & { readiness_gate: GateItem[]; blocked_until: string[];
                 planting_readiness: "ready" | "not_ready" | "ready_with_accepted_risk"; next_best_action: string };
    crop_suggestions: StepMeta & { field_crops: CropCard[]; tree_options: CropCard[]; excluded: CropCard[];
                 trial_advice: Recommendation | null; local_advice_note: string | null };
    timeframe: StepMeta & { season_assumption: string; wet_season_weeks_remaining: number | null;
                 buffer: { kb_id: string; weeks: { min: number; max: number }; explanation: string };
                 rows: TimeframeRow[]; comparison: string };
    planting_method: StepMeta & { methods: Recommendation[]; sowing: Recommendation[]; water_capture: Recommendation[] };
    ongoing_care: StepMeta & { crop_id: string | null; crop_basis: "selected" | "top_ranked_default" | "none";
                 stages: CareStage[]; pest_watch: PestCard[]; dry_spell_plan: Recommendation[] };
    harvest: StepMeta & { crop_id: string | null; ripeness_cues_see: string[]; ripeness_cues_feel: string[];
                 method: string[]; drying_storage: string[]; do_not_store: string[]; residue_handling: string[];
                 regeneration: Recommendation[] };
  };
  steps_status: Record<string, StepStatus>;   // keys = canonical step ids
  completed_tasks: string[];
  evidence: Evidence;
};
```

### `GET /api/plans/{plan_id}` → `PlanResponse`
### `PATCH /api/plans/{plan_id}/progress`
Body: `{ task_id?: string; completed?: boolean; accept_risk_gate_id?: string; selected_crop_id?: string | null }`
→ `{ plan_id, completed_tasks, accepted_risks, readiness_gate: GateItem[], planting_readiness, steps_status }`

### `POST /api/assistant/ask`
Body: `{ question: string; session_id?: string | null; plan_id?: string | null; step_id?: string | null }`
→ `{ answer: string; refused: boolean; matched: { kb_id: string; title: string; snippet: string; collection: string }[]; generation_mode; llm_used; evidence: Evidence }`
If nothing in the KB matches: `refused: true`, answer = "The knowledge base does not contain enough information to answer this safely." + a suggested observation.

---

## 6. Frontend ownership map

- `frontend/src/types/terraform.ts`, `frontend/src/api/terraformApi.ts`, `frontend/src/store/terraformStore.ts` — **shared, already scaffolded**. Dashboard and Explorer both use them. Only add, don't break.
- `frontend/src/dashboard/**`, `frontend/src/components/**`, `frontend/src/landing/**` — Dashboard session.
- `frontend/src/game/**`, `frontend/src/intro/**`, `frontend/public/assets/**` — Explorer session.
- `frontend/src/App.tsx` — routes by `store.mode`: `"landing" | "intro" | "dashboard" | "explorer"`.

## Change log
- v1.0 initial contract.

---

# v1.1 — Evaluation-rubric additions (additive, backward compatible)

Driven by the official 9-stage rubric. Ground rule still applies: **no lab readings, no fixed numbers for soil
chemistry; thresholds are everyday observations** ("no water standing by the next morning").

## KB additions
1. `scenario_05_lateritic_hardpan.json` → each `readiness_gate` item gains
   `"verification": { "test": "...", "pass": "...", "fail": "...", "if_fail": "..." } | null`
   (an empirical, hands-and-eyes test with clear PASS / FAIL descriptions; `null` only for purely administrative items).
2. Scenario record gains `failure_factors: [ { "id": "factor_shallow_rooting", "label": "...", "explanation": "...",
   "what_is_missing": "rooting depth" , "triggered_by_tags": ["digging_shallow", ...], "always_likely": false,
   "addressed_by": ["treat_raised_beds", ...] } ]` — root causes / dominant failure factors (rooting depth, water capture,
   water retention, organic matter, nutrients, acidity, ground cover / windbreak, dry-season length …).
3. `timeframe_rules.json` gains `time_remediation_prep` with `"prep_weeks": {"min": n, "max": n}` + explanation
   (building pits/beds, gathering organic matter, letting fill settle, before the first reliable rains) and
   `time_soil_recovery` (qualitative multi-season soil-recovery note, no weeks needed).
4. `planting_methods.json` gains `method_type: "irrigation"` records (buried clay pot, bottle drip from household
   bottles, mulched basin, watering at the base at cool times, using stored water only for seedlings first).
   Sowing records must include planting depth & geometry in everyday terms (finger-joint depth, spacing in hand-spans/paces).
5. New file `stress_mitigation.json` (collection `stress_mitigation`, prefix `stress_`): common fields plus
   `stressor: "heat" | "hot_wind" | "dry_spell" | "waterlogging" | "heavy_rain_washout" | "acidity_stress" | "nutrient_stress"`,
   `signs: [...]`, `actions: [...]`, `task: null`. Windbreak / shade / live hedge measures belong here.

## API additions
- `GET /api/health` adds `vision_enabled: bool`.
- `ObservationInput` adds `photo_confirmed_tags?: string[]` — tags the user CONFIRMED from a photo suggestion; tagged with
  `source: "photo"`. Unconfirmed photo suggestions are never used.
- `POST /api/uploads/{photo_id}/analyze` → `{ photo_id, vision_enabled, analysis_status: "analyzed_tentative" | "not_enabled" | "failed",
  message, suggested: [{ tag, label, cue_id }] }`. Only tags from the KB cue vocabulary that are VISIBLE cues
  (colour, texture, rock lumps, crust, pooling, erosion marks, vegetation, slope) may be suggested; the backend filters
  the model output to that allow-list. Never soil chemistry, depth or hardpan continuity from a photo. If vision is off:
  `not_enabled` + honest message. Env: `ENABLE_VISION=false`, `OPENAI_VISION_MODEL=`.
- `AnalysisResponse.missing_analysis.failure_factors: [{ id, label, explanation, what_is_missing,
   status: "observed" | "likely" | "not_indicated", triggered_by: string[] (labels), addressed_by: string[], evidence }]`
- `GateItem` adds `verification: {test, pass, fail, if_fail} | null`, `test_result: "pass" | "fail" | null`, `task_done: bool`.
  `satisfied = task_done AND (verification is null OR test_result == "pass")`. Accepted risk still allowed.
- `PATCH /api/plans/{plan_id}/progress` body adds `gate_result?: { gate_id: string; result: "pass" | "fail" | null }`;
  response adds `gate_results: Record<string, "pass" | "fail">`. Session stores `gate_results`;
  `POST /api/plans/generate` accepts `gate_results?: Record<string, "pass" | "fail">`.
- `timeframe` adds `remediation: { kb_id, weeks: {min,max}, explanation } | null` and `soil_recovery_note: { kb_id, text } | null`;
  `TimeframeRow` adds `remediation_weeks: {min,max} | null` and `full_timeline_weeks: {min,max}` (= remediation + buffer + maturity).
- `planting_method` adds `irrigation: Recommendation[]`.
- `ongoing_care` adds `stress_mitigation: (Recommendation & { stressor: string; signs: string[] })[]`.
- Rubric stage mapping for UI labels: input_echo=01, missing_analysis=02, fix_protocol=03, next_action=04,
  crop_suggestions=05, timeframe=06, planting_method=07, ongoing_care=08, harvest=09 (observation_log = intake).

## Change log
- v1.1 rubric additions: empirical gate tests, failure factors, dual timeline, irrigation, stress mitigation, photo cue suggestions.
- v1.1b failure-factor honesty: scenario `failure_factors[]` gain `indirect_tags: [...]` (clues that only SUGGEST the factor,
  e.g. reddish colour → likely acidity / low organic matter). `triggered_by_tags` must contain only DIRECT observations.
  Status rule: `observed` iff a triggered_by tag is present; `likely` iff an indirect tag is present OR `always_likely`;
  otherwise `not_indicated`. `_unknown` tags never make a factor observed. API FailureFactor adds `clues: string[]`
  (labels of matched indirect tags). Waterlogging must be `not_indicated` unless pooling is reported.

# v1.2 — Merge of teammate field notes (additive)
Source: teammate KB at `OneDrive\Desktop\knowledgebase` (no citations). Content is REWRITTEN into our schema; records
derived from it cite `src_team_field_notes` (verification `"team_notes_unverified"`) and use
`evidence_level: "needs_local_confirmation"` unless an external source is also found and fetched.
## KB
- `crop_profiles.json`: may add field crops / trees (e.g. amaranth greens (very fast leaf harvest), sorghum, sweet potato, cassava,
  pineapple, moringa, neem, sunn hemp green manure, vetiver hedge) — each fully linked (care/pest/harvest/planting ids).
  Non-food soil builders use `category: "tree"` or a new `category: "soil_builder"` (shown with trees, never ranked as food).
- NEW `troubleshooting.json` (collection `troubleshooting`, prefix `trouble_`): common fields + `symptom`, `likely_causes: [...]`,
  `actions: [...]`, `related_kb_ids: [...]`, `stage_hint` (optional).
- NEW `field_faq.json` (collection `field_faq`, prefix `faq_`): common fields + `question`, `answer`, `related_kb_ids`.
  Used by the assistant search only.
- `timeframe_rules.json`: `time_calendar_relative_to_rain` with `phases: [{ "when": "Before the first reliable rain (R)", "actions": [...] }, ...]`
  (R-relative, never calendar dates).
- More checks / treatments / planting methods as useful (seed sprout test, float seed test, life count, two-fill drainage,
  compost-making methods, pit chains, overflow notch, soil-mix layers, seed sourcing, storage/preservation).
## API
- `ongoing_care.troubleshooting: { id, symptom, likely_causes: string[], actions: string[], evidence }[]` (all records; applicable via applies_when).
- `timeframe.calendar: { kb_id: string; phases: { when: string; actions: string[] }[] } | null`.
- Crop `category` may be `"soil_builder"` → returned in `tree_options` list (long-term / non-food), never in field_crops.
- Assistant search includes `troubleshooting` and `field_faq`.

# v1.3 — Gate honesty + UX (additive)
- **Accept risk waives only the empirical TEST, never the TASK.** A required gate is satisfied only when its task is done
  AND (no verification OR test passed OR risk accepted). `PATCH /progress {accept_risk_gate_id}` on a gate whose task is not
  done → 409 `{"error":{"code":"TASK_NOT_DONE","message":"Complete the task first — accepting a risk only skips the test.","retryable":false}}`.
  If a task is later un-ticked, any accepted risk on that gate is dropped.
- `GateItem` adds `can_accept_risk: boolean` (task_done && test not passed && not already accepted) and
  `blocking_reason: "task_not_done" | "test_not_run" | "test_failed" | null`.
- `planting_readiness`: `ready` = all required gates satisfied with no accepted risk; `ready_with_accepted_risk` = all satisfied,
  ≥1 via accepted risk; else `not_ready`. Planting/care/harvest stay blocked while `not_ready`.
- Assistant: "what next / what should I do / where do I go / what's left" questions (with plan_id or session_id) answer from the
  plan's `next_best_action` + the labels of unsatisfied required gates (KB text) with those gates' KB ids; never refused when a plan exists.

# v1.4 — One enforced workflow order (additive)
Order of work, enforced by the BACKEND and displayed identically by the Dashboard and the 3D Explorer:
`prepare (fix protocol tasks) → readiness (gate tasks + empirical tests) → choose crop → plant (sow tasks) → care stages → harvest`.
- **KB:** every `task` object (soil_treatments + planting_methods) gains `"phase": "prepare" | "readiness" | "plant"`.
  - `prepare`: building/gathering work (spot, pits, beds, containers, stone lines, half-moons, mulch, compost, organic matter, water storage, trial plot, compost heap, overflow …).
  - `readiness`: checks/confirmations the gate depends on (task_confirm_reliable_rains, task_test_moisture_retention, task_recheck_fizz_optional …).
  - `plant`: everything that happens at or after sowing (task_sow_seeds, task_mulch_after_sowing, task_plant_tree_seedlings …).
- **API:** `Recommendation` gains `phase?: "prepare"|"readiness"|"plant"|null`, `locked?: boolean`,
  `locked_reason?: "choose_crop" | "pass_gate" | "choose_crop_and_pass_gate" | null`.
  A `plant`-phase task is locked until `planting_readiness != "not_ready"` AND a crop is selected. `prepare`/`readiness` tasks are never locked.
  Applies to every Recommendation that carries a task_id (fix_protocol, planting_method, gate_tasks, …).
- `PATCH /api/plans/{id}/progress {task_id, completed:true}` on a locked task → **409** `{"error":{"code":"TASK_LOCKED","message":"<neutral text: Choose a crop first / Pass the readiness gate first>","retryable":false}}`.
  Un-ticking is always allowed.
- `GateItem` gate tasks (`next_action.gate_tasks`) must always include `task_confirm_reliable_rains` (phase `readiness`) so it is completable at the gate; it must NOT be locked.
- Frontends: never offer a "complete" button for a locked task; show a lock + reason + a button that goes to what unlocks it (Crops tab/step, Readiness tab/step).
  "Sown/planted" state requires a selected crop AND readiness ok AND the sowing task done.

# v1.5 — Diagnostic checks as real steps; every location has a purpose (additive)
Problem: the no-lab checks (stick probe, baking-soda "sodium bicarbonate" fizz test, hand-deep water-hole drainage test, watching where rain runs, observing vegetation, asking neighbours, supplies inventory, seed sprout test, watching trial plants, …) existed only as an optional list; the guided quest never walked the player through them, and some map locations did nothing.
- **KB (`diagnostic_checks.json`)**: every check gains
  `"phase": "diagnose" | "pre_plant" | "post_sow"` (before the plan / before sowing / after sowing) and
  `"where": "ground" | "water_hole" | "runoff_path" | "vegetation" | "neighbours" | "supplies" | "seeds" | "trial_plot"`
  (the kind of place the check is done — the game maps it to a location).
- **API**: `CheckCard` gains `phase` and `where`. `PlanResponse.workflow.checks: CheckCard[]` = EVERY applicable check (all phases, deduped) with `user_outcome` merged from `observation.user_confirmed_checks`.
  `missing_analysis.checks` keeps its current meaning (checks relevant to unresolved unknowns) and also carries phase/where.
- **Game**: `where` → location: ground→soil, water_hole→waterhole, runoff_path→gully, vegetation→grove, neighbours→camp, supplies→outpost, seeds→plot, trial_plot→plot. Every location must have a purpose, real content and an explanation (see `frontend/src/game/places.ts`).
