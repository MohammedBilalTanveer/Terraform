// Compost & Mulch / Water Storage / Stone-Line Terraces as a guided, one-card-at-a-time flow.
import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { useGame } from "../gameStore";
import { stationById, type StationId } from "../worldConfig";
import { useQuest } from "../useQuest";
import { Card, DetailsButton, GlassPanel, PrimaryButton } from "./kit";
import { CompletionFlow, StationChecklist, SuggestedNext, TaskCard, pinStep } from "./cards";

const KICKER: Partial<Record<StationId, string>> = {
  terraces: "WATER CAPTURE · STONE LINES",
  compost: "SOIL BUILDING · COMPOST & MULCH",
  water: "WATER STORAGE · DRY SPELLS",
};

export default function StationCards({ station, onClose }: { station: StationId; onClose: () => void }) {
  const { steps, quest, plan } = useQuest();
  const lastDone = useGame((s) => s.lastDone);
  const [viewId, setViewId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const st = stationById(station);
  const here = useMemo(() => steps.filter((s) => s.station === station && s.kind === "task"), [steps, station]);
  const required = here.filter((s) => !s.optional);
  const doable = here.filter((s) => !s.done && !s.blocked);
  const pinnedHere = useGame((s) => s.pinnedId);

  // arriving via the quest/pin opens that exact card
  useEffect(() => {
    if (pinnedHere && here.some((s) => s.id === pinnedHere && !s.done && !s.blocked)) setViewId(pinnedHere);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lastDone && lastDone.station === station) {
    return <CompletionFlow station={station} onStay={() => setListOpen(true)} />;
  }

  if (!plan) {
    return (
      <GlassPanel title={st.name} kicker={KICKER[station] ?? "STATION"} onClose={onClose}>
        <Card>
          <p className="text-[13px] text-ivory/85">No plan has been generated yet, so this station has no tasks. TERRA only shows tasks from your knowledge-base plan.</p>
        </Card>
      </GlassPanel>
    );
  }

  const current = (viewId ? doable.find((s) => s.id === viewId) : null) ?? doable.find((s) => quest && s.id === quest.id) ?? doable[0] ?? null;
  const doneCount = required.filter((s) => s.done).length;
  const idx = current ? Math.max(1, required.filter((s) => s.done).length + (current.optional ? 0 : 1)) : required.length;
  const overall = steps.filter((s) => s.kind === "task" && !s.optional);
  const overallDone = overall.filter((s) => s.done).length;

  return (
    <GlassPanel
      title={st.name}
      kicker={current ? `TERRA · TASK ${Math.min(idx, Math.max(required.length, 1))} OF ${Math.max(required.length, 1)} HERE` : "TERRA · ALL DONE HERE"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <DetailsButton step={current?.item?.step ?? "fix_protocol"} />
          <span className="text-[11px] text-ivory/55">
            Overall {overallDone}/{overall.length} tasks · KB-only
          </span>
        </div>
      }
    >
      {current ? (
        <>
          <TaskCard step={current} station={station} />
          <SuggestedNext current={current} here={station} />
        </>
      ) : (
        <Card className="space-y-3">
          <div className="font-heading text-[16px] font-semibold">All done here</div>
          <p className="text-[13px] text-ivory/80">
            {required.length > 0 ? `You finished ${doneCount} of ${required.length} tasks at this station.` : "No plan tasks are done at this station."}
            {here.some((s) => !s.done && s.blocked) && " Anything still locked will open once its step is done."}
          </p>
          {quest ? (
            <PrimaryButton
              onClick={() => {
                pinStep(quest);
                useGame.getState().setOverlay(null);
              }}
            >
              <MapIcon className="h-4 w-4" /> Now go to {stationById(quest.station).name} — {quest.label}
            </PrimaryButton>
          ) : (
            <p className="text-[13px] text-cyan-100/85">Nothing else is waiting. Check the Research Outpost terminal for the full plan.</p>
          )}
        </Card>
      )}
      <StationChecklist key={String(listOpen)} defaultOpen={listOpen} title="See all tasks here" steps={here} currentId={current?.id} onPick={(id) => setViewId(id)} />
    </GlassPanel>
  );
}
