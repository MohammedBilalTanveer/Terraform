// Shared TERRAFORM types — mirror of CONTRACT.md (snake_case, no mapping layer).
// Do not author agricultural content here; these are shapes only.

export const WORKFLOW_STEPS = [
  { id: "observation_log", n: 1, label: "Observation log", short: "Observe" },
  { id: "input_echo", n: 2, label: "Input echo", short: "Echo" },
  { id: "missing_analysis", n: 3, label: "Missing analysis", short: "Analyse" },
  { id: "fix_protocol", n: 4, label: "Fix protocol", short: "Fix" },
  { id: "next_action", n: 5, label: "Next action", short: "Gate" },
  { id: "crop_suggestions", n: 6, label: "Crop suggestions", short: "Crops" },
  { id: "timeframe", n: 7, label: "Timeframe", short: "Time" },
  { id: "planting_method", n: 8, label: "Planting method", short: "Plant" },
  { id: "ongoing_care", n: 9, label: "Ongoing care", short: "Care" },
  { id: "harvest", n: 10, label: "Harvest", short: "Harvest" },
] as const;

export type StepId = (typeof WORKFLOW_STEPS)[number]["id"];
export type StepStatus = "needs_input" | "ready" | "in_progress" | "complete" | "blocked";
export type Confidence = "low" | "medium" | "high";
export type GenerationMode = "deterministic" | "llm_rewrite";
export type AppMode = "landing" | "intro" | "dashboard" | "explorer";

export type Evidence = { kb_ids: string[]; source_ids: string[] };

export type ObservationInput = {
  description: string;
  photo_id?: string | null;
  surface_colour?: "reddish" | "dark" | "pale" | "unknown" | null;
  surface_texture?: string[];
  digging_resistance?:
    | "hard_layer_near_surface"
    | "varies_by_spot"
    | "rock_sheet_everywhere"
    | "can_dig_deep"
    | "unknown"
    | null;
  rain_behavior?: string[];
  vegetation?: string[];
  slope?: "flat" | "slight" | "steep" | "unknown";
  pooling?: "none_seen" | "some_areas" | "widespread" | "unknown";
  local_advice?: string | null;
  available_resources?: string[];
  rain_window?: "not_started" | "just_started" | "ongoing" | "ending" | "unknown";
  wet_season_weeks_remaining?: number | null;
  user_confirmed_checks?: { check_id: string; outcome_id: string }[];
  /** v1.1: tags the user confirmed from a tentative photo suggestion (source "photo"). */
  photo_confirmed_tags?: string[];
};

export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  actions: string[];
  everyday_amounts: string[];
  why_this_matches: string[];
  limitations: string[];
  safety_notes: string[];
  confidence: Confidence;
  priority: "do_first" | "do_next" | "avoid" | "optional" | null;
  category: string | null;
  task_id: string | null;
  task_label: string | null;
  evidence: Evidence;
};

export type StepMeta = {
  step_id: StepId;
  status: StepStatus;
  title: string;
  summary: string;
  questions: string[];
  warnings: string[];
  evidence: Evidence;
};

export type DerivedTag = {
  tag: string;
  label: string;
  source: "form" | "description" | "local_advice" | "check" | "photo";
  matched_text: string | null;
  cue_id: string | null;
};

export type CheckCard = Recommendation & {
  purpose: string;
  weak_evidence: boolean;
  gate_relevant: boolean;
  possible_outcomes: { outcome_id: string; label: string; interpretation: string; implies_tags: string[] }[];
  user_outcome: string | null;
};

export type AnalysisResponse = {
  analysis_id: string;
  session_id: string;
  scenario_id: string;
  meta: { generation_mode: GenerationMode; llm_used: boolean; kb_version: string; created_at: string };
  derived_tags: DerivedTag[];
  steps: { observation_log: StepMeta; input_echo: StepMeta; missing_analysis: StepMeta };
  input_echo: {
    user_text: string;
    faithful_summary: string;
    observed_facts: { fact: string; source: string; cue_id: string | null; matched_text: string | null }[];
    not_provided: { field: string; label: string; why_it_matters: string }[];
    photo_status: "not_provided" | "attached_not_analyzed" | "analyzed_tentative_confirmed";
    photo_message: string;
    local_advice: { provided: boolean; text: string | null; handling: string };
    checks_already_done: { check_id: string; outcome_id: string; label: string }[];
  };
  missing_analysis: {
    archetype: {
      scenario_id: string;
      label: string;
      match_strength: "strong" | "partial" | "weak";
      matched_signals: string[];
      missing_signals: string[];
      statement: string;
      evidence: Evidence;
    };
    unknowns: { id: string; label: string; why_it_matters: string; check_ids: string[]; evidence: Evidence }[];
    checks: CheckCard[];
    conflicts: { id: string; label: string; explanation: string; evidence: Evidence }[];
    /** v1.1: root causes / dominant failure factors */
    failure_factors?: FailureFactor[];
  };
  evidence: Evidence;
};

