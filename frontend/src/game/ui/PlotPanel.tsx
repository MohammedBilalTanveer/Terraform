// "Unknown Land" cultivation plot — steps 5–9: readiness gate, crop choice, timeframe, planting, care.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Lock, Navigation, ShieldAlert, Sprout, TimerReset } from "lucide-react";
import type { CropCard, StepId } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import { farmFor, useGame } from "../gameStore";
import { GROUP_STATION, collectPlanItems, guidance, worldView } from "../planData";
import { stationById } from "../worldConfig";
import RecCard from "./RecCard";
import { Bullets, Busy, Card, Chips, DetailsButton, ErrorNote, GhostButton, GlassPanel, Pill, PrimaryButton, Section, ThisOneBadge, cx, humanize, useAutoFocusItem } from "./kit";

type Tab = "gate" | "crops" | "time" | "plant" | "care";
const TABS: { id: Tab; label: string; step: StepId }[] = [
  { id: "gate", label: "Readiness", step: "next_action" },
  { id: "crops", label: "Crops", step: "crop_suggestions" },
  { id: "time", label: "Timeframe", step: "timeframe" },
  { id: "plant", label: "Planting", step: "planting_method" },
  { id: "care", label: "Growth & care", step: "ongoing_care" },
];

const fitTone = (f: CropCard["fit_label"]) => (f === "good_fit" ? "sprout" : f === "possible" ? "cyan" : f === "high_risk" ? "amber" : "coral");
const seasonTone = (f: string) => (f === "fits" ? "sprout" : f === "tight" ? "amber" : f === "high_risk" ? "coral" : "muted");

