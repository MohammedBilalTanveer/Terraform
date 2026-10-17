"""Pydantic models mirroring CONTRACT.md and frontend/src/types/terraform.ts field-for-field.

Request models are deliberately lenient (unknown enum values simply produce no tag);
response models use the exact literal enums of the contract.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

StepStatus = Literal["needs_input", "ready", "in_progress", "complete", "blocked"]
Confidence = Literal["low", "medium", "high"]
GenerationMode = Literal["deterministic", "llm_rewrite"]
SeasonFit = Literal["fits", "tight", "high_risk", "unknown"]
PlantingReadiness = Literal["ready", "not_ready", "ready_with_accepted_risk"]
GateTestResult = Literal["pass", "fail"]
Priority = Optional[Literal["do_first", "do_next", "avoid", "optional"]]


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ---------------------------------------------------------------- shared blocks
class Evidence(_Model):
    kb_ids: List[str] = Field(default_factory=list)
    source_ids: List[str] = Field(default_factory=list)


class Recommendation(_Model):
    id: str
    title: str
    explanation: str
    actions: List[str]
    everyday_amounts: List[str]
    why_this_matches: List[str]
    limitations: List[str]
    safety_notes: List[str]
    confidence: Confidence
    priority: Priority
    category: Optional[str]
    task_id: Optional[str]
    task_label: Optional[str]
    evidence: Evidence
    phase: Optional[Literal["prepare", "readiness", "plant"]] = None
    locked: bool = False
    locked_reason: Optional[Literal["choose_crop", "pass_gate", "choose_crop_and_pass_gate"]] = None


class StepMeta(_Model):
    step_id: str
    status: StepStatus
    title: str
    summary: str
    questions: List[str]
    warnings: List[str]
    evidence: Evidence


class ErrorBody(_Model):
    code: str
    message: str
    retryable: bool


class ErrorResponse(_Model):
    error: ErrorBody


# ---------------------------------------------------------------- requests
class CheckOutcome(_Model):
    check_id: str
    outcome_id: str


class ObservationInput(_Model):
    description: str = ""
    photo_id: Optional[str] = None
    surface_colour: Optional[str] = None
    surface_texture: List[str] = Field(default_factory=list)
    digging_resistance: Optional[str] = None
    rain_behavior: List[str] = Field(default_factory=list)
    vegetation: List[str] = Field(default_factory=list)
    slope: Optional[str] = None
    pooling: Optional[str] = None
    local_advice: Optional[str] = None
    available_resources: Optional[List[str]] = None
    resources_text: Optional[str] = None  # optional extension: free-text list of materials
    rain_window: Optional[str] = None
    wet_season_weeks_remaining: Optional[float] = Field(default=None, ge=0, le=104)
    user_confirmed_checks: List[CheckOutcome] = Field(default_factory=list)
    photo_confirmed_tags: List[str] = Field(default_factory=list)  # v1.1: user-confirmed photo cues


class AnalyzeRequest(_Model):
    session_id: Optional[str] = None
    scenario_id: str = "scenario_05_lateritic_hardpan"
    observation: ObservationInput


class PlanRequest(_Model):
    session_id: Optional[str] = None
    scenario_id: str = "scenario_05_lateritic_hardpan"
    observation: ObservationInput
    selected_crop_id: Optional[str] = None
    completed_tasks: List[str] = Field(default_factory=list)
    accepted_risks: List[str] = Field(default_factory=list)
    gate_results: Optional[Dict[str, GateTestResult]] = None


class GateResultBody(_Model):
    gate_id: str
    result: Optional[GateTestResult] = None


class ProgressRequest(_Model):
    task_id: Optional[str] = None
    completed: Optional[bool] = None
    accept_risk_gate_id: Optional[str] = None
    selected_crop_id: Optional[str] = None
    gate_result: Optional[GateResultBody] = None


class SessionUpdate(_Model):
    observation: Optional[ObservationInput] = None
    selected_crop_id: Optional[str] = None
    completed_tasks: Optional[List[str]] = None
    accepted_risks: Optional[List[str]] = None
    check_outcomes: Optional[List[CheckOutcome]] = None
    journal: Optional[List["JournalEntry"]] = None
    current_step: Optional[str] = None
    plan_id: Optional[str] = None
    gate_results: Optional[Dict[str, GateTestResult]] = None


class AskRequest(_Model):
    question: str
    session_id: Optional[str] = None
    plan_id: Optional[str] = None
    step_id: Optional[str] = None


# ---------------------------------------------------------------- health / knowledge
class HealthResponse(_Model):
    status: str
    kb_loaded: bool
    kb_version: str
    kb_record_count: int
    kb_errors: List[str]
    llm_enabled: bool
    generation_mode_default: GenerationMode
    kb_only_mode: bool
    vision_enabled: bool = False


class ScenarioSummary(_Model):
    id: str
    title: str
    tags: List[str]
    status: str


class ScenarioListResponse(_Model):
    scenarios: List[ScenarioSummary]


class SourceRecord(_Model):
    model_config = ConfigDict(extra="allow")
    id: str
    title: str = ""
    organization: str = ""
    url: str = ""
    accessed_on: str = ""
    notes: str = ""
    verification: str = ""


class KbRecordResponse(_Model):
    record: Dict[str, Any]
    collection: str
    sources: List[SourceRecord]


class SourcesResponse(_Model):
    sources: List[SourceRecord]


class StatsResponse(_Model):
    collections: Dict[str, int]
    kb_version: str


# ---------------------------------------------------------------- sessions
class JournalEntry(_Model):
    at: str
    text: str


class SessionState(_Model):
    session_id: str
    scenario_id: str
    created_at: str
    updated_at: str
    observation: Optional[ObservationInput]
    analysis_id: Optional[str]
    plan_id: Optional[str]
    selected_crop_id: Optional[str]
    completed_tasks: List[str]
    accepted_risks: List[str]
    check_outcomes: List[CheckOutcome]
    journal: List[JournalEntry]
    current_step: str
    gate_results: Dict[str, GateTestResult] = Field(default_factory=dict)


SessionUpdate.model_rebuild()


# ---------------------------------------------------------------- uploads
class PhotoUploadResponse(_Model):
    photo_id: str
    filename: str
    media_type: str
    size_bytes: int
    url: str
    analysis_status: Literal["attached_not_analyzed"]
    message: str


class SuggestedPhotoTag(_Model):
    tag: str
    label: str
    cue_id: Optional[str]


class PhotoAnalyzeResponse(_Model):
    photo_id: str
    vision_enabled: bool
    analysis_status: Literal["analyzed_tentative", "not_enabled", "failed"]
    message: str
    suggested: List[SuggestedPhotoTag]


# ---------------------------------------------------------------- analysis
class DerivedTag(_Model):
    tag: str
    label: str
    source: Literal["form", "description", "local_advice", "check", "photo"]
    matched_text: Optional[str]
    cue_id: Optional[str]


class AnalysisMeta(_Model):
    generation_mode: GenerationMode
    llm_used: bool
    kb_version: str
    created_at: str


class AnalysisSteps(_Model):
    observation_log: StepMeta
    input_echo: StepMeta
    missing_analysis: StepMeta


class ObservedFact(_Model):
    fact: str
    source: str
    cue_id: Optional[str]
    matched_text: Optional[str]


class NotProvided(_Model):
    field: str
    label: str
    why_it_matters: str


class LocalAdviceEcho(_Model):
    provided: bool
    text: Optional[str]
    handling: str


class CheckDone(_Model):
    check_id: str
    outcome_id: str
    label: str


class InputEcho(_Model):
    user_text: str
    faithful_summary: str
    observed_facts: List[ObservedFact]
    not_provided: List[NotProvided]
    photo_status: Literal["not_provided", "attached_not_analyzed", "analyzed_tentative_confirmed"]
    photo_message: str
    local_advice: LocalAdviceEcho
    checks_already_done: List[CheckDone]


class Archetype(_Model):
    scenario_id: str
    label: str
    match_strength: Literal["strong", "partial", "weak"]
    matched_signals: List[str]
    missing_signals: List[str]
    statement: str
    evidence: Evidence


class UnknownItem(_Model):
    id: str
    label: str
    why_it_matters: str
    check_ids: List[str]
    evidence: Evidence


class PossibleOutcome(_Model):
    outcome_id: str
    label: str
    interpretation: str
    implies_tags: List[str]


class CheckCard(Recommendation):
    phase: Optional[Literal["diagnose", "pre_plant", "post_sow"]] = None  # v1.5 (overrides the task phase: checks carry no task)
    where: Optional[Literal["ground", "water_hole", "runoff_path", "vegetation", "neighbours", "supplies",
                            "seeds", "trial_plot"]] = None
    purpose: str
    weak_evidence: bool
    gate_relevant: bool
    possible_outcomes: List[PossibleOutcome]
    user_outcome: Optional[str]


class Conflict(_Model):
    id: str
    label: str
    explanation: str
    evidence: Evidence


class FailureFactor(_Model):
    id: str
    label: str
    explanation: str
    what_is_missing: str
    status: Literal["observed", "likely", "not_indicated"]
    triggered_by: List[str]
    clues: List[str] = Field(default_factory=list)
    addressed_by: List[str]
    evidence: Evidence


class MissingAnalysis(_Model):
    archetype: Archetype
    unknowns: List[UnknownItem]
    checks: List[CheckCard]
    conflicts: List[Conflict]
    failure_factors: List[FailureFactor] = Field(default_factory=list)


class AnalysisResponse(_Model):
    analysis_id: str
    session_id: str
    scenario_id: str
    meta: AnalysisMeta
    derived_tags: List[DerivedTag]
    steps: AnalysisSteps
    input_echo: InputEcho
    missing_analysis: MissingAnalysis
    evidence: Evidence


# ---------------------------------------------------------------- plan
class WeeksRange(_Model):
    min: float
    max: float


class ScoreEntry(_Model):
    factor: str
    points: int
    reason: str


class CropCard(_Model):
    crop_id: str
    name: str
    local_names: List[str]
    category: Literal["field_crop", "tree", "soil_builder"]
    rank: int
    score: int
    fit_label: Literal["good_fit", "possible", "high_risk", "excluded"]
    why_it_may_fit: List[str]
    water_needs: str
    rooting_notes: str
    maturity_weeks: Optional[WeeksRange]
    maturity_description: str
    season_fit: SeasonFit
    resource_needs: List[str]
    missing_resources: List[str]
    limitations: List[str]
    cautions_triggered: List[str]
    score_breakdown: List[ScoreEntry]
    confidence: Confidence
    evidence: Evidence


class TimeframeRow(_Model):
    crop_id: str
    name: str
    maturity_weeks: WeeksRange
    buffer_weeks: WeeksRange
    total_weeks: WeeksRange
    season_fit: SeasonFit
    explanation: str
    evidence: Evidence
    remediation_weeks: Optional[WeeksRange] = None
    full_timeline_weeks: Optional[WeeksRange] = None


class CareStage(_Model):
    id: str
    stage: str
    order: float
    label: str
    timing_description: str
    water: str
    mulch: str
    nutrients: str
    weeds: str
    watch_for: List[str]
    dry_spell: str
    actions: List[str]
    evidence: Evidence


class BioOption(_Model):
    name: str
    preparation: str
    safe_use: List[str]
    cautions: List[str]


class PestCard(_Model):
    id: str
    title: str
    signs: List[str]
    actions: List[str]
    bio_options: List[BioOption]
    cautions: List[str]
    evidence: Evidence


class GateVerification(_Model):
    test: str
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    pass_: str = Field(alias="pass")
    fail: str
    if_fail: str


class GateItem(_Model):
    id: str
    label: str
    detail: str
    required: bool
    satisfied_by_tasks: List[str]
    satisfied: bool
    accepted_risk: bool
    evidence: Evidence
    verification: Optional[GateVerification] = None
    test_result: Optional[GateTestResult] = None
    task_done: bool = False
    can_accept_risk: bool = False
    blocking_reason: Optional[Literal["task_not_done", "test_not_run", "test_failed"]] = None


class Adaptation(_Model):
    trigger_tag: str
    label: str
    effect: str
    kb_ids: List[str]


class PlanMeta(_Model):
    plan_id: str
    session_id: str
    generation_mode: GenerationMode
    llm_used: bool
    created_at: str
    kb_version: str


class FixProtocolStep(StepMeta):
    do_first: List[Recommendation]
    do_next: List[Recommendation]
    avoid: List[Recommendation]
    optional: List[Recommendation]


class NextActionStep(StepMeta):
    readiness_gate: List[GateItem]
    blocked_until: List[str]
    planting_readiness: PlantingReadiness
    next_best_action: str
    gate_tasks: List[Recommendation] = Field(default_factory=list)


class CropSuggestionsStep(StepMeta):
    field_crops: List[CropCard]
    tree_options: List[CropCard]
    excluded: List[CropCard]
    trial_advice: Optional[Recommendation]
    local_advice_note: Optional[str]


class BufferInfo(_Model):
    kb_id: str
    weeks: WeeksRange
    explanation: str


class RemediationInfo(_Model):
    kb_id: str
    weeks: WeeksRange
    explanation: str


class SoilRecoveryNote(_Model):
    kb_id: str
    text: str


class TimeframeStep(StepMeta):
    season_assumption: str
    wet_season_weeks_remaining: Optional[float]
    buffer: BufferInfo
    rows: List[TimeframeRow]
    comparison: str
    remediation: Optional[RemediationInfo] = None
    soil_recovery_note: Optional[SoilRecoveryNote] = None
    calendar: Optional[PlantingCalendar] = None


class PlantingMethodStep(StepMeta):
    methods: List[Recommendation]
    sowing: List[Recommendation]
    water_capture: List[Recommendation]
    irrigation: List[Recommendation] = Field(default_factory=list)


class TroubleCard(_Model):
    id: str
    symptom: str
    likely_causes: List[str]
    actions: List[str]
    evidence: Evidence


class CalendarPhase(_Model):
    when: str
    actions: List[str]


class PlantingCalendar(_Model):
    kb_id: str
    phases: List[CalendarPhase]


class StressCard(Recommendation):
    stressor: str
    signs: List[str]


class OngoingCareStep(StepMeta):
    crop_id: Optional[str]
    crop_basis: Literal["selected", "top_ranked_default", "none"]
    stages: List[CareStage]
    pest_watch: List[PestCard]
    dry_spell_plan: List[Recommendation]
    stress_mitigation: List[StressCard] = Field(default_factory=list)
    troubleshooting: List[TroubleCard] = Field(default_factory=list)


class HarvestStep(StepMeta):
    crop_id: Optional[str]
    ripeness_cues_see: List[str]
    ripeness_cues_feel: List[str]
    method: List[str]
    drying_storage: List[str]
    do_not_store: List[str]
    residue_handling: List[str]
    regeneration: List[Recommendation]


class Workflow(_Model):
    checks: List[CheckCard] = Field(default_factory=list)
    fix_protocol: FixProtocolStep
    next_action: NextActionStep
    crop_suggestions: CropSuggestionsStep
    timeframe: TimeframeStep
    planting_method: PlantingMethodStep
    ongoing_care: OngoingCareStep
    harvest: HarvestStep


class PlanResponse(_Model):
    plan_id: str
    session_id: str
    scenario_id: str
    status: Literal["draft"]
    meta: PlanMeta
    derived_tags: List[DerivedTag]
    situation_summary: str
    adaptations: List[Adaptation]
    workflow: Workflow
    steps_status: Dict[str, StepStatus]
    completed_tasks: List[str]
    evidence: Evidence


class ProgressResponse(_Model):
    plan_id: str
    completed_tasks: List[str]
    accepted_risks: List[str]
    readiness_gate: List[GateItem]
    planting_readiness: PlantingReadiness
    steps_status: Dict[str, StepStatus]
    gate_results: Dict[str, GateTestResult] = Field(default_factory=dict)


# ---------------------------------------------------------------- assistant
class AskMatch(_Model):
    kb_id: str
    title: str
    snippet: str
    collection: str


class AskResponse(_Model):
    answer: str
    refused: bool
    matched: List[AskMatch]
    generation_mode: GenerationMode
    llm_used: bool
    evidence: Evidence
