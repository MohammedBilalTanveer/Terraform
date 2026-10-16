// Lock notice for plant-phase tasks (v1.4 order: prepare → readiness → choose crop → plant → care → harvest).
// Never offers a "complete" button; shows the reason and a button to whatever unlocks it.
import { Lock } from "lucide-react";
import { useGame } from "../gameStore";
import { LOCK_TEXT, unlockTab, type LockReason } from "../planData";
import type { StationId } from "../worldConfig";
import { GhostButton } from "./kit";

export function goUnlock(reason: LockReason, here?: StationId | null) {
  const g = useGame.getState();
  g.setForceTab(unlockTab(reason));
  g.setFocusTask(null);
  if (here !== "plot") {
    g.setTargetOverride("plot");
    g.say(`${LOCK_TEXT[reason]} — head to the Unknown Land plot.`);
    g.setOverlay(null);
  }
}

export function LockedNotice({ reason, here }: { reason: LockReason; here?: StationId | null }) {
  const tab = unlockTab(reason);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/[0.06] px-2.5 py-1.5" role="note">
      <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
      <span className="flex-1 text-[12px] text-amber-100">{LOCK_TEXT[reason]}</span>
      <GhostButton onClick={() => goUnlock(reason, here)}>{tab === "crops" ? "Go to Crops" : "Go to Readiness"}</GhostButton>
    </div>
  );
}
