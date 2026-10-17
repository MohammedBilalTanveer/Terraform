# TERRAFORM knowledge base

All agricultural content for TERRAFORM lives here. The backend only selects and combines these records using tags, and the frontend only renders what the backend returns. Neither one writes advice of its own. `CONTRACT.md` (sections 2 and 3) is the binding specification, and this folder follows it exactly.

## Files

| File | Collection | What it holds |
|---|---|---|
| `scenario_catalog.json` | scenario_catalog | Index of scenarios. Scenario 5 is `available`; Scenarios 1–4 are `planned` placeholders. |
| `scenario_05_lateritic_hardpan.json` | scenario_05_lateritic_hardpan | One scenario record. It holds the archetype, the weighted `signals`, `match_thresholds`, the `unknowns` (each with `resolved_by_tags` and `check_ids`) and the `readiness_gate`. |
| `observation_cues.json` | observation_cues | Rules that turn the form and free text into tags. They use keywords, a `negation_guard`, `text_fields` and `field_matches`. |
| `diagnostic_checks.json` | diagnostic_checks | Checks done with no equipment, each with `possible_outcomes` → `implies_tags`. The baking-soda fizz check has `weak_evidence: true`. |
| `soil_treatments.json` | soil_treatments | The fix protocol. Each record has a `category`, a `priority` (do_first / do_next / optional / avoid) and an optional completable `task`. |
| `crop_profiles.json` | crop_profiles | 8 field crops and 3 tree options. Each has `suitability_tags`, `cautions` (penalize/exclude by tag), `maturity_weeks` and cross-references. |
| `planting_methods.json` | planting_methods | Pits, beds, containers, stone lines, half-moons, sowing, mulching, water storage and tree planting. |
| `care_stages.json` | care_stages | Generic (`crop_ids: ["*"]`) and crop-specific care, broken down by stage. |
| `pest_management.json` | pest_management | Signs, actions and low-risk `bio_options` with `safe_use` and `cautions`. |
| `harvest_profiles.json` | harvest_profiles | One record per crop: ripeness you can see and feel, harvest method, drying and storage, and what to do with residue. |
| `regeneration.json` | regeneration | Soil rebuilding after harvest. |
| `timeframe_rules.json` | timeframe_rules | The 2–3 week late-start buffer, `time_remediation_prep` (2–4 prep weeks), `time_soil_recovery` (qualitative, multi-season), the unknown-season text, the fit rules (fits/tight/high_risk/unknown), the rains-ending rule and the tree rule. |
| `stress_mitigation.json` | stress_mitigation | v1.1. One record per `stressor`: heat, hot_wind (windbreaks, dead and live hedges), dry_spell, waterlogging, heavy_rain_washout, acidity_stress, nutrient_stress. Each has `signs`, `actions`, `related_kb_ids`, and `task: null`. |
| `troubleshooting.json` | troubleshooting | v1.2. Records indexed by symptom, each with `likely_causes`, `actions`, `related_kb_ids` and an optional `stage_hint`. |
| `field_faq.json` | field_faq | v1.2. Plain-language questions and answers for assistant search (`question`, `answer`, `related_kb_ids`). |
| `sources.json` | sources | Provenance. Each source records `verification` and `supports_kb_ids`. |
| `schema.json` | – | JSON Schema for the envelope and the common record. |

Every file uses the envelope `{ "collection": <file stem>, "version": "1.2.0", "records": [...] }`. Every record carries all the common fields: `id, topic, title, scenario_tags, applies_when, summary, instructions, everyday_amounts, limitations, safety_notes, evidence_level, source_ids, created_by, version`. Empty lists are written as `[]`.

## Key conventions