export type FailureFactor = {
  id: string;
  label: string;
  explanation: string;
  what_is_missing: string;
  status: "observed" | "likely" | "not_indicated";
  /** labels of DIRECT observations that show this factor (→ "observed") */
  triggered_by: string[];
  /** v1.1b: labels of indirect clues that only suggest it (→ "likely", never "observed") */
  clues?: string[];
  addressed_by: string[];
  evidence: Evidence;
};

export type GateVerification = { test: string; pass: string; fail: string; if_fail: string };
export type GateTestResult = "pass" | "fail";

export type TroubleCard = { id: string; symptom: string; likely_causes: string[]; actions: string[]; evidence: Evidence };

export type StressCard = Recommendation & { stressor: string; signs: string[] };

export type SeasonFit = "fits" | "tight" | "high_risk" | "unknown";
export type WeeksRange = { min: number; max: number };

export type CropCard = {
  crop_id: string;
  name: string;
  local_names: string[];
  category: "field_crop" | "tree" | "soil_builder";
  rank: number;
  score: number;
  fit_label: "good_fit" | "possible" | "high_risk" | "excluded";
  why_it_may_fit: string[];
  water_needs: string;
  rooting_notes: string;
  maturity_weeks: WeeksRange | null;
  maturity_description: string;
  season_fit: SeasonFit;
  resource_needs: string[];
  missing_resources: string[];
  limitations: string[];
  cautions_triggered: string[];
  score_breakdown: { factor: string; points: number; reason: string }[];
  confidence: Confidence;
  evidence: Evidence;
};

export type TimeframeRow = {
  crop_id: string;
  name: string;
  maturity_weeks: WeeksRange;
  buffer_weeks: WeeksRange;
  total_weeks: WeeksRange;
  /** v1.1 dual timeline */
  remediation_weeks?: WeeksRange | null;
  full_timeline_weeks?: WeeksRange;
  season_fit: SeasonFit;
  explanation: string;
  evidence: Evidence;
};

export type CareStage = {
  id: string;
  stage: string;
  order: number;
  label: string;
  timing_description: string;
  water: string;
  mulch: string;
  nutrients: string;
  weeds: string;
  watch_for: string[];
  dry_spell: string;
  actions: string[];
  evidence: Evidence;
};

export type PestCard = {
  id: string;
  title: string;
  signs: string[];
  actions: string[];
  bio_options: { name: string; preparation: string; safe_use: string[]; cautions: string[] }[];
  cautions: string[];
  evidence: Evidence;
};

export type GateItem = {
  id: string;
  label: string;
  detail: string;
  required: boolean;
  satisfied_by_tasks: string[];
  satisfied: boolean;
  accepted_risk: boolean;
  evidence: Evidence;
  /** v1.1 empirical pass/fail test */
  verification?: GateVerification | null;
  test_result?: GateTestResult | null;
  task_done?: boolean;
  /** v1.3: accept-risk only waives the test, and only after the task is done */
  can_accept_risk?: boolean;
  blocking_reason?: "task_not_done" | "test_not_run" | "test_failed" | null;
};

export type PlantingReadiness = "ready" | "not_ready" | "ready_with_accepted_risk";

