// "Unknown Land" as a guided wizard: Readiness → Crop → Timeframe → Plant → Care, one card at a time.
// Everything shown comes from the plan (KB). The old tabbed view stays available as "Overview".
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Lock, Map as MapIcon, Sprout } from "lucide-react";
import { useTerraform } from "../../store/terraformStore";
import { useGame } from "../gameStore";
import { worldView } from "../planData";
import { stationById } from "../worldConfig";
import { useQuest } from "../useQuest";
import CareTab from "./CareTab";
import PlotPanel, { CropCardView } from "./PlotPanel";
import { Bullets, Card, Chips, DetailsButton, GlassPanel, Pill, PrimaryButton, Section, cx } from "./kit";
import { CompletionFlow, StationChecklist, SuggestedNext, TaskCard, TestCard, announceDone, pinStep } from "./cards";

type Wiz = "readiness" | "crop" | "time" | "plant" | "care" | "done";
const STRIP: { id: Exclude<Wiz, "done">; label: string; tab: string }[] = [
  { id: "readiness", label: "Readiness", tab: "gate" },
  { id: "crop", label: "Crop", tab: "crops" },
  { id: "time", label: "Timeframe", tab: "time" },
  { id: "plant", label: "Plant", tab: "plant" },
  { id: "care", label: "Care", tab: "care" },
];

