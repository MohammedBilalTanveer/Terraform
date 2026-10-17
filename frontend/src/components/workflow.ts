// Derived, read-only views over the store's API responses (no content authored here).
import { tasksAreSubstitutes } from "../store/gateRules";
import { RUBRIC_STAGE, WORKFLOW_STEPS } from "../types/terraform";
import type {
  AnalysisResponse,
  CheckCard,
  Evidence,
  GenerationMode,
  PlanResponse,
  Recommendation,
  StepId,
  StepMeta,
  StepStatus,
} from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { harvestRequirements, planTaskRecs, recLock, stepPrereqs, taskPhase } from "../store/workflowRules";

export { planTaskRecs, recLock, taskPhase, harvestRequirements, stepPrereqs, SOW_TASK_IDS, LOCK_MESSAGE } from "../store/workflowRules";
export type { TaskLock, Prereq, LockReason } from "../store/workflowRules";

export const STEP_IDS = WORKFLOW_STEPS.map((s) => s.id) as StepId[];
export const stepIndex = (id: StepId) => STEP_IDS.indexOf(id);
export const stepInfo = (id: StepId) => WORKFLOW_STEPS.find((s) => s.id === id)!;

const ANALYSIS_STEPS = ["observation_log", "input_echo", "missing_analysis"] as const;
const isAnalysisStep = (id: StepId): id is (typeof ANALYSIS_STEPS)[number] =>
  (ANALYSIS_STEPS as readonly string[]).includes(id);

/** StepMeta for a step, taken verbatim from the latest analysis/plan response. */
export function getStepMeta(id: StepId, analysis: AnalysisResponse | null, plan: PlanResponse | null): StepMeta | null {
  if (isAnalysisStep(id)) return analysis?.steps?.[id] ?? null;
  const wf = plan?.workflow as Record<string, StepMeta | undefined> | undefined;
  return wf?.[id] ?? null;
}

export function computeStepStatuses(
  analysis: AnalysisResponse | null,
  plan: PlanResponse | null,
  hasObservation: boolean,
): Record<StepId, StepStatus> {
  const out = {} as Record<StepId, StepStatus>;
  for (const id of STEP_IDS) {
    const fromPlan = plan?.steps_status?.[id] as StepStatus | undefined;
    const fromMeta = getStepMeta(id, analysis, plan)?.status;
    let s: StepStatus = fromPlan ?? fromMeta ?? "needs_input";
    if (!fromPlan && !fromMeta && id === "observation_log" && hasObservation) s = "in_progress";
    out[id] = s;
  }
  return out;
}

export function useStepStatuses() {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const observation = useTerraform((s) => s.observation);
  return computeStepStatuses(analysis, plan, !!observation?.description);
}

export function useGenerationMode(): { mode: GenerationMode | null; source: "plan" | "analysis" | "default" | null } {
  const plan = useTerraform((s) => s.plan);
  const analysis = useTerraform((s) => s.analysis);
  const health = useTerraform((s) => s.health);
  if (plan?.meta?.generation_mode) return { mode: plan.meta.generation_mode, source: "plan" };
  if (analysis?.meta?.generation_mode) return { mode: analysis.meta.generation_mode, source: "analysis" };
  if (health?.generation_mode_default) return { mode: health.generation_mode_default, source: "default" };
  return { mode: null, source: null };
}

/** task_id → label as given by the API. */
export function taskLabelMap(plan: PlanResponse | null): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of planTaskRecs(plan)) if (r.task_id) m[r.task_id] = r.task_label ?? r.title;
  return m;
}

/** Walk any API object and collect every evidence id it references (Evidence ledger). */
export function collectEvidence(obj: unknown): Evidence {
  const kb = new Set<string>();
  const src = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (!v || depth > 12) return;
    if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.kb_ids)) o.kb_ids.forEach((id) => typeof id === "string" && kb.add(id));
    if (Array.isArray(o.source_ids)) o.source_ids.forEach((id) => typeof id === "string" && src.add(id));
    for (const k of Object.keys(o)) if (k !== "kb_ids" && k !== "source_ids") walk(o[k], depth + 1);
  };
  walk(obj, 0);
  return { kb_ids: [...kb].sort(), source_ids: [...src].sort() };
}

export const emptyEvidence: Evidence = { kb_ids: [], source_ids: [] };

/** Official evaluation-rubric stage label for a workflow step ("Intake" for the observation log). */
export function rubricStage(id: StepId): { short: string; full: string } {
  const r = RUBRIC_STAGE[id];
  if (!r) return { short: "Intake", full: "Intake" };
  return { short: `Protocol ${r.n}`, full: `Protocol ${r.n} · ${r.name}` };
}

/** Live lock state of a task-bearing recommendation (re-computed when crop / gate / plan change). */
export function useTaskLock(rec: Recommendation) {
  const plan = useTerraform((s) => s.plan);
  const crop = useTerraform((s) => s.selectedCropId);
  return recLock(rec, plan, crop);
}

export function useHarvestRequirements() {
  const plan = useTerraform((s) => s.plan);
  const crop = useTerraform((s) => s.selectedCropId);
  const done = useTerraform((s) => s.completedTasks);
  return harvestRequirements(plan, crop, done);
}

