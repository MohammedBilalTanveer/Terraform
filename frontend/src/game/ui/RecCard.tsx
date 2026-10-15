// Renders one API Recommendation verbatim + the completable task button that plays the farming animation.
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Navigation, Hammer } from "lucide-react";
import type { Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import { useGame, type ActionKind } from "../gameStore";
import { GROUP_STATION, SECTION_LABEL, type PlanItem } from "../planData";
import { stationById, type StationId } from "../worldConfig";
import { Bullets, Card, Chips, GhostButton, Pill, PrimaryButton, cx, humanize } from "./kit";

const VERB: Record<ActionKind, string> = {
  inspect: "Check",
  dig: "Dig & prepare",
  stones: "Lay stones",
  compost: "Add & spread",
  sow: "Sow",
  water: "Set up water",
  harvest: "Harvest",
};

const priorityTone = (p: Recommendation["priority"]) =>
  p === "do_first" ? "coral" : p === "do_next" ? "amber" : p === "avoid" ? "coral" : "muted";

export function TaskButton({ item, here }: { item: PlanItem; here: StationId }) {
  const completed = useTerraform((s) => s.completedTasks);
  const toggleTask = useTerraform((s) => s.toggleTask);
  const loading = useTerraform((s) => s.loading);
  const runAction = useGame((s) => s.runAction);
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const setOverlay = useGame((s) => s.setOverlay);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const taskId = item.rec.task_id;
  if (!taskId) return null;
  const done = completed.includes(taskId);
  const station = GROUP_STATION[item.group];
  const atStation = station === here;
  if (done) {
    return (
      <div className="flex items-center gap-2">
        <Pill tone="sprout">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Pill>
        <button type="button" className="text-[11px] text-ivory/60 underline hover:text-ivory" onClick={() => void toggleTask(taskId)}>
          Reopen
        </button>
      </div>
    );
  }
  if (!atStation && here !== "outpost") return null;
  if (!atStation) {
    return (
      <GhostButton
        onClick={() => {
          setTargetOverride(station);
          setOverlay(null);
        }}
      >
        <Navigation className="h-3.5 w-3.5" /> Go to {stationById(station).name}
      </GhostButton>
    );
  }
  return (
    <PrimaryButton
      tone="sprout"
      disabled={loading === "progress"}
      onClick={() =>
        runAction({ kind: item.action, label: item.rec.task_label ?? item.rec.title, station: here, fast: reduceMotion }, () => toggleTask(taskId))
      }
    >
      <Hammer className="h-3.5 w-3.5" /> {VERB[item.action]} — mark complete
    </PrimaryButton>
  );
}

export default function RecCard({ rec, item, here, defaultOpen = false }: { rec: Recommendation; item?: PlanItem; here?: StationId; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const completed = useTerraform((s) => s.completedTasks);
  const done = !!rec.task_id && completed.includes(rec.task_id);
  return (
    <Card className={cx(done && "border-emerald-300/25 bg-emerald-400/[0.04]", rec.priority === "avoid" && "border-rose-300/25 bg-rose-500/[0.05]")}>
      <div className="flex items-start gap-2">
        {rec.task_id ? (
          done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ivory/40" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="font-heading text-[14px] font-semibold leading-snug">{rec.title}</h4>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {item && <Pill tone="violet">{SECTION_LABEL[item.section]}</Pill>}
            {rec.priority && !item && <Pill tone={priorityTone(rec.priority)}>{humanize(rec.priority)}</Pill>}
            {rec.category && <Pill tone="muted">{humanize(rec.category)}</Pill>}
            <Pill tone={rec.confidence === "high" ? "sprout" : rec.confidence === "medium" ? "amber" : "coral"}>confidence: {rec.confidence}</Pill>
          </div>
          {rec.explanation && <p className="mt-2 text-[13px] leading-relaxed text-ivory/85">{rec.explanation}</p>}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
          {rec.actions?.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-cyan-200/90">Steps</div>
              <Bullets items={rec.actions} />
            </div>
          )}
          {rec.everyday_amounts?.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-cyan-200/90">Everyday amounts</div>
              <Bullets items={rec.everyday_amounts} />
            </div>
          )}
          {rec.why_this_matches?.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-cyan-200/90">Why this matches your land</div>
              <Bullets items={rec.why_this_matches} />
            </div>
          )}
          {rec.limitations?.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-amber-200/90">Limitations</div>
              <Bullets items={rec.limitations} tone="warn" />
            </div>
          )}
          {rec.safety_notes?.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-rose-200/90">Safety</div>
              <Bullets items={rec.safety_notes} tone="safety" />
            </div>
          )}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <Chips evidence={rec.evidence} />
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-0.5 text-[11px] text-ivory/60 hover:text-ivory">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {open ? "Less" : "Steps & details"}
        </button>
      </div>
      {item && here && rec.task_id && (
        <div className="mt-2.5">
          <TaskButton item={item} here={here} />
        </div>
      )}
    </Card>
  );
}
