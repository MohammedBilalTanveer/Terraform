// Derived, read-only views over the store's API responses (no content authored here).
import { RUBRIC_STAGE, WORKFLOW_STEPS } from "../types/terraform";
import type {
  AnalysisResponse,
  Evidence,
  GenerationMode,
  PlanResponse,
  Recommendation,
  StepId,
  StepMeta,
  StepStatus,
} from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { harvestRequirements, planTaskRecs, recLock, stepPrereqs } from "../store/workflowRules";

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
