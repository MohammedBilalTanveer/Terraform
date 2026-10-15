import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, CircleCheck, CircleX, Compass, Hourglass, FlaskConical, ListChecks, Lock, LockOpen, RotateCcw, ShieldAlert, TriangleAlert, X } from "lucide-react";
import type { GateItem, Recommendation } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import ConfirmDialog from "../../components/ConfirmDialog";
import EvidenceChips from "../../components/EvidenceChips";
import { Spinner } from "../../components/LoadingAndError";
import { Badge, BulletList, Panel, SectionTitle, arr, cx, humanize } from "../../components/ui";
import { taskLabelMap } from "../../components/workflow";
import { NeedPlan } from "./common";

const READINESS = {
  ready: { label: "Ready to plant", tone: "from-sprout/30 to-cyan/15", text: "text-emerald-100", icon: CircleCheck },
  ready_with_accepted_risk: { label: "Ready — with accepted risk", tone: "from-amber/25 to-coral/10", text: "text-amber-100", icon: ShieldAlert },
  not_ready: { label: "Not ready to plant yet", tone: "from-coral/25 to-terracotta/10", text: "text-rose-100", icon: Lock },
} as const;

export default function NextActionStep() {
  const plan = useTerraform((s) => s.plan);
  const acceptRisk = useTerraform((s) => s.acceptRisk);
  const [confirm, setConfirm] = useState<GateItem | null>(null);
  if (!plan) return <NeedPlan />;
  const na = plan.workflow.next_action;
  const labels = taskLabelMap(plan);
  const gateTasks: Record<string, Recommendation> = {};
  for (const r of arr(na.gate_tasks)) if (r.task_id) gateTasks[r.task_id] = r;
  const r = READINESS[na.planting_readiness] ?? READINESS.not_ready;
  const Icon = r.icon;
  const gates = arr(na.readiness_gate);
  const satisfiedCount = gates.filter((g) => g.satisfied || g.accepted_risk).length;
  const withTests = gates.filter((g) => g.verification).length;

  return (
    <div className="grid gap-5">
      <Panel className="hero-ring relative overflow-hidden p-6">
        <span className={cx("absolute inset-0 bg-gradient-to-br opacity-90", r.tone)} aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5">
          <motion.span
            key={na.planting_readiness}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-midnight/50"
          >
            <Icon className={cx("h-8 w-8", r.text)} aria-hidden />
          </motion.span>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Planting readiness</div>
            <div className={cx("font-display text-2xl font-bold tracking-wide", r.text)} role="status">{r.label}</div>
            <div className="mt-1 text-sm text-ivory/75">{satisfiedCount}/{gates.length} gate items satisfied or accepted</div>
          </div>
        </div>
        {na.next_best_action && (
          <div className="relative mt-5 rounded-xl border border-white/12 bg-midnight/50 p-4">
            <div className="eyebrow mb-1 flex items-center gap-1.5 !text-cyan-100"><Compass className="h-3.5 w-3.5" aria-hidden /> Next best action</div>
            <p className="text-[1.02rem] leading-relaxed text-ivory">{na.next_best_action}</p>
          </div>
        )}
        {arr(na.blocked_until).length > 0 && (
          <div className="relative mt-4">
            <div className="eyebrow mb-2">Blocked until</div>
            <BulletList items={na.blocked_until} tone="coral" />
          </div>
        )}
      </Panel>

      <section aria-labelledby="gate-title">
        <SectionTitle
          icon={<Lock className="h-4 w-4" aria-hidden />}
          eyebrow="Must pass before planting"
          title={<span id="gate-title">Readiness gate</span>}
          right={withTests > 0 ? <Badge tone="violet" icon={<FlaskConical className="h-3 w-3" aria-hidden />}>{withTests} empirical tests</Badge> : undefined}
        />
        {withTests > 0 && (
          <p className="mb-3 text-sm text-mist">
            Each item clears only when its task is done <strong className="text-ivory">and</strong> its hands-and-eyes test passes.
          </p>
        )}
        <ul className="grid gap-3">
          {gates.map((g) => (
            <GateCard key={g.id} gate={g} labels={labels} gateTasks={gateTasks} onAcceptRisk={() => setConfirm(g)} />
          ))}
        </ul>
      </section>

      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={na.evidence} />
      </div>

      <ConfirmDialog
        open={!!confirm}
        title="Skip this test and accept the risk?"
        confirmLabel="Accept risk"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void acceptRisk(confirm.id);
          setConfirm(null);
        }}
      >
        {confirm && (
          <>
            <p className="font-heading font-semibold text-ivory">{confirm.label}</p>
            {confirm.detail && <p>{confirm.detail}</p>}
            {confirm.verification?.fail && (
              <p><span className="text-ivory">If this fails: </span>{confirm.verification.if_fail || confirm.verification.fail}</p>
            )}
            <p className="flex items-start gap-2 text-amber-100">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              The task is done but the test has not passed. Accepting skips the test only — the risk stays listed as unresolved in your summary.
            </p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

const BLOCKING: Record<string, { label: string; tone: "stone" | "amber" | "coral" }> = {
  task_not_done: { label: "Waiting on task", tone: "stone" },
  test_not_run: { label: "Test not run yet", tone: "amber" },
  test_failed: { label: "Test failed", tone: "coral" },
};

function GateCard({
  gate: g,
  labels,
  gateTasks,
  onAcceptRisk,
}: {
  gate: GateItem;
  labels: Record<string, string>;
  gateTasks: Record<string, Recommendation>;
  onAcceptRisk: () => void;
}) {
  const completed = useTerraform((s) => s.completedTasks);
  const gateResults = useTerraform((s) => s.gateResults ?? {});
  const toggleTask = useTerraform((s) => s.toggleTask);
  const setGateResult = useTerraform((s) => s.setGateResult);
  const loading = useTerraform((s) => s.loading);
  const [pending, setPending] = useState<string | null>(null);

  const tasks = arr(g.satisfied_by_tasks);
  const taskDone = typeof g.task_done === "boolean" ? g.task_done : tasks.length === 0 || tasks.some((t) => completed.includes(t));
  const v = g.verification ?? null;
  // Store holds the user's latest choice (optimistic); the API's test_result is the fallback.
  const result = gateResults[g.id] ?? g.test_result ?? null;
  const met = g.satisfied;
  const risk = g.accepted_risk;
  const failed = result === "fail";
  // v1.3: accepting a risk only waives the TEST, and only once the task is done.
  const canAccept = typeof g.can_accept_risk === "boolean" ? g.can_accept_risk : taskDone && !!v && result !== "pass" && !risk;
  const blocking = g.blocking_reason ? BLOCKING[g.blocking_reason] : null;

  const run = async (key: string, fn: () => Promise<void>) => {
    setPending(key);
    await fn();
    setPending(null);
  };

  return (
    <li
      data-incomplete={!met && !risk ? "true" : undefined}
      className={cx(
        "glass rounded-2xl p-4 sm:p-5",
        met && "!border-sprout/30",
        risk && "!border-amber/35",
        failed && !risk && "!border-coral/50",
        !met && !risk && !failed && g.required && "!border-coral/20",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
            met ? "border-sprout/50 bg-sprout/15 text-sprout" : risk ? "border-amber/50 bg-amber/10 text-amber" : failed ? "border-coral/60 bg-coral/15 text-coral" : "border-white/15 bg-white/5 text-mist",
          )}
        >
          {met ? <Check className="h-5 w-5" aria-hidden /> : risk ? <ShieldAlert className="h-5 w-5" aria-hidden /> : failed ? <X className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-[min(100%,15rem)] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading font-semibold text-ivory">{g.label}</span>
            <Badge tone={g.required ? "coral" : "stone"}>{g.required ? "Required" : "Recommended"}</Badge>
            {met && <Badge tone="sprout">Satisfied</Badge>}
            {risk && <Badge tone="amber">Risk accepted · test skipped</Badge>}
            {!met && blocking && <Badge tone={blocking.tone}>{blocking.label}</Badge>}
          </div>
          {g.detail && <p className="mt-1 text-sm leading-relaxed text-ivory/75">{g.detail}</p>}

          {/* Two indicators: task + test */}
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Gate conditions">
            <Badge tone={taskDone ? "sprout" : "stone"} icon={<ListChecks className="h-3 w-3" aria-hidden />}>
              Task {taskDone ? "done" : "not done"}
            </Badge>
            {v && (
              <Badge
                tone={result === "pass" ? "sprout" : failed ? "coral" : "stone"}
                icon={<FlaskConical className="h-3 w-3" aria-hidden />}
              >
                Test {result === "pass" ? "passed" : failed ? "failed" : "not run"}
              </Badge>
            )}
          </div>

          {tasks.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs text-mist">{tasks.length > 1 ? "Complete any one of:" : "Complete:"}</div>
              <ul className="grid gap-2">
                {tasks.map((t) => (
                  <TaskRow
                    key={t}
                    taskId={t}
                    label={labels[t] ?? gateTasks[t]?.task_label ?? humanize(t)}
                    rec={gateTasks[t]}
                    done={completed.includes(t)}
                    disabled={!!pending || loading === "plan"}
                    busy={pending === t}
                    onToggle={() => void run(t, () => toggleTask(t))}
                  />
                ))}
              </ul>
            </div>
          )}

          {v && (
            <div className={cx("mt-4 rounded-xl border p-4", failed ? "border-coral/40 bg-coral/[0.07]" : result === "pass" ? "border-sprout/30 bg-sprout/[0.05]" : "border-violet/25 bg-violet/[0.05]")}>
              <div className="eyebrow mb-2 flex items-center gap-1.5 !text-violet-100">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Empirical test
              </div>
              {failed && v.if_fail && (
                <div className="mb-3 rounded-lg border border-coral/50 bg-coral/15 p-3" role="alert">
                  <div className="flex items-center gap-1.5 font-heading text-sm font-semibold text-rose-100">
                    <TriangleAlert className="h-4 w-4" aria-hidden /> Test failed — do this next
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ivory">{v.if_fail}</p>
                </div>
              )}
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div className="md:col-span-2">
                  <dt className="font-heading font-semibold text-ivory">Test</dt>
                  <dd className="mt-0.5 leading-relaxed text-ivory/85">{v.test}</dd>
                </div>
                <div className="rounded-lg border border-sprout/20 bg-sprout/[0.04] p-2.5">
                  <dt className="flex items-center gap-1 font-heading font-semibold text-emerald-100"><CircleCheck className="h-3.5 w-3.5" aria-hidden /> PASS looks like</dt>
                  <dd className="mt-0.5 leading-relaxed text-ivory/85">{v.pass}</dd>
                </div>
                <div className="rounded-lg border border-coral/20 bg-coral/[0.04] p-2.5">
                  <dt className="flex items-center gap-1 font-heading font-semibold text-rose-100"><CircleX className="h-3.5 w-3.5" aria-hidden /> FAIL looks like</dt>
                  <dd className="mt-0.5 leading-relaxed text-ivory/85">{v.fail}</dd>
                </div>
                {!failed && v.if_fail && (
                  <div className="md:col-span-2">
                    <dt className="font-heading font-semibold text-mist">If it fails</dt>
                    <dd className="mt-0.5 leading-relaxed text-ivory/75">{v.if_fail}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Record test result for ${g.label}`}>
                <button
                  type="button"
                  aria-pressed={result === "pass"}
                  disabled={!!pending}
                  onClick={() => void run("pass", () => setGateResult(g.id, "pass"))}
                  className={cx(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-heading text-sm font-semibold transition-colors disabled:opacity-50",
                    result === "pass" ? "border-sprout/60 bg-sprout/20 text-emerald-100" : "border-white/12 bg-white/[0.03] text-ivory hover:border-sprout/50",
                  )}
                >
                  {pending === "pass" ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />} Pass
                </button>
                <button
                  type="button"
                  aria-pressed={failed}
                  disabled={!!pending}
                  onClick={() => void run("fail", () => setGateResult(g.id, "fail"))}
                  className={cx(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-heading text-sm font-semibold transition-colors disabled:opacity-50",
                    failed ? "border-coral/60 bg-coral/20 text-rose-100" : "border-white/12 bg-white/[0.03] text-ivory hover:border-coral/50",
                  )}
                >
                  {pending === "fail" ? <Spinner /> : <X className="h-4 w-4" aria-hidden />} Fail
                </button>
                {result && (
                  <button type="button" disabled={!!pending} onClick={() => void run("clear", () => setGateResult(g.id, null))} className="flex items-center gap-1 px-2 py-1.5 text-sm text-mist hover:text-ivory disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear
                  </button>
                )}
                {!taskDone && <span className="text-xs text-mist">Do the task first, then run the test.</span>}
              </div>
            </div>
          )}

          <EvidenceChips evidence={g.evidence} compact className="mt-3" />
        </div>
        {!met && !risk && canAccept && (
          <button type="button" className="btn-ghost !py-1.5 text-sm text-amber-100" onClick={onAcceptRisk} title="Skips the test only — the task stays required">
            <LockOpen className="h-4 w-4" aria-hidden /> Accept risk
          </button>
        )}
        {!met && !risk && !canAccept && !taskDone && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-xs text-mist" title="Accepting a risk only skips the test">
            <Hourglass className="h-3.5 w-3.5" aria-hidden /> Complete the task first
          </span>
        )}
      </div>
    </li>
  );
}

function TaskRow({
  taskId,
  label,
  rec,
  done,
  disabled,
  busy,
  onToggle,
}: {
  taskId: string;
  label: string;
  rec?: Recommendation;
  done: boolean;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasHow = !!rec && (arr(rec.actions).length > 0 || !!rec.explanation);
  return (
    <li className={cx("rounded-xl border", done ? "border-sprout/40 bg-sprout/[0.06]" : "border-white/12 bg-white/[0.03]")} data-incomplete={!done ? "true" : undefined}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={done}
          aria-label={`${done ? "Mark not done" : "Mark done"}: ${label}`}
          className="flex min-h-11 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-50"
        >
          <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-md border", done ? "border-sprout bg-sprout text-midnight" : "border-white/30")}>
            {busy ? <Spinner /> : done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
          </span>
          <span className={cx("font-heading font-semibold", done ? "text-emerald-100" : "text-ivory")}>{label}</span>
        </button>
        {hasHow && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`task-how-${taskId}`}
            className="mr-1 flex min-h-11 items-center gap-1 px-2 text-xs text-mist hover:text-ivory"
          >
            How <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {open && rec && (
        <div id={`task-how-${taskId}`} className="border-t border-white/8 px-3 pb-3 pt-2">
          {rec.explanation && <p className="text-sm leading-relaxed text-ivory/80">{rec.explanation}</p>}
          {arr(rec.actions).length > 0 && <BulletList items={rec.actions} ordered className="mt-2" />}
          {arr(rec.everyday_amounts).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {rec.everyday_amounts.map((a, i) => (
                <li key={i} className="rounded-lg border border-cyan/15 bg-cyan/[0.05] px-2 py-1 text-xs text-ivory/90">{a}</li>
              ))}
            </ul>
          )}
          <EvidenceChips evidence={rec.evidence} compact className="mt-2" />
        </div>
      )}
    </li>
  );
}
