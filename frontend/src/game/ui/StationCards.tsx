// Compost & Mulch / Water Storage / Stone-Line Terraces as a guided, one-card-at-a-time flow.
import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { useGame } from "../gameStore";
import { stationById, type StationId } from "../worldConfig";
import { useQuest } from "../useQuest";
import { Card, DetailsButton, GlassPanel, PrimaryButton } from "./kit";
import { CompletionFlow, EmptyPlace, StationChecklist, SuggestedNext, TaskCard, WhyLine } from "./cards";

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
        <WhyLine station={station} />
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
      <WhyLine station={station} />
      {current ? (
        <>
          <TaskCard step={current} station={station} />
          <SuggestedNext current={current} here={station} />
        </>
      ) : (
        <EmptyPlace
          station={station}
          title={required.length > 0 ? "All done here" : "Nothing planned here for this plan"}
          body={
            (required.length > 0 ? `You finished ${doneCount} of ${required.length} tasks at this station.` : "Your observations did not call for any task at this station.") +
            (here.some((s0) => !s0.done && s0.blocked) ? " Anything still locked opens once its step is done." : "")
          }
        />
      )}
      <StationChecklist key={String(listOpen)} defaultOpen={listOpen} title="See all tasks here" steps={here} currentId={current?.id} onPick={(id) => setViewId(id)} />
    </GlassPanel>
  );
}
