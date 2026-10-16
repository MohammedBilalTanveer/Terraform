// Pinning a quest step: the beacon follows it and stays until it is done.
import { useGame } from "../gameStore";
import { unlockTab, type QuestStep } from "../planData";
import { questSnapshot } from "../useQuest";
import { stationById } from "../worldConfig";

export function pinStep(step: QuestStep, announce = true) {
  const g = useGame.getState();
  g.setPinned(step.id);
  g.setFocusTask(step.item?.rec.task_id ?? null);
  if (announce) g.say(`Head to ${stationById(step.station).name} — ${step.label}`);
}

/** Pin a quest step by id. Locked/blocked steps pin what unlocks them (the crop step or the current quest task). */
export function pinQuestStep(id: string, openIfHere = true) {
  const game = useGame.getState();
  const { steps, quest } = questSnapshot();
  const st = steps.find((s) => s.id === id);
  if (!st) return;
  let target: QuestStep | null = st;
  if (st.done) target = quest;
  else if (st.blocked) target = st.lock === "choose_crop" ? steps.find((s) => s.id === "crop") ?? quest : quest;
  if (!target) return;
  if (st.blocked && st.lock) game.setForceTab(unlockTab(st.lock));
  pinStep(target);
  if (openIfHere && (game.area === target.station || game.nearStation === target.station) && !game.action) game.setOverlay(target.station);
  else if (!openIfHere) game.setOverlay(null);
}
