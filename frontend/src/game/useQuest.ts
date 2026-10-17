// Reactive access to the linear quest (ordered steps + the single quest task) for HUD and panels.
import { useEffect, useMemo } from "react";
import { useTerraform } from "../store/terraformStore";
import { farmFor, useGame } from "./gameStore";
import { auditQuest, buildQuest, questTask, type QuestStep } from "./planData";

export function useQuest() {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const crop = useTerraform((s) => s.selectedCropId);
  const sessionId = useTerraform((s) => s.sessionId);
  const gateResults = useTerraform((s) => s.gateResults);
  const checkOutcomes = useTerraform((s) => s.checkOutcomes);
  const unableChecks = useTerraform((s) => s.unableChecks);
  const skipped = useTerraform((s) => s.skippedSteps);
  const farmRaw = useGame((s) => s.farm);
  const pinnedId = useGame((s) => s.pinnedId);
  const steps = useMemo(
    () => buildQuest({ analysis, plan, completed, crop, farm: farmFor(farmRaw, sessionId), gateResults, checkOutcomes, unableChecks, skipped }),
    [analysis, plan, completed, crop, farmRaw, sessionId, gateResults, checkOutcomes, unableChecks, skipped],
  );
  // dev safety net: every plan task and every piece of plan advice must be a quest step
  useEffect(() => {
    if (!import.meta.env.DEV || !plan) return;
    const missing = auditQuest(plan, steps);
    if (missing.length) console.error("[quest audit] plan items without a quest step:", missing);
  }, [plan, steps]);
  const quest: QuestStep | null = useMemo(() => questTask(steps, pinnedId), [steps, pinnedId]);
  return { steps, quest, plan, analysis, sessionId, crop, completed, skipped, farm: farmFor(farmRaw, sessionId), pinnedId };
}

/** Non-hook snapshot (for event handlers). */
export function questSnapshot() {
  const t = useTerraform.getState();
  const g = useGame.getState();
  const steps = buildQuest({
    analysis: t.analysis,
    plan: t.plan,
    completed: t.completedTasks,
    crop: t.selectedCropId,
    farm: farmFor(g.farm, t.sessionId),
    gateResults: t.gateResults,
    checkOutcomes: t.checkOutcomes,
    unableChecks: t.unableChecks,
    skipped: t.skippedSteps,
  });
  return { steps, quest: questTask(steps, g.pinnedId) };
}