/** Every applicable diagnostic check: plan.workflow.checks (all phases) when present, else the analysis' checks. */
export function useAllChecks(): CheckCard[] {
  const plan = useTerraform((s) => s.plan);
  const analysis = useTerraform((s) => s.analysis);
  const fromPlan = plan?.workflow?.checks;
  if (fromPlan && fromPlan.length) return fromPlan;
  return analysis?.missing_analysis?.checks ?? [];
}
/** Checks of one phase; a check without a phase counts as "diagnose" (before the plan). */
export const checksOfPhase = (cs: CheckCard[], phase: "diagnose" | "pre_plant" | "post_sow") =>
  cs.filter((c) => (c.phase ?? "diagnose") === phase);

export function useStepPrereqs(step: StepId) {
  const plan = useTerraform((s) => s.plan);
  const crop = useTerraform((s) => s.selectedCropId);
  return stepPrereqs(step, plan, crop);
}

/** Jump to a workflow step from anywhere (works from the 3D Explorer too). */
export function goToStep(step: StepId) {
  const t = useTerraform.getState();
  if (t.mode !== "dashboard") t.setMode("dashboard");
  t.setCurrentStep(step);
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
}

// ───────── v1.6: every plan item is a visible row; optional ones can be skipped (UI-only, never completes a task) ─────────
export type SkipKind = "optional" | "alternative" | "good_to_know";
/** Key under which a recommendation is remembered as skipped (task id, or the record id for items without a task). */
export const skipKey = (r: Pick<Recommendation, "id" | "task_id">) => r.task_id ?? r.id;

/** Task ids rendered as checkbox rows on the readiness-gate page (Step 5). */
export function gateTaskIdSet(plan: PlanResponse | null): Set<string> {
  const ids = new Set<string>();
  for (const g of plan?.workflow?.next_action?.readiness_gate ?? []) for (const t of g.satisfied_by_tasks ?? []) ids.add(t);
  return ids;
}

const plantingAll = (plan: PlanResponse | null) => {
  const pm = plan?.workflow?.planting_method;
  return { methods: pm?.methods ?? [], water: pm?.water_capture ?? [], sowing: pm?.sowing ?? [], irrigation: pm?.irrigation ?? [] };
};

/** Rows shown on Step 4 (prepare work). A readiness/plant task is only moved off this page when it is rendered elsewhere. */
export function fixProtocolRows(plan: PlanResponse | null) {
  const fp = plan?.workflow?.fix_protocol;
  const gate = gateTaskIdSet(plan);
  const pl = plantingAll(plan);
  const planting = new Set([...pl.methods, ...pl.water, ...pl.sowing, ...pl.irrigation].map((r) => r.task_id).filter(Boolean) as string[]);
  const keep = (r: Recommendation) => {
    const ph = taskPhase(r, plan);
    if (r.task_id && ph === "readiness" && gate.has(r.task_id)) return false;
    if (r.task_id && ph === "plant" && planting.has(r.task_id)) return false;
    return true;
  };
  return {
    doFirst: (fp?.do_first ?? []).filter(keep),
    doNext: (fp?.do_next ?? []).filter(keep),
    optional: (fp?.optional ?? []).filter(keep),
  };
}

/** Rows shown on Step 8 (planting): everything except readiness tasks that live on the gate page. */
export function plantingRows(plan: PlanResponse | null) {
  const gate = gateTaskIdSet(plan);
  const keep = (r: Recommendation) => !(r.task_id && taskPhase(r, plan) === "readiness" && gate.has(r.task_id));
  const pl = plantingAll(plan);
  return { methods: pl.methods.filter(keep), water: pl.water.filter(keep), sowing: pl.sowing.filter(keep), irrigation: pl.irrigation.filter(keep) };
}

/** What kind of Skip (if any) a recommendation row offers right now. Tasks that are done are never skippable. */
export function skipKind(rec: Recommendation, plan: PlanResponse | null, completed: string[]): SkipKind | null {
  if (!rec.task_id) return "good_to_know";
  if (completed.includes(rec.task_id)) return null;
  if (rec.priority === "optional") return "optional";
  // Alternatives: when another option of the same gate item is already done, this one becomes skippable.
  for (const g of plan?.workflow?.next_action?.readiness_gate ?? []) {
    const opts = g.satisfied_by_tasks ?? [];
    if (tasksAreSubstitutes(g) && opts.includes(rec.task_id) && opts.some((t) => t !== rec.task_id && completed.includes(t))) return "alternative";
  }
  return null;
}

/**
 * Dev safety net: every task and every non-task plan item (except "avoid") must be rendered somewhere on Steps 4/5/8.
 * Returns the ids that are NOT shown (should always be []). Logged by DashboardPage in dev.
 */
export function auditDashboardTasks(plan: PlanResponse | null): string[] {
  if (!plan?.workflow) return [];
  const fp = plan.workflow.fix_protocol;
  const pl = plantingAll(plan);
  const candidates = new Set<string>();
  for (const r of [...(fp?.do_first ?? []), ...(fp?.do_next ?? []), ...(fp?.optional ?? []), ...pl.methods, ...pl.water, ...pl.sowing, ...pl.irrigation]) candidates.add(skipKey(r));
  for (const r of planTaskRecs(plan)) candidates.add(skipKey(r));
  const rendered = new Set<string>(gateTaskIdSet(plan));
  const f = fixProtocolRows(plan);
  const p = plantingRows(plan);
  for (const r of [...f.doFirst, ...f.doNext, ...f.optional, ...p.methods, ...p.water, ...p.sowing, ...p.irrigation]) rendered.add(skipKey(r));
  return [...candidates].filter((id) => !rendered.has(id)).sort();
}