export type PlanResponse = {
  plan_id: string;
  session_id: string;
  scenario_id: string;
  status: "draft";
  meta: {
    plan_id: string;
    session_id: string;
    generation_mode: GenerationMode;
    llm_used: boolean;
    created_at: string;
    kb_version: string;
  };
  derived_tags: DerivedTag[];
  situation_summary: string;
  adaptations: { trigger_tag: string; label: string; effect: string; kb_ids: string[] }[];
  workflow: {
    fix_protocol: StepMeta & {
      do_first: Recommendation[];
      do_next: Recommendation[];
      avoid: Recommendation[];
      optional: Recommendation[];
    };
    next_action: StepMeta & {
      readiness_gate: GateItem[];
      blocked_until: string[];
      planting_readiness: PlantingReadiness;
      next_best_action: string;
      /** v1.3: Recommendations for every applicable gate's tasks (so each gate is completable on the gate page) */
      gate_tasks?: Recommendation[];
    };
    crop_suggestions: StepMeta & {
      field_crops: CropCard[];
      tree_options: CropCard[];
      excluded: CropCard[];
      trial_advice: Recommendation | null;
      local_advice_note: string | null;
    };
    timeframe: StepMeta & {
      season_assumption: string;
      wet_season_weeks_remaining: number | null;
      buffer: { kb_id: string; weeks: WeeksRange; explanation: string };
      rows: TimeframeRow[];
      comparison: string;
      remediation?: { kb_id: string; weeks: WeeksRange; explanation: string } | null;
      soil_recovery_note?: { kb_id: string; text: string } | null;
      /** v1.2 planting calendar relative to the first reliable rain (R) — never calendar dates */
      calendar?: { kb_id: string; phases: { when: string; actions: string[] }[] } | null;
    };
    planting_method: StepMeta & {
      methods: Recommendation[];
      sowing: Recommendation[];
      water_capture: Recommendation[];
      irrigation?: Recommendation[];
    };
    ongoing_care: StepMeta & {
      crop_id: string | null;
      crop_basis: "selected" | "top_ranked_default" | "none";
      stages: CareStage[];
      pest_watch: PestCard[];
      dry_spell_plan: Recommendation[];
      stress_mitigation?: StressCard[];
      /** v1.2 symptom → cause → action */
      troubleshooting?: TroubleCard[];
    };
    harvest: StepMeta & {
      crop_id: string | null;
      ripeness_cues_see: string[];
      ripeness_cues_feel: string[];
      method: string[];
      drying_storage: string[];
      do_not_store: string[];
      residue_handling: string[];
      regeneration: Recommendation[];
    };
  };
  steps_status: Record<string, StepStatus>;
  completed_tasks: string[];
  evidence: Evidence;
};

export type ProgressResponse = {
  plan_id: string;
  completed_tasks: string[];
  accepted_risks: string[];
  readiness_gate: GateItem[];
  planting_readiness: PlantingReadiness;
  steps_status: Record<string, StepStatus>;
  gate_results?: Record<string, GateTestResult>;
};

export type SessionState = {
  session_id: string;
  scenario_id: string;
  created_at: string;
  updated_at: string;
  observation: ObservationInput | null;
  analysis_id: string | null;
  plan_id: string | null;
  selected_crop_id: string | null;
  completed_tasks: string[];
  accepted_risks: string[];
  check_outcomes: { check_id: string; outcome_id: string }[];
  journal: { at: string; text: string }[];
  current_step: string;
  gate_results?: Record<string, GateTestResult>;
};

export type HealthResponse = {
  status: string;
  kb_loaded: boolean;
  kb_version: string;
  kb_record_count: number;
  kb_errors: string[];
  llm_enabled: boolean;
  generation_mode_default: GenerationMode;
  kb_only_mode: boolean;
  vision_enabled?: boolean;
};

export type PhotoUploadResponse = {
  photo_id: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  url: string;
  analysis_status: "attached_not_analyzed";
  message: string;
};

export type KbRecordResponse = {
  record: Record<string, unknown> & { id: string; title?: string };
  collection: string;
  sources: {
    id: string;
    title: string;
    organization: string;
    url: string;
    accessed_on: string;
    notes: string;
    verification: string;
  }[];
};

export type AskResponse = {
  answer: string;
  refused: boolean;
  matched: { kb_id: string; title: string; snippet: string; collection: string }[];
  generation_mode: GenerationMode;
  llm_used: boolean;
  evidence: Evidence;
};

export type PhotoAnalyzeResponse = {
  photo_id: string;
  vision_enabled: boolean;
  analysis_status: "analyzed_tentative" | "not_enabled" | "failed";
  message: string;
  suggested: { tag: string; label: string; cue_id: string | null }[];
};

/** Official evaluation-rubric stage numbers per workflow step (observation_log is the intake). */
export const RUBRIC_STAGE: Partial<Record<StepId, { n: string; name: string }>> = {
  input_echo: { n: "01", name: "Input echo" },
  missing_analysis: { n: "02", name: "Missing analysis" },
  fix_protocol: { n: "03", name: "Fix protocol" },
  next_action: { n: "04", name: "Next action" },
  crop_suggestions: { n: "05", name: "Crop suggestions" },
  timeframe: { n: "06", name: "Timeframe" },
  planting_method: { n: "07", name: "Planting method" },
  ongoing_care: { n: "08", name: "Ongoing care" },
  harvest: { n: "09", name: "Harvest & regen" },
};