function CropCardView({ c }: { c: CropCard }) {
  const selected = useTerraform((s) => s.selectedCropId);
  const selectCrop = useTerraform((s) => s.selectCrop);
  const loading = useTerraform((s) => s.loading);
  const [open, setOpen] = useState(false);
  const isSel = selected === c.crop_id;
  return (
    <div data-incomplete={!selected && c.category !== "tree" && c.fit_label !== "excluded" ? "true" : undefined} className="rounded-xl transition-shadow">
    <Card className={cx(isSel && "border-emerald-300/50 bg-emerald-400/[0.06]")}>
      <div className="flex items-start gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 font-display text-[11px] text-amber-200">#{c.rank}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="font-heading text-[14px] font-semibold">{c.name}</h4>
            {c.local_names.length > 0 && <span className="text-[11.5px] text-ivory/55">({c.local_names.join(", ")})</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone={fitTone(c.fit_label)}>{c.fit_label.replace(/_/g, " ")}</Pill>
            <Pill tone={seasonTone(c.season_fit)}>season: {c.season_fit.replace(/_/g, " ")}</Pill>
            {c.maturity_weeks && (
              <Pill tone="muted">
                {c.maturity_weeks.min}–{c.maturity_weeks.max} weeks
              </Pill>
            )}
            <Pill tone={c.confidence === "high" ? "sprout" : c.confidence === "medium" ? "amber" : "coral"}>confidence: {c.confidence}</Pill>
          </div>
        </div>
        {c.category !== "tree" && c.fit_label !== "excluded" && (
          <PrimaryButton tone={isSel ? "sprout" : "cyan"} disabled={!!loading || isSel} onClick={() => void selectCrop(c.crop_id)}>
            {isSel ? <CheckCircle2 className="h-4 w-4" /> : null} {isSel ? "Chosen" : "Choose"}
          </PrimaryButton>
        )}
      </div>
      <div className="mt-2">
        <Bullets items={c.why_it_may_fit} />
      </div>
      {open && (
        <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[12.5px]">
          {c.water_needs && <div><span className="text-cyan-200/90">Water: </span>{c.water_needs}</div>}
          {c.rooting_notes && <div><span className="text-cyan-200/90">Roots: </span>{c.rooting_notes}</div>}
          {c.maturity_description && <div><span className="text-cyan-200/90">Maturity: </span>{c.maturity_description}</div>}
          {c.missing_resources.length > 0 && <div><span className="text-amber-200/90">Missing resources: </span>{c.missing_resources.join(", ")}</div>}
          <Bullets items={c.limitations} tone="warn" />
          <Bullets items={c.cautions_triggered} tone="safety" />
          {c.score_breakdown.length > 0 && (
            <ul className="space-y-0.5 text-[11.5px] text-ivory/65">
              {c.score_breakdown.map((s, i) => (
                <li key={i}>
                  <span className={s.points >= 0 ? "text-emerald-300" : "text-rose-300"}>{s.points >= 0 ? "+" : ""}{s.points}</span> {s.factor} — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <Chips evidence={c.evidence} />
        <button type="button" className="text-[11px] text-ivory/60 hover:text-ivory" onClick={() => setOpen(!open)}>
          {open ? "Less" : "Details"}
        </button>
      </div>
    </Card>
    </div>
  );
}

export default function PlotPanel({ onClose }: { onClose: () => void }) {
  const plan = useTerraform((s) => s.plan);
  const analysis = useTerraform((s) => s.analysis);
  const backendOnline = useTerraform((s) => s.backendOnline);
  const completed = useTerraform((s) => s.completedTasks);
  const crop = useTerraform((s) => s.selectedCropId);
  const loading = useTerraform((s) => s.loading);
  const error = useTerraform((s) => s.error);
  const acceptRisk = useTerraform((s) => s.acceptRisk);
  const setGateResult = useTerraform((s) => s.setGateResult);
  const gateResults = useTerraform((s) => s.gateResults);
  const addJournal = useTerraform((s) => s.addJournal);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const sessionId = useTerraform((s) => s.sessionId);
  const farm = farmFor(useGame((s) => s.farm), sessionId);
  const updateFarm = useGame((s) => s.updateFarm);
  const runAction = useGame((s) => s.runAction);
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const setOverlay = useGame((s) => s.setOverlay);
  const items = useMemo(() => collectPlanItems(plan), [plan]);
  const g = guidance({ backendOnline, analysis, plan, completed, selectedCropId: crop, farm });
  const focusTaskId = useGame((s) => s.focusTaskId);
  const lastTab = useGame((s) => s.lastTab.plot) as Tab | undefined;
  const setLastTab = useGame((s) => s.setLastTab);
  const setFocusTask = useGame((s) => s.setFocusTask);
  const say = useGame((s) => s.say);
  // Resume where you left: the focused quest task's tab, else the first tab with unfinished work.
  const initial: Tab = (() => {
    if (!plan) return "gate";
    const fi = focusTaskId ? items.find((i) => i.rec.task_id === focusTaskId && i.group === "plot") : undefined;
    if (fi) return fi.action === "sow" || fi.section === "sowing" ? "plant" : "gate";
    const v = worldView(analysis, plan, completed, crop, farm);
    if (plan.workflow.next_action.planting_readiness === "not_ready") return "gate";
    if (!crop) return "crops";
    if (!v.sown) return "plant";
    if (v.stage !== "harvest_ready") return "care";
    return lastTab ?? "care";
  })();
  const [tab, setTabState] = useState<Tab>(initial);
  const setTab = (t: Tab) => {
    setTabState(t);
    setLastTab("plot", t);
  };
  const [confirmRisk, setConfirmRisk] = useState<string | null>(null);
  useAutoFocusItem([tab, plan?.plan_id], focusTaskId, reduceMotion);
  useEffect(() => {
    setLastTab("plot", initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!plan) {
    return (
      <GlassPanel title="Unknown Land" kicker="CULTIVATION PLOT · LOCKED" steps={["next_action"]} onClose={onClose}>
        <Card>
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4 text-amber-300" /> No plan yet
          </div>
          <p className="mt-1.5 text-[13px] text-ivory/80">
            This plot stays unknown until your observations are analysed and a plan is generated from the knowledge base.
          </p>
          {g.lines.map((l, i) => (
            <p key={i} className="mt-2 text-[13px] text-cyan-100/85">{l}</p>
          ))}
          <div className="mt-3">
            <PrimaryButton
              onClick={() => {
                setTargetOverride(g.target);
                setOverlay(null);
              }}
            >
              <Navigation className="h-4 w-4" /> Guide me to {g.target ? stationById(g.target).name : "the next step"}
            </PrimaryButton>
          </div>
        </Card>
      </GlassPanel>
    );
  }

  const w = plan.workflow;
  const na = w.next_action;
  const view = worldView(analysis, plan, completed, crop, farm);
  const plotItems = items.filter((i) => i.group === "plot");
  const prepItems = plotItems.filter((i) => i.section !== "sowing" && i.action !== "sow");
  const sowTaskItems = plotItems.filter((i) => i.action === "sow" && i.rec.task_id);
  const readinessOk = na.planting_readiness !== "not_ready";
  const cropCard = [...w.crop_suggestions.field_crops, ...w.crop_suggestions.tree_options].find((c) => c.crop_id === crop);
  const stages = [...(w.ongoing_care.stages ?? [])].sort((a, b) => a.order - b.order);
  const curStage = stages[view.careIdx];

  const sowManually = () =>
    runAction({ kind: "sow", label: cropCard ? `Sowing ${cropCard.name}` : "Sowing", station: "plot", fast: reduceMotion }, async () => {
      updateFarm(sessionId, { sown: true, careIdx: 0 });
      setCurrentStep("ongoing_care");
      await addJournal(`Explorer: sowed ${cropCard?.name ?? "selected crop"} in the cultivation plot.`);
    });

  const advanceStage = () =>
    runAction({ kind: "water", label: stages[view.careIdx + 1]?.label ?? "Tending the crop", station: "plot", fast: reduceMotion }, async () => {
      updateFarm(sessionId, { careIdx: Math.min(view.careIdx + 1, Math.max(0, stages.length - 1)) });
      await addJournal(`Explorer: reached care stage "${stages[view.careIdx + 1]?.label ?? ""}".`);
    });

  const tabStep = TABS.find((t) => t.id === tab)!.step;

  return (
    <GlassPanel
      title="Unknown Land — Cultivation Plot"
      kicker={`PLOT STATE · ${view.stage.replace(/_/g, " ").toUpperCase()}`}
      steps={[tabStep]}
      onClose={onClose}
      wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <DetailsButton step={tabStep} />
          <span className="text-[11px] text-ivory/55">All guidance shown here comes from your knowledge-base plan.</span>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Plot sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "rounded-lg px-2.5 py-1 text-[12px] font-medium transition",
              tab === t.id ? "bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-300/50" : "text-ivory/65 hover:bg-white/5 hover:text-ivory",
            )}
          >
            {t.label}
            {t.id === "gate" && (
              <span className={cx("ml-1.5 inline-block h-1.5 w-1.5 rounded-full", readinessOk ? "bg-emerald-300" : "bg-amber-300")} />
            )}
          </button>
        ))}
      </div>
      {loading === "plan" && <Busy label="Updating the plan…" />}
      {error && <ErrorNote message={error} />}

      {tab === "gate" && (
        <>
          <Section title="Planting readiness" right={<Chips evidence={na.evidence} />}>
            <Card className={readinessOk ? "border-emerald-300/30" : "border-amber-300/30"}>
              <div className="flex items-center gap-2">
                {readinessOk ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <ShieldAlert className="h-5 w-5 text-amber-300" />}
                <span className="font-heading text-[15px] font-semibold">{na.planting_readiness.replace(/_/g, " ")}</span>
              </div>
              {na.next_best_action && <p className="mt-1.5 text-[13px] text-ivory/85">{na.next_best_action}</p>}
              <Bullets items={na.warnings?.length ? na.warnings : na.blocked_until} tone="warn" />
            </Card>
          </Section>
          <Section title="Readiness gate">
            {na.readiness_gate.map((gt) => {
              // every task that satisfies this gate (gate_tasks from v1.3 are merged into `items`)
              const tasks = items.filter((i) => i.rec.task_id && gt.satisfied_by_tasks.includes(i.rec.task_id));
              const unknownIds = gt.satisfied_by_tasks.filter((id) => !tasks.some((t) => t.rec.task_id === id));
              const taskDone = gt.task_done ?? gt.satisfied_by_tasks.some((id) => completed.includes(id));
              const testResult = gateResults[gt.id] ?? gt.test_result ?? null;
              const canAccept = gt.can_accept_risk ?? (taskDone && testResult !== "pass" && !gt.accepted_risk && !!gt.verification);
              const blocking = gt.blocking_reason ?? (!taskDone ? "task_not_done" : gt.satisfied ? null : testResult === "fail" ? "test_failed" : "test_not_run");
              const open = gt.required && !gt.satisfied;
              return (
                <Card key={gt.id} className={gt.satisfied ? "border-emerald-300/25" : gt.accepted_risk ? "border-amber-300/30" : ""}>
                  <div className="flex items-start gap-2" data-incomplete={open ? "true" : undefined}>
                    {gt.satisfied ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" /> : gt.accepted_risk ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" /> : <Circle className="mt-0.5 h-4 w-4 text-ivory/40" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-medium">{gt.label}</span>
                        {gt.required && <Pill tone="violet">required</Pill>}
                        {gt.accepted_risk && <Pill tone="amber">risk accepted</Pill>}
                        {open && blocking === "task_not_done" && <Pill tone="coral">task not done</Pill>}
                        {open && blocking === "test_not_run" && <Pill tone="amber">test not run</Pill>}
                        {open && blocking === "test_failed" && <Pill tone="coral">test failed</Pill>}
                      </div>
                      {gt.detail && <p className="text-[12.5px] text-ivory/70">{gt.detail}</p>}
                      {(tasks.length > 0 || unknownIds.length > 0) && (
                        <ul className="mt-2 space-y-1.5">
                          {tasks.map((t) => {
                            const done = completed.includes(t.rec.task_id!);
                            const st = GROUP_STATION[t.group];
                            const focused = focusTaskId === t.rec.task_id && !done;
                            return (
                              <li key={t.rec.task_id} className={cx("flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5", done ? "border-emerald-300/25 bg-emerald-400/[0.04]" : "border-white/10 bg-white/[0.03]", focused && "ring-2 ring-cyan-300/50")}>
                                {done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-ivory/40" />}
                                <div className="min-w-0 flex-1">
                                  <div className={cx("text-[12.5px]", done && "text-ivory/55 line-through")}>{t.rec.task_label ?? t.rec.title}</div>
                                  <div className="text-[10.5px] text-ivory/50">Done at: {stationById(st).name}</div>
                                </div>
                                {focused && <ThisOneBadge />}
                                {!done && (
                                  <GhostButton
                                    onClick={() => {
                                      setFocusTask(t.rec.task_id);
                                      if (st === "plot") {
                                        setTab("gate");
                                        window.setTimeout(() => document.querySelector(`[data-panel-scroll] [data-task-id="${t.rec.task_id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
                                      } else {
                                        setTargetOverride(st);
                                        say(`Head to ${stationById(st).name} — ${t.rec.task_label ?? t.rec.title}`);
                                        setOverlay(null);
                                      }
                                    }}
                                  >
                                    <Navigation className="h-3.5 w-3.5" /> {st === "plot" ? "Do it here" : "Go there"}
                                  </GhostButton>
                                )}
                              </li>
                            );
                          })}
                          {unknownIds.map((id) => (
                            <li key={id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12.5px]">
                              {completed.includes(id) ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Circle className="h-3.5 w-3.5 text-ivory/40" />}
                              <span className="flex-1">{humanize(id)}</span>
                              <span className="text-[10.5px] text-ivory/50">see the Research Outpost terminal</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {open && !gt.accepted_risk && (
                        <div className="mt-2">
                          {canAccept ? (
                            confirmRisk === gt.id ? (
                              <div className="flex flex-wrap items-center gap-2 text-[12px] text-amber-100">
                                Skip the verification test and record this as an open risk?
                                <GhostButton onClick={() => void acceptRisk(gt.id).then(() => setConfirmRisk(null))}>Yes, accept risk</GhostButton>
                                <GhostButton onClick={() => setConfirmRisk(null)}>Cancel</GhostButton>
                              </div>
                            ) : (
                              <button type="button" className="min-h-9 text-[11.5px] text-amber-200 underline" onClick={() => setConfirmRisk(gt.id)}>
                                Accept risk (skip the test)…
                              </button>
                            )
                          ) : blocking === "task_not_done" ? (
                            <p className="text-[11.5px] text-ivory/65">Complete one of the tasks above first — accepting a risk can only skip the test, never the task.</p>
                          ) : blocking === "test_not_run" ? (
                            <p className="text-[11.5px] text-ivory/65">Task done — now run the verification test below and record the result.</p>
                          ) : null}
                        </div>
                      )}
                      {gt.verification?.test && (
                        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[12px]">
                          <div className="text-[11px] font-semibold text-cyan-200/90">Verification test</div>
                          <p className="text-ivory/85">{gt.verification.test}</p>
                          {gt.verification.pass && <p className="mt-1 text-emerald-200/85">Pass: {gt.verification.pass}</p>}
                          {gt.verification.fail && <p className="text-rose-200/85">Fail: {gt.verification.fail}</p>}
                          {(gateResults[gt.id] ?? gt.test_result) === "fail" && gt.verification.if_fail && <p className="mt-1 text-amber-100/90">{gt.verification.if_fail}</p>}
                          <div className="mt-1.5 flex gap-1.5">
                            {(["pass", "fail"] as const).map((r) => {
                              const cur = gateResults[gt.id] ?? gt.test_result ?? null;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  disabled={!!loading}
                                  onClick={() => void setGateResult(gt.id, cur === r ? null : r)}
                                  className={cx(
                                    "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                    cur === r ? (r === "pass" ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-50" : "border-rose-300/70 bg-rose-400/20 text-rose-50") : "border-white/15 text-ivory/75 hover:border-white/35",
                                  )}
                                >
                                  {r === "pass" ? "Passed" : "Failed"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="mt-1.5">
                        <Chips evidence={gt.evidence} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </Section>
          {prepItems.length > 0 && (
            <Section title="Prepare the plot">
              {prepItems.map((i) => (
                <RecCard key={i.rec.id + i.section} rec={i.rec} item={i} here="plot" />
              ))}
            </Section>
          )}
        </>
      )}

      {tab === "crops" && (
        <>
          {w.crop_suggestions.summary && <p className="text-[13px] text-ivory/80">{w.crop_suggestions.summary}</p>}
          {w.crop_suggestions.local_advice_note && (
            <Card className="border-amber-300/25">
              <div className="text-[11px] font-semibold text-amber-200">About the local advice</div>
              <p className="text-[12.5px] text-ivory/85">{w.crop_suggestions.local_advice_note}</p>
            </Card>
          )}
          <Section title="Field crops" right={<Chips evidence={w.crop_suggestions.evidence} />}>
            {w.crop_suggestions.field_crops.map((c) => (
              <CropCardView key={c.crop_id} c={c} />
            ))}
          </Section>
          {w.crop_suggestions.tree_options.length > 0 && (
            <Section title="Long-term tree options">
              {w.crop_suggestions.tree_options.map((c) => (
                <CropCardView key={c.crop_id} c={c} />
              ))}
            </Section>
          )}
          {w.crop_suggestions.trial_advice && (
            <Section title="Trial advice">
              <RecCard rec={w.crop_suggestions.trial_advice} />
            </Section>
          )}
          {w.crop_suggestions.excluded.length > 0 && (
            <Section title="Excluded for this land">
              {w.crop_suggestions.excluded.map((c) => (
                <Card key={c.crop_id}>
                  <div className="text-[13px] font-medium">{c.name}</div>
                  <Bullets items={c.cautions_triggered} tone="safety" />
                  <div className="mt-1.5">
                    <Chips evidence={c.evidence} />
                  </div>
                </Card>
              ))}
            </Section>
          )}
        </>
      )}

      {tab === "time" && (
        <>
          <Section title="Season" right={<Chips evidence={w.timeframe.evidence} />}>
            <Card>
              <p className="text-[13px] text-ivory/85">{w.timeframe.season_assumption}</p>
              {w.timeframe.buffer?.explanation && <p className="mt-1.5 text-[12.5px] text-ivory/70">{w.timeframe.buffer.explanation}</p>}
              {w.timeframe.comparison && <p className="mt-1.5 text-[12.5px] text-cyan-100/85">{w.timeframe.comparison}</p>}
            </Card>
          </Section>
          <Section title="Crop timelines">
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white/5 text-ivory/60">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Crop</th>
                    <th className="px-2 py-1.5 font-medium">Maturity</th>
                    <th className="px-2 py-1.5 font-medium">+Buffer</th>
                    <th className="px-2 py-1.5 font-medium">Total</th>
                    <th className="px-2 py-1.5 font-medium">Fit</th>
                  </tr>
                </thead>
                <tbody>
                  {w.timeframe.rows.map((r) => (
                    <tr key={r.crop_id} className={cx("border-t border-white/5", r.crop_id === crop && "bg-emerald-400/[0.06]")}>
                      <td className="px-2 py-1.5 font-medium">{r.name}</td>
                      <td className="px-2 py-1.5">{r.maturity_weeks.min}–{r.maturity_weeks.max} wk</td>
                      <td className="px-2 py-1.5">{r.buffer_weeks.min}–{r.buffer_weeks.max} wk</td>
                      <td className="px-2 py-1.5">{r.total_weeks.min}–{r.total_weeks.max} wk</td>
                      <td className="px-2 py-1.5"><Pill tone={seasonTone(r.season_fit)}>{r.season_fit.replace(/_/g, " ")}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      {tab === "plant" && (
        <>
          <Card className={readinessOk ? "border-emerald-300/30" : "border-amber-300/30"}>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Pill tone={readinessOk ? "sprout" : "amber"}>readiness: {na.planting_readiness.replace(/_/g, " ")}</Pill>
              <Pill tone={crop ? "sprout" : "muted"}>crop: {cropCard?.name ?? "not chosen"}</Pill>
              <Pill tone={view.sown ? "sprout" : "muted"}>{view.sown ? "sown" : "not sown"}</Pill>
            </div>
            {!readinessOk && <p className="mt-1.5 text-[12.5px] text-amber-100/85">The readiness gate is still open. Finish the gate tasks or accept the risk first.</p>}
            {!crop && (
              <div className="mt-2">
                <GhostButton onClick={() => setTab("crops")}>Choose a crop first</GhostButton>
              </div>
            )}
            {sowTaskItems.length === 0 && crop && !view.sown && (
              <div className="mt-2.5">
                <PrimaryButton tone="sprout" disabled={!readinessOk} onClick={sowManually}>
                  <Sprout className="h-4 w-4" /> Sow {cropCard?.name ?? "crop"} here
                </PrimaryButton>
              </div>
            )}
          </Card>
          {w.planting_method.summary && <p className="text-[13px] text-ivory/80">{w.planting_method.summary}</p>}
          <Section title="Methods" right={<Chips evidence={w.planting_method.evidence} />}>
            {w.planting_method.methods.map((r) => {
              const it = items.find((i) => i.rec.id === r.id && (i.section === "methods" || i.rec.task_id === r.task_id));
              return <RecCard key={r.id} rec={r} item={it} here={it && GROUP_STATION[it.group] === "plot" ? "plot" : undefined} />;
            })}
          </Section>
          {w.planting_method.sowing.length > 0 && (
            <Section title="Sowing">
              {w.planting_method.sowing.map((r) => {
                const it = items.find((i) => i.rec.task_id && i.rec.task_id === r.task_id);
                const gated = !readinessOk || !crop;
                return (
                  <div key={r.id} className={cx(gated && "opacity-70")}>
                    <RecCard rec={r} item={gated ? undefined : it} here={gated ? undefined : "plot"} />
                  </div>
                );
              })}
            </Section>
          )}
          {w.planting_method.water_capture.length > 0 && (
            <Section title="Water capture (see Stone-Line Terraces / Water Storage)">
              {w.planting_method.water_capture.map((r) => (
                <RecCard key={r.id} rec={r} />
              ))}
            </Section>
          )}
        </>
      )}

      {tab === "care" && (
        <>
          <Section title="Growth stage" right={<Chips evidence={w.ongoing_care.evidence} />}>
            {!view.sown ? (
              <Card>
                <p className="text-[13px] text-ivory/80">Nothing is growing yet. Sow first — the stages below are a preview.</p>
              </Card>
            ) : (
              <Card className="border-emerald-300/25">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-ivory/60">Current stage ({view.careIdx + 1}/{stages.length || 1})</div>
                    <div className="font-heading text-[15px] font-semibold">{curStage?.label ?? "—"}</div>
                  </div>
                  {view.careIdx < stages.length - 1 && (
                    <PrimaryButton tone="sprout" onClick={advanceStage}>
                      <TimerReset className="h-4 w-4" /> Tend & advance
                    </PrimaryButton>
                  )}
                  {view.stage === "harvest_ready" && <Pill tone="amber">Ready for the Harvest Point</Pill>}
                </div>
                <div className="mt-2 flex gap-1">
                  {stages.map((s, i) => (
                    <div key={s.id} className={cx("h-1.5 flex-1 rounded-full", i <= view.careIdx ? "bg-emerald-300" : "bg-white/10")} title={s.label} />
                  ))}
                </div>
              </Card>
            )}
            {w.ongoing_care.crop_basis !== "selected" && (
              <p className="text-[11.5px] text-amber-200/80">Care basis: {w.ongoing_care.crop_basis.replace(/_/g, " ")}</p>
            )}
          </Section>
          <Section title="Care stages">
            {stages.map((s, i) => (
              <Card key={s.id} className={cx(view.sown && i === view.careIdx && "border-cyan-300/40")}>
                {view.sown && i === view.careIdx && <span data-incomplete="true" className="sr-only">Current stage</span>}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-[13px]">{s.label}</span>
                  <Pill tone="muted">{s.stage.replace(/_/g, " ")}</Pill>
                </div>
                {s.timing_description && <p className="text-[12px] text-ivory/65">{s.timing_description}</p>}
                <div className="mt-1.5 grid gap-1 text-[12.5px]">
                  {s.water && <div><span className="text-cyan-200/90">Water: </span>{s.water}</div>}
                  {s.mulch && <div><span className="text-cyan-200/90">Mulch: </span>{s.mulch}</div>}
                  {s.nutrients && <div><span className="text-cyan-200/90">Nutrients: </span>{s.nutrients}</div>}
                  {s.weeds && <div><span className="text-cyan-200/90">Weeds: </span>{s.weeds}</div>}
                  {s.dry_spell && <div><span className="text-amber-200/90">Dry spell: </span>{s.dry_spell}</div>}
                </div>
                <div className="mt-1.5">
                  <Bullets items={s.actions} />
                </div>
                {s.watch_for.length > 0 && (
                  <div className="mt-1.5">
                    <div className="text-[11px] font-semibold text-amber-200/90">Watch for</div>
                    <Bullets items={s.watch_for} tone="warn" />
                  </div>
                )}
                <div className="mt-1.5">
                  <Chips evidence={s.evidence} />
                </div>
              </Card>
            ))}
          </Section>
          {w.ongoing_care.pest_watch.length > 0 && (
            <Section title="Pest watch">
              {w.ongoing_care.pest_watch.map((p) => (
                <Card key={p.id}>
                  <div className="font-medium text-[13px]">{p.title}</div>
                  <div className="mt-1 text-[11px] font-semibold text-amber-200/90">Signs</div>
                  <Bullets items={p.signs} tone="warn" />
                  <div className="mt-1 text-[11px] font-semibold text-cyan-200/90">Actions</div>
                  <Bullets items={p.actions} />
                  {p.bio_options.map((b, i) => (
                    <div key={i} className="mt-1.5 rounded-lg bg-white/[0.03] p-2 text-[12px]">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-ivory/70">{b.preparation}</div>
                      <Bullets items={b.safe_use} />
                      <Bullets items={b.cautions} tone="safety" />
                    </div>
                  ))}
                  <Bullets items={p.cautions} tone="safety" />
                  <div className="mt-1.5">
                    <Chips evidence={p.evidence} />
                  </div>
                </Card>
              ))}
            </Section>
          )}
          {w.ongoing_care.dry_spell_plan.length > 0 && (
            <Section title="Dry-spell plan (tasks at Water Storage)">
              {w.ongoing_care.dry_spell_plan.map((r) => (
                <RecCard key={r.id} rec={r} />
              ))}
            </Section>
          )}
        </>
      )}
    </GlassPanel>
  );
}
