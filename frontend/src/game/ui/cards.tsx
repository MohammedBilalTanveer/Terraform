// One-card-at-a-time quest UI: task card, verification-test card, TERRA completion message.
// All task/test text comes from the plan (KB); only the wrapper wording is UI copy.
import { useState } from "react";
import { CheckCircle2, Circle, Compass, Lock, ShieldAlert, SkipForward } from "lucide-react";
import DialogueBox, { type Choice } from "../../intro/Dialogue";
import { useTerraform } from "../../store/terraformStore";
import type { CheckCard } from "../../types/terraform";
import { checkPhase, checkState } from "../checks";
import { PLACE_INFO } from "../places";
import { useGame, type LastDone } from "../gameStore";
import { alternativesOf, canSkip, isDoable, type QuestStep } from "../planData";
import { useQuest } from "../useQuest";
import { stationById, type StationId } from "../worldConfig";
import { VERB } from "./RecCard";
import { pinStep } from "./pin";

export { pinStep };
import { Bullets, Card, Chips, GhostButton, Pill, cx } from "./kit";

// ---------------------------------------------------------------------------------------------
/** Play the farming animation for a task, tick it in the plan, then reopen the station with TERRA's message. */
export function runTask(step: QuestStep, station: StationId) {
  const item = step.item;
  const id = item?.rec.task_id;
  if (!item || !id) return;
  const game = useGame.getState();
  const tf = useTerraform.getState();
  game.runAction({ kind: item.action, label: step.label, station, fast: tf.reduceMotion }, async () => {
    await useTerraform.getState().toggleTask(id);
    const g2 = useGame.getState();
    if (useTerraform.getState().completedTasks.includes(id)) {
      g2.setLastDone({ id, label: step.label, station, phase: step.phase, sessionKey: useTerraform.getState().sessionId });
      if (g2.focusTaskId === id) g2.setFocusTask(null);
    }
    g2.setOverlay(station);
  });
}

export function announceDone(label: string, station: StationId, phase: string, id: string, note?: string) {
  useGame.getState().setLastDone({ id, label, station, phase, sessionKey: useTerraform.getState().sessionId, note });
}

/** "Skip this step": local only (never calls the backend / toggleTask, never changes a gate). */
export function skipStepById(id: string, label?: string) {
  useTerraform.getState().skipStep(id);
  const g = useGame.getState();
  if (g.pinnedId === id) g.setPinned(null);
  if (g.focusTaskId === id) g.setFocusTask(null);
  if (g.beaconOff === id) g.setBeaconOff(null);
  if (label) g.say(`Skipped: ${label}. It stays in your list under "Skipped".`, 4500);
}

/** Bring a skipped step back and make it the current one. */
export function unskipAndPin(step: QuestStep, announce = false) {
  useTerraform.getState().unskipStep(step.id);
  pinStep({ ...step, skipped: false }, announce);
}