- **IDs** are globally unique and use the contract prefixes. There is one deliberate exception: `scenario_catalog` entries reuse the id of the scenario they point to (e.g. `scenario_05_lateritic_hardpan`). That way `GET /api/knowledge/scenarios/{id}` resolves directly. Readiness-gate items (`gate_*`) and unknowns (`unknown_*`) live inside the scenario record.
- **Tasks.** Completable tasks are defined only in the `task` objects of `soil_treatments` and `planting_methods`, and each `task_id` appears exactly once. Since v1.4 each task has a required `phase`: `prepare` (build or gather work), `readiness` (checks the gate depends on, e.g. `task_confirm_reliable_rains`, `task_test_moisture_retention`, `task_recheck_fizz_optional`) or `plant` (at or after sowing: `task_sow_seeds`, `task_mulch_after_sowing`, `task_plant_tree_seedlings`). The order of work is prepare, then readiness, then choose a crop, then plant. A gate item may only list `prepare` or `readiness` tasks, never `plant`. Gate items list `satisfied_by_tasks`, and completing ANY one of them satisfies the item.
- **Tags.** Only the Section 2 vocabulary is used. The `_unknown` tags (slope/pooling/rain/season/local advice) are defaults that the backend applies when nothing else matched. Cues are provided for the form value `unknown` where the form has one. `season_known` should be set by the backend when `wet_season_weeks_remaining` is a number; its keyword cue is only a fallback. `photo_attached` is set by the backend from `photo_id` and has no cue.
- **Keyword matching.** Keywords and guards are lowercase phrases. We recommend matching on word boundaries, not raw substrings. The keywords were chosen to avoid common substring traps (for example there is no bare "red", "rust", "ash" or "pots"), but word-boundary matching is safer for unseen phrasings. If any phrase from a cue's `negation_guard` appears in a scanned field, the cue does not fire from text for that field.
- **No lab values.** There are no pH figures, no metric units and no lab readings. Amounts are everyday measures: a handful, a bucketful, a forearm wide and deep, knee-high, a few paces, a finger-joint deep. Only maturity, buffer and similar durations are given as numbers of weeks.
- **The fizz check is a weak clue only.** It appears as an optional, `required: false` gate item and an optional treatment, and it never blocks planting. "No fizz" never counts as evidence that the soil is not acidic.
- **Local advice is a claim to check, not a fact.** `local_advice_trees_only` triggers a required trial-plot gate. Tree options are still shown separately.
- **No promised yields.** Crop records describe fit and risk, never yield.

## v1.1 additions (evaluation rubric)

- **Gate verification.** Every `readiness_gate` item has `verification: {test, pass, fail, if_fail}`. Each test is done with hands and eyes, and the pass and fail lines are things you can observe: water standing or not by the next morning, a squeezed handful that holds and then crumbles, soil moist down to the hard layer, damp a finger deep under mulch, fine soil settling behind the stone lines. The only `null` is `gate_trial_plot_suggested`, which is administrative and optional. `gate_moisture_retention_checked` (task `task_test_moisture_retention`) is new and optional. The fizz gate stays optional and weak: it has no failing outcome.
- **Failure factors.** The scenario record has `failure_factors` (`factor_*`), which are the root causes. Each one has `what_is_missing`, `triggered_by_tags`, `always_likely` and `addressed_by` (existing KB ids, including `stress_*`). Since v1.1b, `triggered_by_tags` holds only DIRECT observations, which make a factor `observed`. Inferential clues go in `indirect_tags`, which make it `likely`, as `always_likely` also does. No `*_unknown` tag appears in either list. Likely acidity, low organic matter and low nutrients have indirect clues only. Waterlogging stays `not_indicated` unless pooling or slow drainage is reported.
- **Irrigation.** `planting_methods.json` has five `method_type: "irrigation"` records: buried clay pot, bottle drip, mulched basin, watering at the base at cool times, and matching the planted area to stored water. `plant_direct_sowing` carries `planting_depth`, `spacing`, `seeds_per_spot` and `thinning`, all in finger-joints, hand-spans and paces.
- **Regeneration.** Now includes `regen_cover_crop_living_mulch` and `regen_preserve_beds_windbreaks`.

## v1.5: checks as real steps

- Every record in `diagnostic_checks.json` has a required `phase` (`diagnose`, `pre_plant` or `post_sow`) and a required `where` (`ground`, `water_hole`, `runoff_path`, `vegetation`, `neighbours`, `supplies`, `seeds` or `trial_plot`). There is at least one check for every `where` value, and the validator enforces it.
- The baking-soda (sodium bicarbonate) fizz test spells out how to do it: wet soil in a cup or lid, a pinch to a small spoonful of baking soda, and watch for about a minute. Its outcomes are `fizz_seen` and `fizz_none`. It is a weak clue, not a pH reading, and no fizz proves nothing. The optional post-treatment repeat (`treat_fizz_recheck_optional`, `task_recheck_fizz_optional`, `gate_fizz_recheck_optional`) says that a weaker fizz is a hopeful sign, not proof.
- The depth check is worded as "dig as deep as you can" in hand-depths. Two checks were added: `check_leaf_colour_hunger` (a no-lab clue about nutrient shortage, taken from seedlings in the trial plot) and `check_rain_tally` (a running count of soaking rains, because exact rain dates are unknown). `plant_rainwater_harvest` now covers storing rainwater and mulching through dry spells.

