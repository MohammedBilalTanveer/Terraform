// Generic task station (Stone-Line Terraces, Compost & Mulch, Water Storage, Research Outpost terminal).
// Lists the plan's recommendations routed to this station; "mark complete" plays the matching animation.
import { useMemo } from "react";
import { CheckCircle2, Circle, Map as MapIcon, Navigation } from "lucide-react";
import { useTerraform } from "../../store/terraformStore";
import { useGame, farmFor } from "../gameStore";
import { GROUP_STATION, collectPlanItems, guidance, itemsForStation, taskItems } from "../planData";
import { stationById, type StationId } from "../worldConfig";
import RecCard from "./RecCard";
import { Card, Chips, DetailsButton, GlassPanel, PrimaryButton, Pill, Section } from "./kit";

const KICKER: Partial<Record<StationId, string>> = {
  terraces: "WATER CAPTURE · STONE LINES",
  compost: "SOIL BUILDING · COMPOST & MULCH",
  water: "WATER STORAGE · DRY SPELLS",
  outpost: "FIELD TERMINAL · FULL PLAN",
};

function NoPlan({ onClose, station }: { onClose: () => void; station: StationId }) {
  const analysis = useTerraform((s) => s.analysis);
  const backendOnline = useTerraform((s) => s.backendOnline);
  const completed = useTerraform((s) => s.completedTasks);
  const crop = useTerraform((s) => s.selectedCropId);
  const sessionId = useTerraform((s) => s.sessionId);
  const farm = farmFor(useGame((s) => s.farm), sessionId);
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const setOverlay = useGame((s) => s.setOverlay);
  const g = guidance({ backendOnline, analysis, plan: null, completed, selectedCropId: crop, farm });
  const st = stationById(station);
  return (
    <GlassPanel title={st.name} kicker={KICKER[station] ?? "STATION"} steps={st.steps} onClose={onClose}>
      <Card>
        <p className="text-[13px] text-ivory/85">No plan has been generated yet, so this station has no tasks. TERRA only shows tasks from your knowledge-base plan.</p>
        {g.lines.map((l, i) => (
          <p key={i} className="mt-2 text-[13px] text-cyan-100/85">
            {l}
          </p>
        ))}
        <div className="mt-3">
          <PrimaryButton
            onClick={() => {
              setTargetOverride(g.target);
              setOverlay(null);
            }}
          >
            <MapIcon className="h-4 w-4" /> Guide me to {g.target ? stationById(g.target).name : "the next step"}
          </PrimaryButton>
        </div>
      </Card>
    </GlassPanel>
  );
}

export default function StationPanel({ station, onClose }: { station: StationId; onClose: () => void }) {
  const plan = useTerraform((s) => s.plan);
  const completed = useTerraform((s) => s.completedTasks);
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const setOverlay = useGame((s) => s.setOverlay);
  const items = useMemo(() => collectPlanItems(plan), [plan]);
  if (!plan) return <NoPlan station={station} onClose={onClose} />;
  const st = stationById(station);

  if (station === "outpost") {
    const tasks = taskItems(items);
    const avoid = items.filter((i) => i.section === "avoid");
    const here = itemsForStation(items, "outpost");
    return (
      <GlassPanel title="Research Outpost — Field Terminal" kicker={KICKER.outpost} onClose={onClose} wide footer={<DetailsButton step="fix_protocol" label="Open full plan in Dashboard" />}>
        <Section title="Situation" right={<Chips evidence={plan.evidence} />}>
          <Card>
            <p className="text-[13px] leading-relaxed text-ivory/85">{plan.situation_summary}</p>
          </Card>
        </Section>
        {plan.adaptations.length > 0 && (
          <Section title="Why this plan fits your land">
            {plan.adaptations.map((a, i) => (
              <Card key={i}>
                <div className="font-medium text-[13px]">{a.label}</div>
                <p className="text-[12.5px] text-ivory/75">{a.effect}</p>
                <div className="mt-1.5">
                  <Chips evidence={{ kb_ids: a.kb_ids, source_ids: [] }} />
                </div>
              </Card>
            ))}
          </Section>
        )}
        <Section title={`All plan tasks (${tasks.filter((t) => completed.includes(t.rec.task_id!)).length}/${tasks.length} done)`}>
          <ul className="space-y-1.5">
            {tasks.map((t) => {
              const done = completed.includes(t.rec.task_id!);
              const target = GROUP_STATION[t.group];
              return (
                <li key={t.rec.task_id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                  {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <Circle className="h-4 w-4 shrink-0 text-ivory/40" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium">{t.rec.task_label ?? t.rec.title}</div>
                    <div className="text-[10.5px] text-ivory/55">{stationById(target).name}</div>
                  </div>
                  <Chips evidence={t.rec.evidence} />
                  {!done && target !== "outpost" && (
                    <button
                      type="button"
                      aria-label={`Guide me to ${stationById(target).name}`}
                      className="rounded-md p-1 text-cyan-200 hover:bg-white/10"
                      onClick={() => {
                        setTargetOverride(target);
                        setOverlay(null);
                      }}
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
        {here.length > 0 && (
          <Section title="Logged at the terminal">
            {here.map((i) => (
              <RecCard key={i.rec.id + i.section} rec={i.rec} item={i} here="outpost" />
            ))}
          </Section>
        )}
        {avoid.length > 0 && (
          <Section title="Avoid">
            {avoid.map((i) => (
              <RecCard key={i.rec.id} rec={i.rec} />
            ))}
          </Section>
        )}
      </GlassPanel>
    );
  }

  const list = itemsForStation(items, station).filter((i) => i.section !== "avoid");
  const open = list.filter((i) => i.rec.task_id && !completed.includes(i.rec.task_id)).length;
  return (
    <GlassPanel title={st.name} kicker={KICKER[station] ?? "STATION"} steps={st.steps} onClose={onClose} footer={<DetailsButton step={list[0]?.step ?? "fix_protocol"} />}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="cyan">{list.length} plan item{list.length === 1 ? "" : "s"} here</Pill>
        {open > 0 ? <Pill tone="amber">{open} open task{open === 1 ? "" : "s"}</Pill> : list.some((i) => i.rec.task_id) ? <Pill tone="sprout">All tasks done</Pill> : null}
      </div>
      {list.length === 0 ? (
        <Card>
          <p className="text-[13px] text-ivory/80">Your current plan has no items for this station. Check the Research Outpost terminal for the full task list.</p>
        </Card>
      ) : (
        list.map((i) => <RecCard key={i.rec.id + i.section} rec={i.rec} item={i} here={station} defaultOpen={list.length <= 2} />)
      )}
    </GlassPanel>
  );
}
