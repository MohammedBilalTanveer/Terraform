// Pure workflow rules shared by the store and the UI (no store import → no cycles).
// v1.4 order of work: prepare → readiness (gate tasks + tests) → choose crop → plant (sow) → care → harvest.
// The backend is the authority (409 TASK_LOCKED); these helpers only mirror it so the UI never offers a
// "complete" control for a locked task, and keep working when the optional v1.4 fields are absent.
import type { PlanResponse, Recommendation, StepId } from "../types/terraform";

/** Tasks that count as "the crop has been sown / planted". */
export const SOW_TASK_IDS = ["task_sow_seeds", "task_plant_tree_seedlings"] as const;
/** Fallback when the API omits `phase`: these task ids are plant-phase. */
const PLANT_FALLBACK = new Set<string>([...SOW_TASK_IDS, "task_mulch_after_sowing"]);

export type LockReason = "choose_crop" | "pass_gate" | "choose_crop_and_pass_gate";

export const LOCK_MESSAGE: Record<LockReason, string> = {
  choose_crop: "Choose a crop first",
  pass_gate: "Pass the readiness gate first",
  choose_crop_and_pass_gate: "Choose a crop and pass the readiness gate first",
};

/** Every Recommendation in the plan that carries a completable task (first occurrence wins). */
export function planTaskRecs(plan: PlanResponse | null): Recommendation[] {
  if (!plan?.workflow) return [];
  const fp = plan.workflow.fix_protocol;
  const pm = plan.workflow.planting_method;
  const all: Recommendation[] = [
    ...(fp?.do_first ?? []),
    ...(fp?.do_next ?? []),
    ...(fp?.optional ?? []),
    ...(pm?.methods ?? []),
    ...(pm?.sowing ?? []),
    ...(pm?.water_capture ?? []),
    ...(pm?.irrigation ?? []),
    ...(plan.workflow.next_action?.gate_tasks ?? []),
  ];
  const seen = new Set<string>();
  return all.filter((r) => r.task_id && !seen.has(r.task_id) && seen.add(r.task_id));
}

export function taskPhase(rec: Pick<Recommendation, "id" | "task_id" | "phase">, plan: PlanResponse | null): "prepare" | "readiness" | "plant" | null {
  if (rec.phase) return rec.phase;
  if (rec.task_id && PLANT_FALLBACK.has(rec.task_id)) return "plant";
  if (plan?.workflow?.planting_method?.sowing?.some((r) => r.id === rec.id)) return "plant";
  return null;
}

export const readinessOk = (plan: PlanResponse | null) =>
  !!plan && plan.workflow?.next_action?.planting_readiness !== "not_ready";

export function plantUnlock(plan: PlanResponse | null, selectedCropId: string | null): { unlocked: boolean; reason: LockReason | null } {
  const crop = !!selectedCropId;
  const gate = readinessOk(plan);
  if (crop && gate) return { unlocked: true, reason: null };
  return { unlocked: false, reason: !crop && !gate ? "choose_crop_and_pass_gate" : !crop ? "choose_crop" : "pass_gate" };
}

export type TaskLock = { locked: boolean; reason: LockReason | null; message: string | null };
const OPEN: TaskLock = { locked: false, reason: null, message: null };

/** Lock state of one task-bearing recommendation, computed from LIVE state so it never goes stale. */
export function recLock(rec: Recommendation, plan: PlanResponse | null, selectedCropId: string | null): TaskLock {
  if (!rec.task_id) return OPEN;
  if (taskPhase(rec, plan) === "plant") {
    const u = plantUnlock(plan, selectedCropId);
    return u.unlocked ? OPEN : { locked: true, reason: u.reason, message: LOCK_MESSAGE[u.reason!] };
  }
  if (rec.locked) {
    const reason = rec.locked_reason ?? "choose_crop_and_pass_gate";
    return { locked: true, reason, message: LOCK_MESSAGE[reason] };
  }
  return OPEN;
}

/** Same, looked up by task id (used by the store before it calls the API). */
export function taskLockFor(taskId: string, plan: PlanResponse | null, selectedCropId: string | null): TaskLock {
  const rec = planTaskRecs(plan).find((r) => r.task_id === taskId);
  if (rec) return recLock(rec, plan, selectedCropId);
  if (PLANT_FALLBACK.has(taskId)) {
    const u = plantUnlock(plan, selectedCropId);
    return u.unlocked ? OPEN : { locked: true, reason: u.reason, message: LOCK_MESSAGE[u.reason!] };
  }
  return OPEN;
}

export type Prereq = { key: "crop" | "gate" | "sow"; label: string; step: StepId; cta: string };

/** What is still missing before the harvest can be recorded. */
export function harvestRequirements(plan: PlanResponse | null, selectedCropId: string | null, completedTasks: string[]) {
  const cropChosen = !!selectedCropId;
  const gateOk = readinessOk(plan);
  const sown = SOW_TASK_IDS.some((t) => completedTasks.includes(t));
  const missing: Prereq[] = [];
  if (!cropChosen) missing.push({ key: "crop", label: "Choose a crop", step: "crop_suggestions", cta: "Choose a crop" });
  if (!gateOk) missing.push({ key: "gate", label: "Pass the readiness gate", step: "next_action", cta: "Open the readiness gate" });
  if (!sown) missing.push({ key: "sow", label: "Sow or plant (the sowing task)", step: "planting_method", cta: "Open planting" });
  return { cropChosen, gateOk, sown, missing, ok: missing.length === 0 };
}

/** Prerequisites that lock a step page (Planting / Care / Harvest) — empty for every other step. */
export function stepPrereqs(step: StepId, plan: PlanResponse | null, selectedCropId: string | null): Prereq[] {
  if (step !== "planting_method" && step !== "ongoing_care" && step !== "harvest") return [];
  const out: Prereq[] = [];
  if (!selectedCropId) out.push({ key: "crop", label: "Choose a crop", step: "crop_suggestions", cta: "Choose a crop" });
  if (!readinessOk(plan)) out.push({ key: "gate", label: "Pass the readiness gate", step: "next_action", cta: "Open the readiness gate" });
  return out;
}