export default function PlotWizard({ onClose }: { onClose: () => void }) {
  const { steps, quest, plan, analysis, crop, completed, farm, sessionId } = useQuest();
  const lastDone = useGame((s) => s.lastDone);
  const runAction = useGame((s) => s.runAction);
  const updateFarm = useGame((s) => s.updateFarm);
  const setForceTab = useGame((s) => s.setForceTab);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const addJournal = useTerraform((s) => s.addJournal);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const [overview, setOverview] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [listOpenKey, setListOpenKey] = useState(0);

  // the guided view decides what to show; a stale tab request from a lock notice is simply consumed
  useEffect(() => {
    if (useGame.getState().forceTab) setForceTab(null);
  }, [setForceTab]);

  const view = useMemo(() => (plan ? worldView(analysis, plan, completed, crop, farm) : null), [analysis, plan, completed, crop, farm]);

  const openOverview = (tab: string) => {
    setForceTab(tab);
    setOverview(true);
  };

  if (overview) return <PlotPanel onClose={onClose} onBack={() => setOverview(false)} />;
  if (lastDone && lastDone.station === "plot") return <CompletionFlow station="plot" onStay={() => openOverview("gate")} />;

  if (!plan || !view) {
    return (
      <GlassPanel title="Unknown Land" kicker="CULTIVATION PLOT · LOCKED" onClose={onClose}>
        <Card>
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4 text-amber-300" /> No plan yet
          </div>
          <p className="mt-1.5 text-[13px] text-ivory/80">This plot stays unknown until your observations are analysed and a plan is generated from the knowledge base.</p>
          <div className="mt-3">
            <PrimaryButton
              onClick={() => {
                useGame.getState().setTargetOverride(analysis ? "soil" : "board");
                useGame.getState().setOverlay(null);
              }}
            >
              <MapIcon className="h-4 w-4" /> Guide me to {analysis ? "the Soil Inspection Patch" : "the Observation Board"}
            </PrimaryButton>
          </div>
        </Card>
      </GlassPanel>
    );
  }

  const na = plan.workflow.next_action;
  const w = plan.workflow;
  const readinessOk = na.planting_readiness !== "not_ready";
  const sown = view.sown;
  const careDone = view.stage === "harvest_ready" || !!farm.harvested;
  const timeSeen = !!farm.timeSeen || sown;
  const active: Wiz = !readinessOk ? "readiness" : !crop ? "crop" : !timeSeen ? "time" : !sown ? "plant" : !careDone ? "care" : "done";
  const order: Wiz[] = ["readiness", "crop", "time", "plant", "care", "done"];
  const cropCard = [...w.crop_suggestions.field_crops, ...w.crop_suggestions.tree_options].find((c) => c.crop_id === crop);
  const stages = [...(w.ongoing_care.stages ?? [])].sort((a, b) => a.order - b.order);

  const plotSteps = steps.filter((s) => s.station === "plot");
  const readinessSteps = plotSteps.filter((s) => (s.kind === "task" || s.kind === "test") && (s.phase === "prepare" || s.phase === "readiness"));
  const readinessDoable = readinessSteps.filter((s) => !s.done && !s.blocked);
  const plantSteps = plotSteps.filter((s) => (s.kind === "task" || s.kind === "sow") && s.phase === "plant");
  const plantDoable = plantSteps.filter((s) => !s.done && !s.blocked);

  const pick = (list: typeof plotSteps) => (viewId ? list.find((s) => s.id === viewId) : null) ?? list.find((s) => quest && s.id === quest.id) ?? list[0] ?? null;

  const sowManually = () =>
    runAction({ kind: "sow", label: cropCard ? `Sowing ${cropCard.name}` : "Sowing", station: "plot", fast: reduceMotion }, async () => {
      updateFarm(sessionId, { sown: true, careIdx: 0 });
      setCurrentStep("ongoing_care");
      await addJournal(`Explorer: sowed ${cropCard?.name ?? "selected crop"} in the cultivation plot.`);
      announceDone(`Sowed ${cropCard?.name ?? "the crop"}`, "plot", "plant", "sow");
      useGame.getState().setOverlay("plot");
    });

  const advanceStage = () =>
    runAction({ kind: "water", label: stages[view.careIdx + 1]?.label ?? "Tending the crop", station: "plot", fast: reduceMotion }, async () => {
      updateFarm(sessionId, { careIdx: Math.min(view.careIdx + 1, Math.max(0, stages.length - 1)) });
      await addJournal(`Explorer: reached care stage "${stages[view.careIdx + 1]?.label ?? ""}".`);
      useGame.getState().setOverlay("plot");
    });

  const finishCare = () =>
    runAction({ kind: "water", label: "Finishing the last care stage", station: "plot", fast: reduceMotion }, async () => {
      updateFarm(sessionId, { careDone: true, careIdx: Math.max(0, stages.length - 1) });
      setCurrentStep("harvest");
      await addJournal("Explorer: completed the last care stage — crop is ready to harvest.");
      announceDone("Finished the last care stage", "plot", "care", "care");
      useGame.getState().setOverlay("plot");
    });

  // ---- header ------------------------------------------------------------------------------------
  const readyDone = readinessSteps.filter((s) => s.done).length;
  const stepNo = order.indexOf(active) + 1;
  const kicker =
    active === "readiness"
      ? `TERRA · TASK ${Math.min(readyDone + 1, Math.max(readinessSteps.length, 1))} OF ${Math.max(readinessSteps.length, 1)} HERE`
      : active === "done"
        ? "TERRA · ALL DONE AT THE PLOT"
        : `TERRA · STEP ${stepNo} OF 5 · ${STRIP[stepNo - 1].label.toUpperCase()}`;

  const strip = (
    <div className="flex gap-1" role="list" aria-label="Plot progress">
      {STRIP.map((s, i) => {
        const done = order.indexOf(active) > i;
        const cur = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="listitem"
            disabled={!done}
            onClick={() => openOverview(s.tab)}
            title={done ? `Review: ${s.label}` : s.label}
            className={cx(
              "flex min-h-9 flex-1 items-center justify-center gap-1 truncate rounded-lg border px-1 text-[10.5px] font-medium",
              done ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : cur ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-50" : "border-white/10 bg-white/[0.03] text-ivory/45",
            )}
          >
            {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            <span className="hidden truncate min-[420px]:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );

  const goQuest = quest && (
    <PrimaryButton
      onClick={() => {
        pinStep(quest);
        useGame.getState().setOverlay(null);
      }}
    >
      <MapIcon className="h-4 w-4" /> Go to {stationById(quest.station).name} — {quest.label}
    </PrimaryButton>
  );

  let body: ReactNode = null;
  if (active === "readiness") {
    const cur = pick(readinessDoable);
    body = cur ? (
      <>
        {cur.kind === "test" ? <TestCard step={cur} /> : <TaskCard step={cur} station="plot" />}
        <SuggestedNext current={cur} here="plot" />
        <StationChecklist
          key={listOpenKey}
          title="See all tasks here"
          steps={readinessSteps}
          currentId={cur.id}
          onPick={(id) => setViewId(id)}
        />
      </>
    ) : (
      <Card className="space-y-3">
        <div className="font-heading text-[16px] font-semibold">Nothing more to do at the plot for now</div>
        <p className="text-[13px] text-ivory/80">
          {na.next_best_action || "The rest of the readiness work is done at other stations."}
        </p>
        {goQuest}
        <StationChecklist title="See all tasks here" steps={readinessSteps} />
      </Card>
    );
  } else if (active === "crop") {
    body = (
      <>
        <div>
          <h3 className="font-heading text-[19px] font-semibold">Choose a crop</h3>
          {w.crop_suggestions.summary && <p className="mt-1 text-[13px] text-ivory/80">{w.crop_suggestions.summary}</p>}
        </div>
        {w.crop_suggestions.local_advice_note && (
          <Card className="border-amber-300/25">
            <div className="text-[11px] font-semibold text-amber-200">About the local advice</div>
            <p className="text-[12.5px] text-ivory/85">{w.crop_suggestions.local_advice_note}</p>
          </Card>
        )}
        <Section title="Field crops" right={<Chips evidence={w.crop_suggestions.evidence} />}>
          {w.crop_suggestions.field_crops.map((c) => (
            <CropCardView key={c.crop_id} c={c} onChosen={(cc) => announceDone(`${cc.name} chosen`, "plot", "crop", "crop")} />
          ))}
        </Section>
        {w.crop_suggestions.tree_options.length > 0 && (
          <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5">
            <summary className="min-h-9 cursor-pointer text-[12px] text-ivory/75">Long-term tree options ({w.crop_suggestions.tree_options.length})</summary>
            <div className="mt-2 space-y-2">
              {w.crop_suggestions.tree_options.map((c) => (
                <CropCardView key={c.crop_id} c={c} />
              ))}
            </div>
          </details>
        )}
      </>
    );
  } else if (active === "time") {
    const row = w.timeframe.rows.find((r0) => r0.crop_id === crop);
    body = (
      <>
        <div>
          <h3 className="font-heading text-[19px] font-semibold">Timeframe{cropCard ? ` for ${cropCard.name}` : ""}</h3>
        </div>
        <Card className="space-y-2">
          <p className="text-[13.5px] text-ivory/90">{w.timeframe.season_assumption}</p>
          {row && (
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              <Pill tone="muted">
                maturity {row.maturity_weeks.min}–{row.maturity_weeks.max} wk
              </Pill>
              <Pill tone="muted">
                + buffer {row.buffer_weeks.min}–{row.buffer_weeks.max} wk
              </Pill>
              <Pill tone={row.season_fit === "fits" ? "sprout" : row.season_fit === "tight" ? "amber" : row.season_fit === "high_risk" ? "coral" : "muted"}>
                total {row.total_weeks.min}–{row.total_weeks.max} wk · {row.season_fit.replace(/_/g, " ")}
              </Pill>
            </div>
          )}
          {row?.explanation && <p className="text-[12.5px] text-ivory/75">{row.explanation}</p>}
          {w.timeframe.buffer?.explanation && <p className="text-[12.5px] text-ivory/70">{w.timeframe.buffer.explanation}</p>}
          {w.timeframe.comparison && <p className="text-[12.5px] text-cyan-100/85">{w.timeframe.comparison}</p>}
          <Chips evidence={row?.evidence ?? w.timeframe.evidence} />
        </Card>
        <button
          type="button"
          onClick={() => {
            updateFarm(sessionId, { timeSeen: true });
            announceDone(`Checked the timeframe${cropCard ? ` for ${cropCard.name}` : ""}`, "plot", "crop", "time");
          }}
          className="min-h-12 w-full rounded-xl bg-emerald-400/90 px-4 py-3 text-[15px] font-semibold text-[#06101f] hover:bg-emerald-300"
        >
          Continue
        </button>
      </>
    );
  } else if (active === "plant") {
    const cur = pick(plantDoable);
    body = cur ? (
      cur.kind === "sow" ? (
        <div className="space-y-3.5">
          <h3 className="font-heading text-[19px] font-semibold">{cur.label}</h3>
          {w.planting_method.summary && <p className="text-[13.5px] text-ivory/85">{w.planting_method.summary}</p>}
          <button
            type="button"
            onClick={sowManually}
            className="min-h-12 w-full rounded-xl bg-emerald-400/90 px-4 py-3 text-[15px] font-semibold text-[#06101f] hover:bg-emerald-300"
          >
            <Sprout className="mr-1.5 inline h-4 w-4" /> Sow {cropCard?.name ?? "the crop"} here
          </button>
        </div>
      ) : (
        <>
          <TaskCard step={cur} station="plot" />
          <SuggestedNext current={cur} here="plot" />
          <StationChecklist title="See all planting tasks" steps={plantSteps} currentId={cur.id} onPick={(id) => setViewId(id)} />
        </>
      )
    ) : (
      <Card className="space-y-3">
        <div className="font-heading text-[16px] font-semibold">Ready to plant</div>
        <p className="text-[13px] text-ivory/80">No planting task is open right now.</p>
        {goQuest}
      </Card>
    );
  } else if (active === "care") {
    const follow = plantDoable.find((s) => s.kind === "task");
    body = (
      <>
        {follow && (
          <Card className="space-y-2 border-amber-300/30">
            <div className="text-[11px] font-semibold text-amber-200">Planting follow-up</div>
            <TaskCard step={follow} station="plot" />
          </Card>
        )}
        <CareTab plan={plan} view={view} stages={stages} sown={sown} onAdvance={advanceStage} onFinish={finishCare} />
      </>
    );
  } else {
    body = (
      <Card className="space-y-3 border-amber-300/30">
        <div className="font-heading text-[16px] font-semibold">The crop is ready to harvest</div>
        <p className="text-[13px] text-ivory/80">Every stage at the plot is done. The Harvest Point is next.</p>
        {goQuest}
      </Card>
    );
  }

  return (
    <GlassPanel
      title="Unknown Land — Cultivation Plot"
      kicker={kicker}
      onClose={onClose}
      wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <DetailsButton step={quest ? (quest.kind === "care" ? "ongoing_care" : quest.kind === "crop" ? "crop_suggestions" : "next_action") : "next_action"} />
          <button
            type="button"
            onClick={() => {
              setListOpenKey((k) => k + 1);
              openOverview(active === "done" ? "care" : STRIP.find((s) => s.id === active)?.tab ?? "gate");
            }}
            className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-[12px] font-medium text-ivory/85 hover:border-cyan-300/50 sm:min-h-0 sm:py-1.5"
          >
            Overview
          </button>
        </div>
      }
    >
      {strip}
      {body}
    </GlassPanel>
  );
}

void Bullets;
