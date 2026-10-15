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
  const sown = (sowItems.length > 0 && sowItems.some(done)) || farm.sown || plan?.steps_status?.planting_method === "complete";
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
  if (plan && selectedCropId && sown && careTotal > 0 && careIdx >= careTotal - 1) stage = "harvest_ready";

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
  };
}

// ---------------------------------------------------------------------------------------------
export type Guidance = {
  target: StationId | null;
  step: StepId;
  /** Lines TERRA speaks. Generic navigation text, or text taken verbatim from the API. */
  lines: string[];
  evidence: Evidence | null;
  fromKb: boolean;
};

export function guidance(args: {
  backendOnline: boolean | null;
  analysis: AnalysisResponse | null;
  plan: PlanResponse | null;
  completed: string[];
  selectedCropId: string | null;
  farm: FarmView;
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

  const firstDoFirst = open.find((i) => i.section === "do_first");
  const gateBlock = na.readiness_gate.find((g) => g.required && !g.satisfied && !g.accepted_risk);
  const gateItem = gateBlock ? open.find((i) => gateBlock.satisfied_by_tasks.includes(i.rec.task_id ?? "")) : undefined;

  if (firstDoFirst) {
    target = GROUP_STATION[firstDoFirst.group];
    step = firstDoFirst.step;
    evidence = firstDoFirst.rec.evidence;
  } else if (na.planting_readiness === "not_ready" && gateItem) {
    target = GROUP_STATION[gateItem.group];
    step = "next_action";
  } else if (!selectedCropId) {
    target = "plot";
    step = "crop_suggestions";
  } else if (!view.sown) {
    target = "plot";
    step = "planting_method";
  } else if (view.stage !== "harvest_ready") {
    target = "plot";
    step = "ongoing_care";
  } else {
    target = "harvest";
    step = "harvest";
  }
  if (view.cropName) lines.push(`Selected crop: ${view.cropName}.`);
  return { target, step, lines, evidence, fromKb: true };
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
