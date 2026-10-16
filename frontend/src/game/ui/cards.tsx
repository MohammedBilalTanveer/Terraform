// One-card-at-a-time quest UI: task card, verification-test card, TERRA completion message.
// All task/test text comes from the plan (KB); only the wrapper wording is UI copy.
import { useState } from "react";
import { CheckCircle2, Circle, Compass, Lock, ShieldAlert } from "lucide-react";
import DialogueBox, { type Choice } from "../../intro/Dialogue";
import { useTerraform } from "../../store/terraformStore";
import { useGame, type LastDone } from "../gameStore";
import type { QuestStep } from "../planData";
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

export function announceDone(label: string, station: StationId, phase: string, id: string) {
  useGame.getState().setLastDone({ id, label, station, phase, sessionKey: useTerraform.getState().sessionId });
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
export function StationChecklist({ steps, currentId, onPick, title, defaultOpen = false }: { steps: QuestStep[]; currentId?: string | null; onPick?: (id: string) => void; title: string; defaultOpen?: boolean }) {
  if (steps.length === 0) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <details open={defaultOpen} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5">
      <summary className="min-h-9 cursor-pointer text-[12px] font-medium text-ivory/75">
        {title} ({done}/{steps.length} done)
      </summary>
      <ul className="mb-1 mt-1 space-y-0.5">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={s.done || s.blocked || !onPick}
              onClick={() => onPick?.(s.id)}
              className={cx("flex min-h-9 w-full items-center gap-2 rounded-md px-1 text-left text-[12px]", s.id === currentId && "bg-cyan-400/10", !s.done && !s.blocked && onPick && "hover:bg-white/5")}
            >
              {s.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : s.blocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300/80" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-ivory/40" />}
              <span className={cx("min-w-0 flex-1 truncate", s.done && "text-ivory/45 line-through", s.blocked && !s.done && "text-ivory/50")}>{s.label}</span>
              {s.blocked && !s.done && s.blockedText && <span className="shrink-0 text-[10px] text-amber-200/70">{s.blockedText}</span>}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------------------------------------
/** The task card: why it matters, how (numbered), amounts, safety, limitations, evidence and ONE big button. */
export function TaskCard({ step, station }: { step: QuestStep; station: StationId }) {
  const rec = step.item!.rec;
  const loading = useTerraform((s) => s.loading);
  const busy = useGame((s) => !!s.action);
  const verb = VERB[step.item!.action];
  return (
    <div className="space-y-3.5">
      <div>
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
        <details className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1">
          <summary className="min-h-9 cursor-pointer text-[12px] text-ivory/70">Limitations</summary>
          <div className="pb-1.5">
            <Bullets items={rec.limitations} tone="warn" />
          </div>
        </details>
      )}
      <Chips evidence={rec.evidence} />
      {/* the primary action stays visible at the bottom of the scrolling card */}
      <div className="tf-sticky-cta">
        <button
          type="button"
          disabled={busy || loading === "progress"}
          onClick={() => runTask(step, station)}
          className="tf-keep min-h-12 w-full rounded-xl bg-emerald-400/90 px-4 py-3 text-[15px] font-semibold text-[#06101f] shadow-[0_0_24px_rgba(52,211,153,0.25)] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verb} — mark complete
        </button>
      </div>
    </div>
  );
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

  const herePending = steps.filter((s) => s.station === station && !s.done && !s.blocked && !s.optional);
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
  const text = line === 0 ? `✔ Done: ${lastDone.label.replace(/\.$/, "")}.` : second;
  const finish = (v: string) => {
    const g = useGame.getState();
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
      choices={line === 1 ? choices : undefined}
      onNext={() => setLine(1)}
      onChoice={finish}
      reduceMotion={reduceMotion}
      autoAdvanceMs={null}
    />
  );
}
