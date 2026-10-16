// Maps API plan data onto world stations. This file only *routes* records returned by the backend
// (by category / id / task id keywords); it never invents agricultural text.
import type { AnalysisResponse, Evidence, PlanResponse, Recommendation, StepId, StepStatus } from "../types/terraform";
import { WORKFLOW_STEPS } from "../types/terraform";
import type { ActionKind, FarmView } from "./gameStore";
import type { StationId } from "./worldConfig";

export type Section =
  | "do_first"
  | "do_next"
  | "optional"
  | "avoid"
  | "methods"
  | "sowing"
  | "water_capture"
  | "dry_spell"
  | "regeneration"
  | "gate";

export type TaskGroup = "terraces" | "compost" | "water" | "plot" | "harvest" | "other";

export type PlanItem = {
  rec: Recommendation;
  section: Section;
  group: TaskGroup;
  action: ActionKind;
  step: StepId;
};

export const SECTION_LABEL: Record<Section, string> = {
  do_first: "Do first",
  do_next: "Do next",
  optional: "Optional",
  avoid: "Avoid",
  methods: "Planting method",
  sowing: "Sowing",
  water_capture: "Water capture",
  dry_spell: "Dry-spell plan",
  regeneration: "After harvest",
  gate: "Readiness gate",
};

export const GROUP_STATION: Record<TaskGroup, StationId> = {
  terraces: "terraces",
  compost: "compost",
  water: "water",
  plot: "plot",
  harvest: "harvest",
  other: "outpost",
};

const keyOf = (r: Recommendation) => `${r.category ?? ""} ${r.id} ${r.task_id ?? ""}`.toLowerCase();

function classify(r: Recommendation, section: Section): TaskGroup {
  const k = keyOf(r);
  if (section === "regeneration") return "harvest";
  if (/stone|contour|half_moon|halfmoon|bund|terrace/.test(k)) return "terraces";
  // checks/confirmations the readiness gate depends on are done at the plot itself
  if (r.phase === "readiness" && !/fizz|recheck/.test(k)) return "plot";
  if (section === "sowing") return "plot";
  if (section === "dry_spell") return "water";
  if (/fizz|recheck/.test(k)) return "other";
  if (/after_sow/.test(k)) return "plot";
  if (/water|runoff|overflow|pool|storage|tank|catch/.test(k)) return "water";
  if (/compost|manure|mulch|fertil|ash|shell|acid|litter|organic|lime/.test(k)) return "compost";
  if (section === "methods") return "plot";
  if (/pit|bed|container|soil_depth|sow|seed|plant|dig|hardpan|depth|spot|trial/.test(k)) return "plot";
  return "other";
}

function actionFor(r: Recommendation, section: Section, group: TaskGroup): ActionKind {
  const k = keyOf(r);
  if (group === "terraces") return "stones";
  if (group === "harvest") return "harvest";
  if (/mulch|compost/.test(k)) return "compost";
  if (group === "compost") return "compost";
  if (group === "water") return "water";
  if (/confirm|rain|spot|trial|mark|check|fizz/.test(k)) return "inspect";
  if (/sow|seed/.test(k)) return "sow";
  if (group === "plot") return "dig";
  return "inspect";
}

const STEP_OF: Record<Section, StepId> = {
  do_first: "fix_protocol",
  do_next: "fix_protocol",
  optional: "fix_protocol",
  avoid: "fix_protocol",
  methods: "planting_method",
  sowing: "planting_method",
  water_capture: "planting_method",
  dry_spell: "ongoing_care",
  regeneration: "harvest",
  gate: "next_action",
};

