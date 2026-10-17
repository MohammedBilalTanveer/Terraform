// Distinct panels for the places that used to open nothing (or a duplicate): Soil Patch, Runoff Gully, Waterhole,
// Camp, Cashew Grove Lookout and the Research Outpost. Each starts with "Why you're here" and then walks the
// player through that place's no-lab checks one card at a time. All advice text comes from the KB plan/analysis.
import { useState, type ReactNode } from "react";
import { useTerraform } from "../../store/terraformStore";
import { useGame } from "../gameStore";
import { checkPhase, collectChecks } from "../checks";
import { stationById, type StationId } from "../worldConfig";
import { useQuest } from "../useQuest";
import { AskBody } from "./AskPanel";
import { CropCardView } from "./PlotPanel";
import { OutpostTerminal } from "./StationPanel";
import { Card, Chips, GlassPanel, Pill, PrimaryButton, Section, cx } from "./kit";
import { CheckCardView, CompletionFlow, EmptyPlace, StationChecklist, TaskCard, WhyLine, announceDone } from "./cards";
import type { QuestStep } from "../planData";

function useStationChecks(station: StationId) {
  const q = useQuest();
  const byId = new Map(collectChecks(q.analysis, q.plan).map((c) => [c.id, c]));
  const stepsHere = q.steps.filter((s) => s.kind === "check" && s.station === station);
  return { ...q, stepsHere, byId };
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "tf-keep min-h-11 flex-1 rounded-lg px-2.5 py-1 text-[13px] font-medium transition",
            value === t.id ? "bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-300/50" : "bg-white/[0.03] text-ivory/65 hover:bg-white/[0.07] hover:text-ivory",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** One check card at a time for this place + a "see all checks here" list. */
export function ChecksBody({ station, after }: { station: StationId; after?: ReactNode }) {
  const q = useStationChecks(station);
  const [viewId, setViewId] = useState<string | null>(null);
  if (!q.analysis) {
    return <EmptyPlace station={station} title="Log your observations first" body="Checks are chosen from what you describe at the Observation Board." />;
  }
  const open = q.stepsHere.filter((s) => !s.done && !s.blocked);
  const cur: QuestStep | undefined =
    (viewId ? q.stepsHere.find((s) => s.id === viewId && !s.blocked) : undefined) ?? open.find((s) => q.quest?.id === s.id) ?? open[0];
  const check = cur?.checkId ? q.byId.get(cur.checkId) : undefined;
  const waiting = q.stepsHere.filter((s) => !s.done && s.blocked);
  return (
    <>
      {check ? (
        <CheckCardView check={check} station={station} offerSkipAll={!q.plan && checkPhase(check) === "diagnose"} />
      ) : (
        <EmptyPlace
          station={station}
          title={q.stepsHere.length === 0 ? "No checks are needed here" : waiting.length > 0 ? "Checks here are waiting" : "All checks here are done"}
          body={
            waiting.length > 0
              ? `${waiting[0].label}: ${waiting[0].blockedText ?? "not yet"}.`
              : q.stepsHere.length === 0
                ? "Your observations did not call for a check at this place."
                : "Your answers were recorded and the plan uses them."
          }
        />
      )}
      {after}
      <StationChecklist title="See all checks here" steps={q.stepsHere} currentId={cur?.id} onPick={setViewId} pickDone />
    </>
  );
}

function checkKicker(steps: QuestStep[]) {
  const total = steps.filter((s) => !s.optional).length || steps.length;
  const done = steps.filter((s) => s.done).length;
  return steps.length ? `TERRA · CHECK ${Math.min(done + 1, total)} OF ${total} HERE` : "TERRA · LOCATION";
}

/** Runoff Gully and Waterhole: the check(s) that belong to that spot. */
export function PlaceChecksPanel({ station, onClose }: { station: StationId; onClose: () => void }) {
  const lastDone = useGame((s) => s.lastDone);
  const q = useStationChecks(station);
  if (lastDone && lastDone.station === station) return <CompletionFlow station={station} onStay={() => undefined} />;
  return (
    <GlassPanel title={stationById(station).name} kicker={checkKicker(q.stepsHere)} onClose={onClose}>
      <WhyLine station={station} />
      <ChecksBody station={station} />
    </GlassPanel>
  );
}

// ---------------------------------------------------------------------------------------------
/** Soil Inspection Patch: TERRA's echo → ground checks (stick probe, rock lumps, baking-soda fizz …) → generate the plan. */
export function SoilStation({ onClose }: { onClose: () => void }) {
  const station: StationId = "soil";
  const q = useStationChecks(station);
  const lastDone = useGame((s) => s.lastDone);
  const runAction = useGame((s) => s.runAction);
  const updateFarm = useGame((s) => s.updateFarm);
  const generatePlan = useTerraform((s) => s.generatePlan);
  const loading = useTerraform((s) => s.loading);
  const busy = useGame((s) => !!s.action);
  if (lastDone && lastDone.station === station) return <CompletionFlow station={station} onStay={() => undefined} />;

  const openChecks = q.stepsHere.filter((s) => !s.done && !s.blocked);
  const soilTasks = q.steps.filter((s) => s.kind === "task" && s.station === station && !s.done && !s.blocked);
  const echoStep = q.steps.find((s) => s.kind === "echo");

  const doPlan = (skip: boolean) => {
    if (skip) updateFarm(q.sessionId, { skipChecks: true });
    runAction({ kind: "inspect", label: "Generating your plan", station, fast: true }, async () => {
      const p = await generatePlan();
      if (p) announceDone("Plan generated", station, "prepare", "plan", "It is built only from the knowledge base and what you told me.");
      useGame.getState().setOverlay(station);
    });
  };
  const planBtn = (skip: boolean) => (
    <div className="tf-sticky-cta">
      <PrimaryButton tone="sprout" disabled={busy || loading === "plan" || loading === "analyze"} onClick={() => doPlan(skip)}>
        {skip ? "Skip the remaining checks and generate the plan" : "Generate my plan"}
      </PrimaryButton>
    </div>
  );

  let kicker = checkKicker(q.stepsHere);
  let body: ReactNode;
  if (!q.analysis) {
    kicker = "TERRA · NOTHING TO INSPECT YET";
    body = <EmptyPlace station={station} title="No observations yet" body="Soil tests are chosen from what you describe at the Observation Board, so start there." />;
  } else if (!q.plan && echoStep && !echoStep.done) {
    kicker = "TERRA · I REPEAT WHAT YOU TOLD ME";
    const ea = q.analysis;
    const echo = ea.input_echo;
    const ma = ea.missing_analysis;
    body = (
      <div className="space-y-3.5">
        <h3 className="font-heading text-[19px] font-semibold leading-snug">Here is what I understood</h3>
        <Card className="space-y-2">
          <blockquote className="text-[13px] italic leading-relaxed text-ivory/80">“{echo.user_text}”</blockquote>
          {echo.faithful_summary && <p className="text-[13px] text-cyan-50/90">{echo.faithful_summary}</p>}
          <Chips evidence={ea.steps.input_echo?.evidence} />
        </Card>
        {echo.local_advice?.provided && (
          <Card className="border-amber-300/25">
            <div className="text-[11px] font-semibold text-amber-200">Local advice — a claim to check, not a fact</div>
            <p className="text-[13px] italic text-ivory/85">“{echo.local_advice.text}”</p>
            <p className="mt-1 text-[12px] text-amber-100/80">{echo.local_advice.handling}</p>
          </Card>
        )}
        {ma.archetype.statement && (
          <Section title="Land type" right={<Chips evidence={ma.archetype.evidence} />}>
            <Card>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-heading text-[14px] font-semibold">{ma.archetype.label}</span>
                <Pill tone={ma.archetype.match_strength === "strong" ? "sprout" : ma.archetype.match_strength === "partial" ? "amber" : "coral"}>{ma.archetype.match_strength} match</Pill>
              </div>
              <p className="mt-1.5 text-[13px] text-ivory/85">{ma.archetype.statement}</p>
            </Card>
          </Section>
        )}
        {ma.unknowns.length > 0 && (
          <Section title={`Still unknown (${ma.unknowns.length})`}>
            <ul className="space-y-1.5">
              {ma.unknowns.map((u) => (
                <li key={u.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px]">
                  <div className="font-medium">{u.label}</div>
                  <div className="text-ivory/65">{u.why_it_matters}</div>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <div className="tf-sticky-cta">
          <PrimaryButton
            onClick={() => {
              updateFarm(q.sessionId, { echoSeen: true });
              announceDone("Read TERRA's echo", station, "prepare", "echo");
            }}
          >
            I've read it — start the soil tests
          </PrimaryButton>
        </div>
      </div>
    );
  } else if (openChecks.length > 0) {
    body = <ChecksBody station={station} after={!q.plan ? <div className="text-[12px] text-ivory/60">Checks are recommended, never required. You can generate the plan at any time:{planBtn(true)}</div> : undefined} />;
  } else if (!q.plan) {
    kicker = "TERRA · READY TO BUILD YOUR PLAN";
    body = (
      <div className="space-y-3.5">
        <Card className="space-y-2">
          <div className="font-heading text-[17px] font-semibold">The soil tests here are done</div>
          <p className="text-[13px] leading-relaxed text-ivory/80">
            Your answers are used to pick and rank the plan. Other no-lab checks (water hole, runoff, vegetation, neighbours, supplies) are recommended too — you can do them first, or build the plan now.
          </p>
        </Card>
        {planBtn(false)}
        <StationChecklist title="See all checks here" steps={q.stepsHere} />
      </div>
    );
  } else if (soilTasks.length > 0) {
    kicker = "TERRA · OPTIONAL FOLLOW-UP HERE";
    body = (
      <>
        <TaskCard step={soilTasks[0]} station={station} />
        <StationChecklist title="See all checks here" steps={q.stepsHere} pickDone />
      </>
    );
  } else {
    body = (
      <>
        <EmptyPlace station={station} title="Nothing more to test here" body="All soil checks are done. After you have added compost, mulch or other soil treatments, an optional repeat of the fizz test will appear here." />
        <StationChecklist title="See all checks here" steps={q.stepsHere} pickDone />
      </>
    );
  }

  return (
    <GlassPanel title={stationById(station).name} kicker={kicker} steps={["input_echo", "missing_analysis"]} onClose={onClose} wide>
      <WhyLine station={station} />
      {body}
    </GlassPanel>
  );
}

// ---------------------------------------------------------------------------------------------
export function CampPanel({ onClose }: { onClose: () => void }) {
  const station: StationId = "camp";
  const q = useStationChecks(station);
  const lastDone = useGame((s) => s.lastDone);
  const [tab, setTab] = useState<"check" | "ask">("check");
  if (lastDone && lastDone.station === station) return <CompletionFlow station={station} onStay={() => undefined} />;
  const claim = q.analysis?.input_echo.local_advice;
  return (
    <GlassPanel title="Survivor Camp" kicker={tab === "ask" ? "TERRA · KNOWLEDGE-BASE ONLY" : checkKicker(q.stepsHere)} onClose={onClose}>
      <WhyLine station={station} />
      <Tabs tabs={[{ id: "check", label: "Ask the neighbours" }, { id: "ask", label: "Ask TERRA" }]} value={tab} onChange={setTab} />
      {tab === "check" ? (
        <>
          {claim?.provided && (
            <Card className="border-amber-300/25">
              <div className="text-[11px] font-semibold text-amber-200">What you were told — a claim to check, not a fact</div>
              <p className="text-[13px] italic text-ivory/85">“{claim.text}”</p>
              <p className="mt-1 text-[12px] text-amber-100/80">{claim.handling}</p>
            </Card>
          )}
          <ChecksBody station={station} />
        </>
      ) : (
        <AskBody autoFocus={false} />
      )}
    </GlassPanel>
  );
}

// ---------------------------------------------------------------------------------------------
function TreesBody() {
  const { plan } = useQuest();
  if (!plan) {
    return <EmptyPlace station="grove" title="Tree options come with the plan" body="Once your plan exists, the long-term tree options for this land are listed here, with why each may fit, what it needs and what to watch for." />;
  }
  const cs = plan.workflow.crop_suggestions;
  const trees = cs.tree_options;
  const excluded = cs.excluded.filter((c) => c.category !== "field_crop");
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-snug text-ivory/70">Trees are long-term options, shown separately from this season's field crop. Soil-builders improve the land — they are not food crops.</p>
      {trees.length === 0 && <Card><p className="text-[13px] text-ivory/80">The plan lists no tree options for the current observations.</p></Card>}
      {trees.map((c) => (
        <div key={c.crop_id} className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {c.category === "soil_builder" ? <Pill tone="violet">Soil-builder — not food</Pill> : <Pill tone="sprout">Long-term tree</Pill>}
          </div>
          <CropCardView c={c} readOnly />
        </div>
      ))}
      {excluded.length > 0 && (
        <Section title="Excluded for this land">
          {excluded.map((c) => (
            <Card key={c.crop_id}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-medium">{c.name}</span>
                {c.category === "soil_builder" && <Pill tone="violet">Soil-builder — not food</Pill>}
              </div>
              {(c.cautions_triggered.length ? c.cautions_triggered : c.limitations).map((t, i) => (
                <p key={i} className="mt-1 text-[12.5px] text-rose-100/85">{t}</p>
              ))}
              <div className="mt-1.5">
                <Chips evidence={c.evidence} />
              </div>
            </Card>
          ))}
        </Section>
      )}
    </div>
  );
}

export function GrovePanel({ onClose }: { onClose: () => void }) {
  const station: StationId = "grove";
  const q = useStationChecks(station);
  const lastDone = useGame((s) => s.lastDone);
  const [tab, setTab] = useState<"check" | "trees">("check");
  if (lastDone && lastDone.station === station) return <CompletionFlow station={station} onStay={() => setTab("trees")} />;
  return (
    <GlassPanel title="Old Cashew Grove Lookout" kicker={tab === "trees" ? "TERRA · LONG-TERM TREES" : checkKicker(q.stepsHere)} onClose={onClose}>
      <WhyLine station={station} />
      <Tabs tabs={[{ id: "check", label: "Observe the vegetation" }, { id: "trees", label: "Long-term trees" }]} value={tab} onChange={setTab} />
      {tab === "check" ? <ChecksBody station={station} /> : <TreesBody />}
    </GlassPanel>
  );
}

// ---------------------------------------------------------------------------------------------
export function OutpostPanel({ onClose }: { onClose: () => void }) {
  const station: StationId = "outpost";
  const q = useStationChecks(station);
  const lastDone = useGame((s) => s.lastDone);
  const [tab, setTab] = useState<"check" | "terminal">("check");
  if (lastDone && lastDone.station === station) return <CompletionFlow station={station} onStay={() => setTab("terminal")} />;
  return (
    <GlassPanel title="Research Outpost" kicker={tab === "terminal" ? "TERRA · FIELD TERMINAL" : checkKicker(q.stepsHere)} onClose={onClose} wide>
      <WhyLine station={station} />
      <Tabs tabs={[{ id: "check", label: "Supplies check" }, { id: "terminal", label: "Field terminal" }]} value={tab} onChange={setTab} />
      {tab === "check" ? (
        <ChecksBody station={station} />
      ) : q.plan ? (
        <OutpostTerminal />
      ) : (
        <EmptyPlace station={station} title="The field terminal needs a plan" body="Once your plan is generated, this terminal shows the full situation summary, why the plan fits your land and every task." />
      )}
    </GlassPanel>
  );
}