## Provenance: teammate notes (v1.2)

- A teammate wrote a separate, uncited Scenario 5 knowledge base: crop guides, troubleshooting, Q&A, a calendar counted from the first reliable rain, hand tests, compost, storage and sourcing tips. We merged the useful parts and **rewrote them in our own words** to fit this schema and our safety rules.
- Everything merged from it cites `src_team_field_notes`, whose `verification` is `team_notes_unverified` and whose `url` is empty. A record that relies on that source alone must be `evidence_level: needs_local_confirmation`, and the validator enforces this.
- Where we found and actually read a real source, we cite it as well:
  - TNAU amaranthus and sweet potato pages
  - FAO cassava soil notes
  - Crop Trust on stay-green sorghum
- **What we added:**
  - Crops: amaranth greens, sorghum, sweet potato and cassava as field crops; pineapple, neem and moringa as long-term options (`tree`); sunn hemp and a grass hedge as `soil_builder` (non-food, never ranked as food).
  - Pests: leaf caterpillars, sweet potato weevil, cassava mosaic, rats and rodents.
  - Checks: seed sprout test, float seed test (weak), life count. The two-fill drainage idea was merged into `check_water_hole_drainage`.
  - Treatments: layered compost heap, pit or trench compost, overflow notch, pit chains.
  - Planting methods: soil-mix layers, cuttings and slips, seed sourcing, and a covered hollow water store with strong safety limits.
  - New collections: `troubleshooting.json` and `field_faq.json`.
  - Timeframe: `time_calendar_relative_to_rain`, counted from the first reliable rain with no calendar dates.
- **What we left out on purpose:**
  - Baking-soda, milk and urine sprays.
  - Gypsum, lime and biochar, and fertiliser or shop-chemical dosing.
  - Salinity and contamination items, and tests not relevant to Scenario 5 (jar, ribbon, cabbage juice, vinegar).
  - Archetypes for other scenarios, the quizzes, and the game mapping.
  - Any numeric amounts. We kept chilli and garlic infusions only as a last-resort bio option with strong cautions.

## Provenance policy

- `created_by` is "TERRAFORM team — original synthesis" on every record. All text is our own concise rewording. Nothing is copied at length from any source.
- `sources.json` lists every source we cited, with `verification`:
  - `fetched_and_read`: the page was actually opened and read during research.
  - `team_notes_unverified`: internal teammate notes; this is not an external source (see above).
  - `recorded_not_fetched`: we only saw it through search-result summaries, or the fetch failed (unreadable PDF, network or certificate error). It is kept for traceability, and its `limitations` field says so.
- `supports_kb_ids` is generated from the records that cite each source, so the two always agree.
- `evidence_level`:
  - `general_guidance`: well-established practice that is supported by the cited sources.
  - `needs_local_confirmation`: plausible but not directly sourced, or highly variable locally (e.g. little millet, niger, groundnut, mango and gliricidia suitability on this exact soil; wood-ash use; the fizz check). It should be confirmed with a local trial.
  - `locally_verified`: reserved for future field-confirmed content. It is not used yet.
- Numbers found in sources (cm, kg, days, pH) were deliberately converted to everyday measures and weeks, or left out.

## Adding a scenario

1. Add a file `scenario_NN_<slug>.json` with collection `scenario_NN_<slug>` and a single scenario record shaped like Scenario 5. It needs `signals`, `match_thresholds`, `unknowns`, and a `readiness_gate` whose tasks exist in the KB.
2. Change the matching `scenario_catalog.json` entry to `status: "available"`, `file: "<new file>"`, and use the real scenario id and title.
3. Add or extend records in the shared collections. Set their `scenario_tags` to include the new scenario id, and use `applies_when` tags so that only relevant records are selected. Use the Section 2 vocabulary. If you need new tags, add them to CONTRACT.md first (backward-compatible) and note it in its change log.
4. Add any new sources to `sources.json` and regenerate `supports_kb_ids`.
5. Run the KB validation script before committing. The script is kept outside this folder, so that the folder holds only data. It checks the envelope, common fields, unique IDs, every cross-reference (sources, care/pest/harvest/planting ids, check ids, gate tasks, supports_kb_ids), vocabulary tags, and banned units. It also validates the files against `schema.json`.