export function collectPlanItems(plan: PlanResponse | null): PlanItem[] {
  if (!plan) return [];
  const w = plan.workflow;
  const sections: [Section, Recommendation[] | undefined][] = [
    ["do_first", w.fix_protocol?.do_first],
    ["do_next", w.fix_protocol?.do_next],
    ["optional", w.fix_protocol?.optional],
    ["avoid", w.fix_protocol?.avoid],
    ["methods", w.planting_method?.methods],
    ["sowing", w.planting_method?.sowing],
    ["water_capture", w.planting_method?.water_capture],
    ["dry_spell", w.ongoing_care?.dry_spell_plan],
    ["regeneration", w.harvest?.regeneration],
    // v1.3: a completable task for every applicable gate (deduped by task_id against the sections above)
    ["gate", w.next_action?.gate_tasks],
  ];
  const seen = new Set<string>();
  const out: PlanItem[] = [];
  for (const [section, recs] of sections) {
    for (const rec of recs ?? []) {
      const dedup = rec.task_id ?? `${section}:${rec.id}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const group = classify(rec, section);
      out.push({ rec, section, group, action: actionFor(rec, section, group), step: STEP_OF[section] });
    }
  }
  return out;
}

export const itemsForStation = (items: PlanItem[], station: StationId) =>
  items.filter((i) => GROUP_STATION[i.group] === station);

export const taskItems = (items: PlanItem[]) => items.filter((i) => i.rec.task_id && i.section !== "avoid");

const has = (list: string[], id: string | null) => !!id && list.includes(id);

// ---------------------------------------------------------------------------------------------
// v1.4 enforced order: prepare → readiness → choose crop → plant → care → harvest.
export type TaskPhase = "prepare" | "readiness" | "plant";
export type LockReason = "choose_crop" | "pass_gate" | "choose_crop_and_pass_gate";

export const LOCK_TEXT: Record<LockReason, string> = {
  choose_crop: "Choose a crop first",
  pass_gate: "Pass the readiness gate first",
  choose_crop_and_pass_gate: "Pass the readiness gate and choose a crop first",
};

/** Task ids that some readiness gate depends on (never gated by crop/readiness). */
export function gateTaskIds(plan: PlanResponse | null): Set<string> {
  const s = new Set<string>();
  for (const g of plan?.workflow.next_action?.readiness_gate ?? []) for (const id of g.satisfied_by_tasks ?? []) s.add(id);
  return s;
}

export const isGateItem = (plan: PlanResponse | null, item: PlanItem) => !!item.rec.task_id && gateTaskIds(plan).has(item.rec.task_id);

export function taskPhase(plan: PlanResponse | null, item: PlanItem): TaskPhase {
  const id = item.rec.task_id ?? "";
  // The knowledge base's own phase wins (building a pit is `prepare` even though it also satisfies a gate).
  if (item.rec.phase) return item.rec.phase;
  // fallback when the backend/KB doesn't send `phase`
  if (gateTaskIds(plan).has(id) && !/sow|plant_tree/.test(id) && /confirm|recheck|test_/.test(id)) return "readiness";
  if (item.action === "sow" || /sow|plant_tree/.test(id)) return "plant";
  if (item.section === "gate" || /confirm|recheck|test_/.test(id)) return "readiness";
  return "prepare";
}

/** Local (always current) lock state; plant-phase tasks need a chosen crop AND a passed gate. */
export function lockOf(plan: PlanResponse | null, item: PlanItem, selectedCropId: string | null): LockReason | null {
  if (!plan || taskPhase(plan, item) !== "plant") return null;
  const needCrop = !selectedCropId;
  const needGate = plan.workflow.next_action.planting_readiness === "not_ready";
  if (needCrop && needGate) return "choose_crop_and_pass_gate";
  if (needGate) return "pass_gate";
  if (needCrop) return "choose_crop";
  return null;
}

/** Which Plot tab unlocks the task. */
export const unlockTab = (r: LockReason): "gate" | "crops" => (r === "choose_crop" ? "crops" : "gate");

// ---------------------------------------------------------------------------------------------
export type PlotStage = "unassessed" | "inspected" | "planned" | "prepared" | "crop_selected" | "planted" | "growing" | "harvest_ready";

export type WorldView = {
  stage: PlotStage;
  pits: number;
  beds: number;
  pots: number;
  prepDone: number;
  stoneLines: number;
  stoneLinesPlanned: number;
  compostDone: number;
  waterDone: number;
  sown: boolean;
  growth: number; // 0..1
  careIdx: number;
  careTotal: number;
  readiness: PlanResponse["workflow"]["next_action"]["planting_readiness"] | null;
  cropName: string | null;
  careDone: boolean;
};

export function worldView(
  analysis: AnalysisResponse | null,
  plan: PlanResponse | null,
  completed: string[],
  selectedCropId: string | null,
  farm: FarmView,
): WorldView {
  const items = collectPlanItems(plan);
  const done = (i: PlanItem) => has(completed, i.rec.task_id);
  const plotPrep = items.filter((i) => i.group === "plot" && i.action === "dig");
  const sowItems = items.filter((i) => i.group === "plot" && i.action === "sow" && i.rec.task_id);
  const prepDoneItems = plotPrep.filter(done);
  const k = (i: PlanItem) => keyOf(i.rec);
  const pits = prepDoneItems.filter((i) => /pit/.test(k(i))).length;
  const beds = prepDoneItems.filter((i) => /bed/.test(k(i))).length;
  const pots = prepDoneItems.filter((i) => /container|pot/.test(k(i))).length;
  const terr = items.filter((i) => i.group === "terraces" && i.rec.task_id);
  // "sown" requires a chosen crop AND a passed readiness gate AND the sowing task done (or the manual sow action)
  const orderOk = !!selectedCropId && !!plan && plan.workflow.next_action.planting_readiness !== "not_ready";
  const sown = orderOk && ((sowItems.length > 0 && sowItems.some(done)) || farm.sown || plan?.steps_status?.planting_method === "complete");
  const stages = plan?.workflow.ongoing_care?.stages ?? [];
  const careTotal = stages.length;
  const careIdx = Math.min(farm.careIdx, Math.max(0, careTotal - 1));
  const growth = !sown ? 0 : careTotal > 1 ? careIdx / (careTotal - 1) : 0.3;
  const crop = plan
    ? [...plan.workflow.crop_suggestions.field_crops, ...plan.workflow.crop_suggestions.tree_options].find((c) => c.crop_id === selectedCropId)
    : undefined;

  let stage: PlotStage = "unassessed";
  if (analysis) stage = "inspected";
  if (plan) stage = "planned";
  if (plan && prepDoneItems.length > 0) stage = "prepared";
  if (plan && selectedCropId) stage = "crop_selected";
  if (plan && selectedCropId && sown) stage = growth > 0 ? "growing" : "planted";
  // harvest-ready only after the LAST care stage has been completed ("Finish care")
  if (plan && selectedCropId && sown && (careTotal === 0 ? !!farm.careDone : careIdx >= careTotal - 1 && !!farm.careDone)) stage = "harvest_ready";

  return {
    stage,
    pits,
    beds,
    pots,
    prepDone: prepDoneItems.length,
    stoneLines: terr.filter(done).length,
    stoneLinesPlanned: terr.length,
    compostDone: items.filter((i) => i.group === "compost" && done(i)).length,
    waterDone: items.filter((i) => i.group === "water" && done(i)).length,
    sown,
    growth,
    careIdx,
    careTotal,
    readiness: plan?.workflow.next_action.planting_readiness ?? null,
    cropName: crop?.name ?? null,
    careDone: !!farm.careDone,
  };
}

// ---------------------------------------------------------------------------------------------
// QUEST: one linear order of work — prepare → readiness (tasks, then each gate's test) → choose crop →
// plant → care → harvest. The beacon, TERRA and the quest list all follow the single "quest task".
export type QuestKind = "task" | "test" | "crop" | "time" | "sow" | "care" | "harvest";
export type QuestPhase = "prepare" | "readiness" | "crop" | "plant" | "care" | "harvest";

export type QuestStep = {
  id: string; // task_id | "test:<gate_id>" | "crop" | "sow" | "care" | "harvest"
  kind: QuestKind;
  phase: QuestPhase;
  station: StationId;
  label: string;
  item?: PlanItem;
  gateId?: string;
  done: boolean;
  /** not doable yet (locked, or waiting on something) — never shown as doable */
  blocked: boolean;
  lock: LockReason | null;
  blockedText: string | null;
  optional: boolean;
};

export type QuestCtx = {
  analysis: AnalysisResponse | null;
  plan: PlanResponse | null;
  completed: string[];
  crop: string | null;
  farm: FarmView;
  gateResults?: Record<string, "pass" | "fail">;
};

const PHASE_RANK: Record<TaskPhase, number> = { prepare: 0, readiness: 1, plant: 2 };

export function buildQuest(ctx: QuestCtx): QuestStep[] {
  const { analysis, plan, completed, crop, farm } = ctx;
  if (!plan) return [];
  const items = collectPlanItems(plan);
  const gates = plan.workflow.next_action.readiness_gate ?? [];
  const view = worldView(analysis, plan, completed, crop, farm);
  const isDone = (id: string | null | undefined) => !!id && completed.includes(id);
  const gatesOf = (id: string) => gates.filter((g) => g.satisfied_by_tasks?.includes(id));
  const readyOk = plan.workflow.next_action.planting_readiness !== "not_ready";

  const all = items.filter((i) => i.rec.task_id && i.section !== "avoid" && !/plant_tree/.test(i.rec.task_id!));
  const isOptional = (i: PlanItem) => i.section === "optional" || i.rec.priority === "optional";
  // alternatives (pits OR beds OR containers …): once one satisfies a gate, the rest are redundant
  const redundant = (i: PlanItem) => {
    const id = i.rec.task_id!;
    if (isDone(id)) return false;
    const gs = gatesOf(id);
    return gs.length > 0 && gs.every((g) => g.satisfied_by_tasks.some((o) => o !== id && isDone(o)));
  };
  const mk = (i: PlanItem): QuestStep => {
    const lock = lockOf(plan, i, crop);
    const ph = taskPhase(plan, i);
    return {
      id: i.rec.task_id!,
      kind: "task",
      phase: ph,
      station: GROUP_STATION[i.group],
      label: i.rec.task_label ?? i.rec.title,
      item: i,
      done: isDone(i.rec.task_id),
      blocked: !!lock,
      lock,
      blockedText: lock ? LOCK_TEXT[lock] : null,
      optional: isOptional(i),
    };
  };
  const required = all.filter((i) => !isOptional(i) && !redundant(i));
  const early = required
    .filter((i) => taskPhase(plan, i) !== "plant")
    .sort((a, b) => PHASE_RANK[taskPhase(plan, a)] - PHASE_RANK[taskPhase(plan, b)]);
  const steps: QuestStep[] = early.map(mk);

  // each required gate's verification test comes right after its (last listed) task
  for (const g of gates) {
    if (!g.required || !g.verification?.test) continue;
    const taskDone = g.task_done ?? g.satisfied_by_tasks.some((id) => isDone(id));
    const done = !!g.satisfied || !!g.accepted_risk || (ctx.gateResults?.[g.id] ?? g.test_result) === "pass";
    let at = -1;
    steps.forEach((s, i) => {
      if (s.kind === "task" && g.satisfied_by_tasks.includes(s.id)) at = i;
    });
    const step: QuestStep = {
      id: `test:${g.id}`,
      kind: "test",
      phase: "readiness",
      station: "plot",
      label: `Run the test: ${g.label}`,
      gateId: g.id,
      done,
      blocked: !taskDone,
      lock: null,
      blockedText: taskDone ? null : "Finish this gate's task first",
      optional: false,
    };
    steps.splice(at < 0 ? steps.length : at + 1, 0, step);
  }

  steps.push({
    id: "crop",
    kind: "crop",
    phase: "crop",
    station: "plot",
    label: "Choose a crop for the plot",
    done: !!crop,
    blocked: !readyOk,
    lock: readyOk ? null : "pass_gate",
    blockedText: readyOk ? null : LOCK_TEXT.pass_gate,
    optional: false,
  });

  steps.push({
    id: "time",
    kind: "time",
    phase: "crop",
    station: "plot",
    label: `Check the timeframe${view.cropName ? ` for ${view.cropName}` : ""}`,
    done: view.sown || !!farm.timeSeen,
    blocked: !crop,
    lock: null,
    blockedText: crop ? null : LOCK_TEXT.choose_crop,
    optional: false,
  });

  const plantTasks = required.filter((i) => taskPhase(plan, i) === "plant");
  plantTasks.forEach((i) => steps.push(mk(i)));
  if (!plantTasks.some((i) => i.action === "sow" || /sow_seeds/.test(i.rec.task_id!))) {
    steps.push({
      id: "sow",
      kind: "sow",
      phase: "plant",
      station: "plot",
      label: view.cropName ? `Sow ${view.cropName}` : "Sow the chosen crop",
      done: view.sown,
      blocked: !crop || !readyOk,
      lock: !crop && !readyOk ? "choose_crop_and_pass_gate" : !crop ? "choose_crop" : !readyOk ? "pass_gate" : null,
      blockedText: !crop ? LOCK_TEXT.choose_crop : !readyOk ? LOCK_TEXT.pass_gate : null,
      optional: false,
    });
  }
  const careDone = view.stage === "harvest_ready" || !!farm.harvested;
  steps.push({
    id: "care",
    kind: "care",
    phase: "care",
    station: "plot",
    label: "Tend the crop through its care stages",
    done: careDone,
    blocked: !view.sown,
    lock: null,
    blockedText: view.sown ? null : "Sow the crop first",
    optional: false,
  });
  steps.push({
    id: "harvest",
    kind: "harvest",
    phase: "harvest",
    station: "harvest",
    label: "Harvest the crop",
    done: !!farm.harvested,
    blocked: view.stage !== "harvest_ready" && !farm.harvested,
    lock: null,
    blockedText: view.stage === "harvest_ready" || farm.harvested ? null : "Finish the care stages first",
    optional: false,
  });
  // optional tasks are doable at their stations but never forced by the quest
  all.filter((i) => isOptional(i) && !isDone(i.rec.task_id)).forEach((i) => steps.push(mk(i)));
  return steps;
}

/** The single quest task: the pinned step if still doable, else the first open, unblocked, required step. */
export function questTask(steps: QuestStep[], pinnedId: string | null): QuestStep | null {
  if (pinnedId) {
    const p = steps.find((s) => s.id === pinnedId);
    if (p && !p.done && !p.blocked) return p;
  }
  return steps.find((s) => !s.done && !s.blocked && !s.optional) ?? null;
}

export const QUEST_STEP_ID: Record<QuestKind, StepId> = {
  task: "fix_protocol",
  test: "next_action",
  crop: "crop_suggestions",
  time: "timeframe",
  sow: "planting_method",
  care: "ongoing_care",
  harvest: "harvest",
};

// ---------------------------------------------------------------------------------------------
export type Guidance = {
  target: StationId | null;
  step: StepId;
  /** Lines TERRA speaks. Generic navigation text, or text taken verbatim from the API. */
  lines: string[];
  evidence: Evidence | null;
  fromKb: boolean;
  /** the single current quest task (only once a plan exists) */
  quest?: QuestStep | null;
};

export function guidance(args: {
  backendOnline: boolean | null;
  analysis: AnalysisResponse | null;
  plan: PlanResponse | null;
  completed: string[];
  selectedCropId: string | null;
  farm: FarmView;
  pinnedId?: string | null;
  gateResults?: Record<string, "pass" | "fail">;
}): Guidance {
  const { backendOnline, analysis, plan, completed, selectedCropId, farm } = args;
  if (!analysis) {
    return {
      target: "board",
      step: "observation_log",
      lines: [
        backendOnline === false
          ? "My knowledge-base link is offline, so I can't advise yet. You can still log what you see at the Observation Board."
          : "Head to the Observation Board and log what you see. I can only answer from my knowledge base.",
      ],
      evidence: null,
      fromKb: false,
    };
  }
  if (!plan) {
    const ma = analysis.missing_analysis;
    return {
      target: "soil",
      step: "missing_analysis",
      lines: [
        ma.archetype.statement,
        `${ma.unknowns.length} unknown${ma.unknowns.length === 1 ? "" : "s"} · ${ma.checks.length} check${ma.checks.length === 1 ? "" : "s"} suggested. Meet me at the Soil Inspection Patch.`,
      ].filter(Boolean),
      evidence: ma.archetype.evidence,
      fromKb: true,
    };
  }
  const na = plan.workflow.next_action;
  const items = taskItems(collectPlanItems(plan));
  const open = items.filter((i) => !has(completed, i.rec.task_id));
  const view = worldView(analysis, plan, completed, selectedCropId, farm);
  const lines = [na.next_best_action].filter(Boolean);
  let target: StationId = "plot";
  let step: StepId = "next_action";
  let evidence: Evidence | null = na.evidence;

  // the beacon follows the QUEST TASK only (pinned, else first open unlocked in workflow order)
  void open;
  const quest = questTask(buildQuest({ analysis, plan, completed, crop: selectedCropId, farm, gateResults: args.gateResults }), args.pinnedId ?? null);
  if (quest) {
    target = quest.station;
    step = QUEST_STEP_ID[quest.kind];
    if (quest.item) evidence = quest.item.rec.evidence;
  } else if (na.planting_readiness === "not_ready") {
    target = "plot";
    step = "next_action";
  }
  if (view.cropName) lines.push(`Selected crop: ${view.cropName}.`);
  return { target, step, lines, evidence, fromKb: true, quest };
}

// ---------------------------------------------------------------------------------------------
export function stepStatuses(analysis: AnalysisResponse | null, plan: PlanResponse | null): Record<string, StepStatus> {
  const out: Record<string, StepStatus> = {};
  for (const s of WORKFLOW_STEPS) out[s.id] = "needs_input";
  if (analysis) {
    out.observation_log = analysis.steps.observation_log?.status ?? "complete";
    out.input_echo = analysis.steps.input_echo?.status ?? "complete";
    out.missing_analysis = analysis.steps.missing_analysis?.status ?? "ready";
  }
  if (plan?.steps_status) Object.assign(out, plan.steps_status);
  return out;
}

export function progressCount(analysis: AnalysisResponse | null, plan: PlanResponse | null) {
  const st = stepStatuses(analysis, plan);
  return WORKFLOW_STEPS.filter((s) => st[s.id] === "complete").length;
}

export const allEvidenceIds = (e: Evidence | null | undefined) => [...(e?.kb_ids ?? []), ...(e?.source_ids ?? [])];