/** Clearly visible secondary action on every optional card. */
export function SkipButton({ id, label, text = "Skip this step" }: { id: string; label?: string; text?: string }) {
  return (
    <button
      type="button"
      onClick={() => skipStepById(id, label)}
      className="tf-keep inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/[0.05] px-3 text-[13.5px] font-medium text-ivory/90 hover:border-cyan-300/50 hover:text-cyan-100"
    >
      <SkipForward className="h-4 w-4" aria-hidden /> {text}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
export function SuggestedNext({ current, here }: { current?: QuestStep | null; here: StationId }) {
  const { quest } = useQuest();
  if (!quest || (current && quest.id === current.id)) return null;
  const elsewhere = quest.station !== here;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.05] px-2.5 py-1.5 text-[12px] text-cyan-100/90">
      <Compass className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
      <span className="min-w-0 flex-1">
        Suggested next: <span className="font-medium">{quest.label}</span>
        {elsewhere && <span className="text-ivory/55"> at {stationById(quest.station).name}</span>}
      </span>
      <GhostButton
        onClick={() => {
          pinStep(quest, elsewhere);
          if (elsewhere) useGame.getState().setOverlay(null);
        }}
      >
        Guide me there
      </GhostButton>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
export function StationChecklist({ steps, currentId, onPick, title, defaultOpen = false, pickDone = false }: { steps: QuestStep[]; currentId?: string | null; onPick?: (id: string) => void; title: string; defaultOpen?: boolean; pickDone?: boolean }) {
  if (steps.length === 0) return null;
  const done = steps.filter((s) => s.done).length;
  const skipped = steps.filter((s) => s.skipped).length;
  return (
    <details open={defaultOpen} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5">
      <summary className="min-h-9 cursor-pointer text-[12px] font-medium text-ivory/75">
        {title} ({done}/{steps.length} done{skipped > 0 ? ` · ${skipped} skipped` : ""})
      </summary>
      <ul className="mb-1 mt-1 space-y-0.5">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              disabled={(s.done && !pickDone) || s.blocked || s.skipped || !onPick}
              onClick={() => onPick?.(s.id)}
              className={cx("flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-[12px]", s.id === currentId && "bg-cyan-400/10", !s.done && !s.blocked && !s.skipped && onPick && "hover:bg-white/5")}
            >
              {s.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : s.skipped ? <SkipForward className="h-3.5 w-3.5 shrink-0 text-ivory/45" /> : s.blocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300/80" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-ivory/40" />}
              <span className={cx("min-w-0 flex-1 truncate", s.done && "text-ivory/45 line-through", s.skipped && "text-ivory/50", s.blocked && !s.done && !s.skipped && "text-ivory/50")}>{s.label}</span>
              {s.skipped ? (
                <span className="shrink-0 rounded border border-white/15 bg-white/5 px-1 text-[10px] text-ivory/65">Skipped</span>
              ) : (
                s.optional &&
                !s.done && (
                  <span className="shrink-0 rounded border border-white/15 bg-white/5 px-1 text-[10px] text-ivory/65">{s.kind === "tip" ? "Good to know" : s.alternative ? "Alternative" : "Optional"}</span>
                )
              )}
              {s.blocked && !s.done && !s.skipped && s.blockedText && <span className="shrink-0 text-[10px] text-amber-200/70">{s.blockedText}</span>}
            </button>
            {s.skipped && (
              <button
                type="button"
                onClick={() => {
                  unskipAndPin(s);
                  onPick?.(s.id);
                }}
                className="tf-keep min-h-9 shrink-0 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2 text-[11.5px] font-medium text-cyan-100 hover:bg-cyan-400/20"
              >
                Do it now
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------------------------------------
/** The task card: why it matters, how (numbered), amounts, safety, limitations, evidence and ONE big button. */
export function TaskCard({ step, station, alts, onPickAlt }: { step: QuestStep; station: StationId; alts?: QuestStep[]; onPickAlt?: (id: string) => void }) {
  const rec = step.item!.rec;
  const loading = useTerraform((s) => s.loading);
  const busy = useGame((s) => !!s.action);
  const verb = VERB[step.item!.action];
  return (
    <div className="space-y-3.5">
      <div>
        {step.optional && !step.done && (
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="violet">{step.alternative ? "Alternative — also fine" : step.longTerm ? "Optional — long-term" : "Optional extra"}</Pill>
            {!step.alternative && <Pill tone={rec.confidence === "high" ? "sprout" : rec.confidence === "medium" ? "amber" : "coral"}>confidence: {rec.confidence}</Pill>}
          </div>
        )}
        <h3 className="font-heading text-[19px] font-semibold leading-snug">{step.label}</h3>
        {rec.title && rec.title !== step.label && <div className="text-[12px] text-ivory/55">{rec.title}</div>}
      </div>
      {rec.explanation && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Why it matters</div>
          <p className="text-[13.5px] leading-relaxed text-ivory/90">{rec.explanation}</p>
        </section>
      )}
      {rec.actions?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">How</div>
          <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
            {rec.actions.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/20 font-display text-[10px] text-cyan-100">{i + 1}</span>
                <span className="text-ivory/90">{a}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {rec.everyday_amounts?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Everyday amounts</div>
          <Bullets items={rec.everyday_amounts} />
        </section>
      )}
      {rec.safety_notes?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-rose-200/90">Safety</div>
          <Bullets items={rec.safety_notes} tone="safety" />
        </section>
      )}
      {rec.limitations?.length > 0 && (
        // optional extras keep every KB caution visible up-front
        <details open={step.optional && !step.alternative} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1">
          <summary className="min-h-9 cursor-pointer text-[12px] text-ivory/70">Limitations{step.optional && !step.alternative ? " & cautions" : ""}</summary>
          <div className="pb-1.5">
            <Bullets items={rec.limitations} tone="warn" />
          </div>
        </details>
      )}
      <Chips evidence={rec.evidence} />
      {alts && alts.length > 0 && onPickAlt && (
        <div className="space-y-2">
          {alts.map((a) => (
            <div key={a.id} className="rounded-xl border border-violet-300/25 bg-violet-400/[0.06] p-2.5">
              <div className="text-[11px] font-semibold text-violet-200">Another way to meet this step</div>
              <div className="text-[13px] font-medium text-ivory">{a.label}</div>
              {a.item?.rec.explanation && <p className="line-clamp-3 text-[12px] leading-snug text-ivory/70">{a.item.rec.explanation}</p>}
              <button type="button" onClick={() => onPickAlt(a.id)} className="tf-keep mt-1.5 min-h-11 rounded-lg border border-violet-300/40 bg-violet-400/15 px-3 text-[13px] font-medium text-violet-50 hover:bg-violet-400/25">
                Show that option
              </button>
            </div>
          ))}
        </div>
      )}
      {/* the primary action stays visible at the bottom of the scrolling card */}
      <div className="tf-sticky-cta space-y-2">
        <button
          type="button"
          disabled={busy || loading === "progress"}
          onClick={() => runTask(step, station)}
          className="tf-keep min-h-12 w-full rounded-xl bg-emerald-400/90 px-4 py-3 text-[15px] font-semibold text-[#06101f] shadow-[0_0_24px_rgba(52,211,153,0.25)] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verb} — mark complete
        </button>
        {canSkip(step) && <SkipButton id={step.id} label={step.label} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
/** Plan advice that has no task ("Good to know"): read it, then "Got it" or "Skip". Both just hide it from the open list. */
export function TipCard({ step }: { step: QuestStep }) {
  const rec = step.item!.rec;
  return (
    <div className="space-y-3.5">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Pill tone="violet">Good to know — optional</Pill>
          <Pill tone={rec.confidence === "high" ? "sprout" : rec.confidence === "medium" ? "amber" : "coral"}>confidence: {rec.confidence}</Pill>
        </div>
        <h3 className="font-heading text-[19px] font-semibold leading-snug">{step.label}</h3>
      </div>
      {rec.explanation && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Why it matters</div>
          <p className="text-[13.5px] leading-relaxed text-ivory/90">{rec.explanation}</p>
        </section>
      )}
      {rec.actions?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">How</div>
          <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
            {rec.actions.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/20 font-display text-[10px] text-cyan-100">{i + 1}</span>
                <span className="text-ivory/90">{a}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {rec.everyday_amounts?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Everyday amounts</div>
          <Bullets items={rec.everyday_amounts} />
        </section>
      )}
      {rec.safety_notes?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-rose-200/90">Safety</div>
          <Bullets items={rec.safety_notes} tone="safety" />
        </section>
      )}
      {rec.limitations?.length > 0 && (
        <details open className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1">
          <summary className="min-h-9 cursor-pointer text-[12px] text-ivory/70">Limitations &amp; cautions</summary>
          <div className="pb-1.5">
            <Bullets items={rec.limitations} tone="warn" />
          </div>
        </details>
      )}
      <Chips evidence={rec.evidence} />
      <div className="tf-sticky-cta grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => skipStepById(step.id)}
          className="tf-keep min-h-12 rounded-xl bg-emerald-400/90 px-3 py-3 text-[15px] font-semibold text-[#06101f] hover:bg-emerald-300"
        >
          Got it
        </button>
        <SkipButton id={step.id} text="Skip" />
      </div>
    </div>
  );
}

/** The right card for a quest step that is a plan task or plan advice. */
export function StepCard({ step, station, alts, onPickAlt }: { step: QuestStep; station: StationId; alts?: QuestStep[]; onPickAlt?: (id: string) => void }) {
  return step.kind === "tip" ? <TipCard step={step} /> : <TaskCard step={step} station={station} alts={alts} onPickAlt={onPickAlt} />;
}

// ---------------------------------------------------------------------------------------------
/** A gate's own verification test as a card: what to do, what PASS / FAIL look like, Passed / Failed. */
export function TestCard({ step }: { step: QuestStep }) {
  const plan = useTerraform((s) => s.plan);
  const gateResults = useTerraform((s) => s.gateResults);
  const setGateResult = useTerraform((s) => s.setGateResult);
  const acceptRisk = useTerraform((s) => s.acceptRisk);
  const loading = useTerraform((s) => s.loading);
  const runAction = useGame((s) => s.runAction);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const [confirm, setConfirm] = useState(false);
  const gate = plan?.workflow.next_action.readiness_gate.find((g) => g.id === step.gateId);
  if (!gate || !gate.verification) return null;
  const v = gate.verification;
  const cur = gateResults[gate.id] ?? gate.test_result ?? null;
  const taskDone = gate.task_done ?? true;
  const canAccept = gate.can_accept_risk ?? (taskDone && cur !== "pass" && !gate.accepted_risk);

  const pass = () =>
    runAction({ kind: "inspect", label: "Recording the test result", station: "plot", fast: true }, async () => {
      await setGateResult(gate.id, "pass");
      const ok = (useTerraform.getState().gateResults[gate.id] ?? "") === "pass";
      if (ok) announceDone(`Test passed: ${gate.label}`, "plot", "readiness", step.id);
      useGame.getState().setOverlay("plot");
    });

  return (
    <div className="space-y-3.5">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Pill tone="violet">Verification test</Pill>
          {cur === "fail" && <Pill tone="coral">last result: failed</Pill>}
        </div>
        <h3 className="font-heading text-[19px] font-semibold leading-snug">{gate.label}</h3>
        {gate.detail && <p className="mt-1 text-[12.5px] text-ivory/65">{gate.detail}</p>}
      </div>
      <section>
        <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">The test</div>
        <p className="text-[13.5px] leading-relaxed text-ivory/90">{v.test}</p>
      </section>
      <div className="grid gap-2 sm:grid-cols-2">
        {v.pass && (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/[0.05] p-2.5">
            <div className="text-[11px] font-semibold text-emerald-200">PASS looks like</div>
            <p className="text-[12.5px] text-ivory/85">{v.pass}</p>
          </div>
        )}
        {v.fail && (
          <div className="rounded-lg border border-rose-300/25 bg-rose-400/[0.05] p-2.5">
            <div className="text-[11px] font-semibold text-rose-200">FAIL looks like</div>
            <p className="text-[12.5px] text-ivory/85">{v.fail}</p>
          </div>
        )}
      </div>
      {cur === "fail" && v.if_fail && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-400/[0.07] p-2.5">
          <div className="text-[11px] font-semibold text-amber-200">If it failed</div>
          <p className="text-[12.5px] text-amber-50/90">{v.if_fail}</p>
          <p className="mt-1 text-[11.5px] text-ivory/60">Fix it, then run the test again.</p>
        </div>
      )}
      <Chips evidence={gate.evidence} />
      <div className="tf-sticky-cta grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!!loading}
          onClick={pass}
          className="min-h-12 rounded-xl bg-emerald-400/90 px-3 py-3 text-[15px] font-semibold text-[#06101f] hover:bg-emerald-300 disabled:opacity-50"
        >
          Passed
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => void setGateResult(gate.id, "fail")}
          className={cx(
            "min-h-12 rounded-xl border px-3 py-3 text-[15px] font-semibold disabled:opacity-50",
            cur === "fail" ? "border-rose-300/70 bg-rose-400/25 text-rose-50" : "border-rose-300/40 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20",
          )}
        >
          Failed
        </button>
      </div>
      {canAccept && (
        <div className="text-[11.5px]">
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2 text-amber-100">
              <ShieldAlert className="h-3.5 w-3.5" /> Skip this test and record an open risk?
              <GhostButton
                onClick={() =>
                  runAction({ kind: "inspect", label: "Recording the accepted risk", station: "plot", fast: reduceMotion }, async () => {
                    await acceptRisk(gate.id);
                    announceDone(`Risk accepted: ${gate.label}`, "plot", "readiness", step.id);
                    useGame.getState().setOverlay("plot");
                  })
                }
              >
                Yes, accept risk
              </GhostButton>
              <GhostButton onClick={() => setConfirm(false)}>Cancel</GhostButton>
            </div>
          ) : (
            <button type="button" className="min-h-9 text-amber-200/90 underline" onClick={() => setConfirm(true)}>
              Accept risk (skip this test)…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
const PHASE_MSG: Record<string, string> = {
  prepare: "The preparation work is done.",
  readiness: "The readiness checks are next.",
  crop: "The land is ready — now choose a crop.",
  plant: "Time to plant.",
  care: "Planted. Now tend the crop through its care stages.",
  harvest: "The crop is ready — time to harvest.",
};

/** TERRA's typewriter message after a step is completed: "Done: …" then "Next: … — at …" with choices. */
export function CompletionFlow({ station, onStay }: { station: StationId; onStay: () => void }) {
  const lastDone = useGame((s) => s.lastDone) as LastDone | null;
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const { steps, quest, sessionId } = useQuest();
  const [line, setLine] = useState(0);
  if (!lastDone) return null;

  const herePending = steps.filter((s) => s.station === station && isDoable(s) && !s.optional);
  const next = quest;
  const nextAt = next ? stationById(next.station).name : null;
  const here = !!next && next.station === station;
  let second: string;
  let choices: Choice[] | undefined;
  if (!next) {
    second = "Everything in the plan is done for now. Well done, survivor.";
    choices = [{ label: "Close", value: "stay" }];
  } else if (here) {
    const phase = next.phase !== lastDone.phase ? `${PHASE_MSG[next.phase] ?? ""} ` : "";
    second = `${phase}Next: ${next.label} — right here at ${nextAt}.`;
    choices = [
      { label: "Continue", value: "continue" },
      { label: "Stay here", value: "stay" },
    ];
  } else if (herePending.length === 0) {
    const phase = next.phase !== lastDone.phase ? `${PHASE_MSG[next.phase] ?? ""} ` : "";
    second = `All done here — ${phase}now go to ${nextAt} to ${next.label}.`;
    choices = [
      { label: `Continue — head to ${nextAt}`, value: "go" },
      { label: "Stay here", value: "stay" },
    ];
  } else {
    second = `Next: ${next.label} — at ${nextAt}.`;
    choices = [
      { label: `Continue — head to ${nextAt}`, value: "go" },
      { label: "Stay here", value: "stay" },
    ];
  }
  // OPTIONAL OFFER: when the step that follows the one just finished (in quest order) is optional, TERRA offers it —
  // "Do it now" or "Skip this step". Skipped / done / locked optional steps are passed over; a required step ends the search.
  const doneIdx = steps.findIndex((s) => s.id === lastDone.id);
  let offer: QuestStep | undefined;
  if (doneIdx >= 0) {
    for (let j = doneIdx + 1; j < steps.length; j++) {
      const s = steps[j];
      if (s.done || s.skipped) continue;
      if (s.optional && s.blocked) continue;
      if (s.optional) offer = s;
      break;
    }
  }
  const offerLine = offer ? `Optional: ${offer.label.replace(/^optional:\s*/i, "")}${offer.station !== station ? ` (at ${stationById(offer.station).name})` : ""} — do it now, or skip this step?` : null;
  const lines = [`✔ Done: ${lastDone.label.replace(/\.$/, "")}.`, ...(lastDone.note ? [lastDone.note] : []), ...(offerLine ? [offerLine] : []), second];
  const last = lines.length - 1;
  const offerIdx = offerLine ? last - 1 : -1;
  const text = lines[Math.min(line, last)];
  const offerChoices: Choice[] = [
    { label: "Do it now", value: "offer-now" },
    { label: "Skip this step", value: "offer-skip" },
  ];
  const finish = (v: string) => {
    const g = useGame.getState();
    if (v === "offer-skip" && offer) {
      // the next optional step (if any) is offered right away, otherwise TERRA moves on to what comes next
      skipStepById(offer.id);
      return;
    }
    if (v === "offer-now" && offer) {
      pinStep(offer, offer.station !== station);
      if (offer.station !== station) g.setOverlay(null);
      else g.setLastDone(null);
      return;
    }
    if (v === "go" && next) {
      pinStep(next);
      g.setOverlay(null); // also clears the message
      return;
    }
    g.setLastDone(null);
    if (v === "stay") onStay();
  };
  // a message from a previous season/session never shows
  if (lastDone.sessionKey !== sessionId) return null;
  return (
    <DialogueBox
      speaker="terra"
      text={text}
      choices={line === offerIdx ? offerChoices : line >= last ? choices : undefined}
      onNext={() => setLine((n) => Math.min(n + 1, last))}
      onChoice={finish}
      reduceMotion={reduceMotion}
      autoAdvanceMs={null}
    />
  );
}

// ---------------------------------------------------------------------------------------------
const CHECK_PHASE_TO_QUEST = { diagnose: "prepare", pre_plant: "plant", post_sow: "care" } as const;

/** A no-lab diagnostic check as a card: purpose, numbered KB steps, safety, outcome buttons, "couldn't do this". */
export function CheckCardView({ check, station, offerSkipAll = false }: { check: CheckCard; station: StationId; offerSkipAll?: boolean }) {
  const outcomes = useTerraform((st) => st.checkOutcomes);
  const unable = useTerraform((st) => st.unableChecks);
  const setCheckOutcome = useTerraform((st) => st.setCheckOutcome);
  const setCheckUnable = useTerraform((st) => st.setCheckUnable);
  const sessionId = useTerraform((st) => st.sessionId);
  const loading = useTerraform((st) => st.loading);
  const updateFarm = useGame((st) => st.updateFarm);
  const runAction = useGame((st) => st.runAction);
  const busy = useGame((st) => !!st.action);
  const state = checkState(check, outcomes, unable);
  const qphase = CHECK_PHASE_TO_QUEST[checkPhase(check)];
  const stepId = `check:${check.id}`;

  const record = (outcomeId: string) =>
    runAction({ kind: "inspect", label: `Recording: ${check.title}`, station, fast: true }, async () => {
      await setCheckOutcome(check.id, outcomeId);
      const o = check.possible_outcomes.find((x) => x.outcome_id === outcomeId);
      announceDone(`${check.title}${o ? ` — ${o.label}` : ""}`, station, qphase, stepId, o?.interpretation || undefined);
      useGame.getState().setOverlay(station);
    });
  const cant = () =>
    runAction({ kind: "inspect", label: "Noting that you could not do this", station, fast: true }, async () => {
      await setCheckUnable(check.id, true);
      announceDone(`Skipped: ${check.title}`, station, qphase, stepId, "No problem — checks are recommended, never required. TERRA treats this as unknown.");
      useGame.getState().setOverlay(station);
    });
  const skipAll = () => {
    updateFarm(sessionId, { skipChecks: true });
    announceDone("Skipped the remaining checks", station, qphase, "skip-checks", "They stay available at their locations whenever you want to do them.");
  };

  return (
    <div className="space-y-3.5">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Pill tone="cyan">No-lab check</Pill>
          {check.weak_evidence && <Pill tone="amber">Rough clue — not a lab/pH reading</Pill>}
          {state.unable && <Pill tone="muted">skipped</Pill>}
        </div>
        <h3 className="font-heading text-[19px] font-semibold leading-snug">{check.title}</h3>
      </div>
      {check.purpose && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Why it matters</div>
          <p className="text-[13.5px] leading-relaxed text-ivory/90">{check.purpose}</p>
        </section>
      )}
      {check.actions?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">How</div>
          <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
            {check.actions.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/20 font-display text-[10px] text-cyan-100">{i + 1}</span>
                <span className="text-ivory/90">{a}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {check.everyday_amounts?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Everyday amounts</div>
          <Bullets items={check.everyday_amounts} />
        </section>
      )}
      {check.safety_notes?.length > 0 && (
        <section>
          <div className="mb-1 font-display text-[10px] uppercase tracking-[0.22em] text-rose-200/90">Safety</div>
          <Bullets items={check.safety_notes} tone="safety" />
        </section>
      )}
      {check.limitations?.length > 0 && (
        <details className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1">
          <summary className="min-h-9 cursor-pointer text-[12px] text-ivory/70">Limitations</summary>
          <div className="pb-1.5">
            <Bullets items={check.limitations} tone="warn" />
          </div>
        </details>
      )}
      <Chips evidence={check.evidence} />
      <section>
        <div className="mb-1.5 font-display text-[10px] uppercase tracking-[0.22em] text-cyan-200/90">What did you find?</div>
        <div className="flex flex-col gap-2">
          {check.possible_outcomes.map((o) => (
            <button
              key={o.outcome_id}
              type="button"
              disabled={busy || !!loading}
              onClick={() => record(o.outcome_id)}
              className={cx(
                "tf-keep min-h-12 rounded-xl border px-3 py-2.5 text-left text-[14px] font-medium transition disabled:opacity-50",
                state.outcome === o.outcome_id ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-50" : "border-white/15 bg-white/[0.04] text-ivory hover:border-cyan-300/50",
              )}
            >
              {o.label}
              {state.outcome === o.outcome_id && o.interpretation && <span className="mt-0.5 block text-[12.5px] font-normal text-cyan-100/85">{o.interpretation}</span>}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || !!loading || state.unable}
            onClick={cant}
            className="tf-keep min-h-12 rounded-xl border border-dashed border-white/25 px-3 py-2.5 text-left text-[13.5px] text-ivory/75 hover:border-white/45 disabled:opacity-50"
          >
            I couldn't do this
          </button>
        </div>
      </section>
      {!state.done && <SkipButton id={stepId} label={check.title} />}
      {offerSkipAll && (
        <button type="button" onClick={skipAll} className="min-h-10 text-[12px] text-cyan-200 underline hover:text-cyan-100">
          Skip the remaining checks
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
/** "Why you're here" line at the top of every location's panel. */
export function WhyLine({ station }: { station: StationId }) {
  const info = PLACE_INFO[station];
  return (
    <div className="rounded-xl border border-amber-300/25 bg-amber-400/[0.06] px-3 py-2">
      <div className="font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">Why you're here</div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-ivory/85">{info.why}</p>
    </div>
  );
}

/** A location with nothing to do right now: what it is for, what happens next, and a way to the next step. */
export function EmptyPlace({ station, title, body }: { station: StationId; title?: string; body?: string }) {
  const { quest } = useQuest();
  const info = PLACE_INFO[station];
  const elsewhere = quest && quest.station !== station;
  return (
    <Card className="space-y-3">
      <div className="font-heading text-[16px] font-semibold">{title ?? "Nothing to do here right now"}</div>
      {body && <p className="text-[13px] leading-relaxed text-ivory/80">{body}</p>}
      <p className="text-[12.5px] leading-relaxed text-ivory/65">
        <span className="text-ivory/85">What this place is for:</span> {info.short}. You will use it later in the plan.
      </p>
      {quest ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-cyan-100/90">
            Next: <span className="font-medium">{quest.label}</span>
            {elsewhere && <span className="text-ivory/55"> — at {stationById(quest.station).name}</span>}
          </p>
          {elsewhere && (
            <button
              type="button"
              onClick={() => {
                pinStep(quest);
                useGame.getState().setOverlay(null);
              }}
              className="tf-keep min-h-11 rounded-xl bg-cyan-400/90 px-4 text-[14px] font-semibold text-[#06101f] hover:bg-cyan-300"
            >
              Guide me there
            </button>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-ivory/65">Nothing else is waiting in the plan.</p>
      )}
    </Card>
  );
}
