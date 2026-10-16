// Global "the backend is waking up" gate. The app runs on a free server that sleeps when idle (30–90 s to wake),
// so an unreachable backend is a normal, expected state — not an error. Wraps the whole app: while the backend is
// not online the app underneath is inert and this full-screen card explains what is happening and continues
// automatically (the shared poller in api.waitForBackend does the work; this component only listens).
// Timers only (no rAF) so counting/polling keep running even when the tab is throttled.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import Background from "./Background";
import RobotAvatar from "./RobotAvatar";
import { cx } from "./ui";

type Phase = "hidden" | "waiting" | "success" | "leaving";
const SHOW_AFTER_MS = 1500; // answers faster than this → the user never sees the gate
const SLOW_AFTER_S = 120;

export default function BackendGate({ children }: { children: ReactNode }) {
  const online = useTerraform((s) => s.backendOnline);
  const answered = useTerraform((s) => s.backendAnswered);
  const mode = useTerraform((s) => s.mode);
  const reduce = useTerraform((s) => s.reduceMotion);
  const checkHealth = useTerraform((s) => s.checkHealth);

  const [phase, setPhaseState] = useState<Phase>("hidden");
  const phaseRef = useRef<Phase>("hidden");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [since, setSince] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [skipped, setSkipped] = useState(false);
  const mountedAt = useRef(Date.now());
  const doneTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (online === true) {
      if (phaseRef.current === "waiting") {
        setPhase("success");
        doneTimers.current = [
          setTimeout(() => setPhase("leaving"), 1000),
          setTimeout(() => {
            setPhase("hidden");
            setSkipped(false);
          }, 1500),
        ];
      }
      return;
    }
    // Not online (unknown at start, or it went to sleep / restarted mid-session).
    doneTimers.current.forEach(clearTimeout);
    doneTimers.current = [];
    if (phaseRef.current === "waiting") return;
    const delay = online === false ? 0 : Math.max(0, SHOW_AFTER_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => {
      setSince(Date.now());
      setNow(Date.now());
      setSkipped(false);
      setPhase("waiting");
    }, delay);
    return () => clearTimeout(t);
  }, [online]);

  useEffect(() => () => doneTimers.current.forEach(clearTimeout), []);

  // Elapsed-seconds counter.
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const visible = phase !== "hidden" && !(skipped && mode === "landing" && phase === "waiting");
  const blocking = visible && phase !== "leaving";

  // Move focus into the card so keyboard users aren't left behind the (inert) app.
  useEffect(() => {
    if (phase === "waiting" && visible) cardRef.current?.focus({ preventScroll: true });
  }, [phase, visible]);

  const elapsed = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  const slow = elapsed >= SLOW_AFTER_S;
  const ok = phase === "success" || phase === "leaving";
  const steps: { label: string; state: "done" | "active" | "todo" }[] = [
    { label: "Server starting", state: ok || answered ? "done" : "active" },
    { label: "Loading the knowledge base", state: ok ? "done" : answered ? "active" : "todo" },
    { label: "Ready", state: ok ? "done" : "todo" },
  ];

  return (
    <>
      <div style={{ display: "contents" }} inert={blocking}>
        {children}
      </div>
      {visible && (
        <div
          className={cx(
            "gate-overlay tap-scope fixed inset-0 z-[200] overflow-y-auto bg-midnight transition-opacity duration-500",
            phase === "leaving" ? "opacity-0" : "opacity-100",
            reduce && "reduce-motion",
          )}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="gate-title"
          aria-describedby="gate-body"
        >
          <Background intensity="hero" />
          <div className="gate-pad flex min-h-full items-center justify-center px-4 py-6">
            <div ref={cardRef} tabIndex={-1} className="gate-card hero-ring glass-strong w-full max-w-lg rounded-3xl p-6 text-center outline-none sm:p-8">
              <div className="gate-robot relative mx-auto grid h-24 w-24 shrink-0 place-items-center">
                {!ok && <span className="animate-pulse-soft absolute inset-0 rounded-full border border-cyan/40" aria-hidden />}
                {!ok && <span className="animate-pulse-soft absolute -inset-3 rounded-full border border-violet/30 [animation-delay:-1.2s]" aria-hidden />}
                {ok ? (
                  <span className="grid h-20 w-20 place-items-center rounded-full border border-sprout/50 bg-sprout/15 text-sprout">
                    <Check className="h-10 w-10" strokeWidth={3} aria-hidden />
                  </span>
                ) : (
                  <RobotAvatar size={76} thinking />
                )}
              </div>

              <div className="gate-text min-w-0">
                <div className="eyebrow mt-5 text-cyan-200">TERRA·AI</div>
                <h2 id="gate-title" role="status" className="mt-1 font-display text-xl font-bold leading-snug tracking-wide text-ivory sm:text-2xl">
                  {ok ? "✓ Backend is awake" : "Please wait — the backend is waking up"}
                </h2>
                <p id="gate-body" className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-ivory/80">
                  {ok
                    ? "Everything is ready — continuing."
                    : "This app runs on a free server that sleeps when idle. Waking it takes about 30–60 seconds. This page continues automatically — you don't need to refresh."}
                </p>

                {!ok && (
                  <>
                    <div className="mx-auto mt-5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10" aria-hidden>
                      <div className="gate-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-cyan via-violet to-terracotta" />
                    </div>
                    <div className="mt-3 font-heading text-sm font-semibold text-cyan-100" aria-live="off">
                      Waiting {elapsed} s
                    </div>

                    <ol className="mx-auto mt-5 grid max-w-xs gap-2 text-left" aria-label="Start-up progress">
                      {steps.map((s) => (
                        <li key={s.label} className="flex items-center gap-3 text-sm">
                          <span
                            className={cx(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                              s.state === "done" && "border-sprout/60 bg-sprout/15 text-sprout",
                              s.state === "active" && "border-cyan/60 bg-cyan/10 text-cyan-100",
                              s.state === "todo" && "border-white/15 text-mist/60",
                            )}
                          >
                            {s.state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : s.state === "active" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
                          </span>
                          <span className={cx(s.state === "todo" ? "text-mist/70" : "text-ivory/90")}>{s.label}</span>
                          <span className="sr-only">{s.state === "done" ? "(done)" : s.state === "active" ? "(in progress)" : "(waiting)"}</span>
                        </li>
                      ))}
                    </ol>

                    {slow && (
                      <div className="mt-5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm text-amber-100" role="status">
                        <strong className="font-heading font-semibold">Taking longer than usual.</strong> We keep trying automatically.
                        <div className="mt-2">
                          <button type="button" className="btn-ghost !min-h-11 text-sm" onClick={() => void checkHealth()}>
                            <RefreshCw className="h-4 w-4" aria-hidden /> Retry now
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sprout/30 bg-sprout/10 px-2.5 py-1 font-heading text-xs font-semibold text-emerald-100">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Answers only from the knowledge base
                      </span>
                      {mode === "landing" && (
                        <button type="button" onClick={() => setSkipped(true)} className="min-h-11 px-2 font-heading text-sm text-mist underline-offset-2 hover:text-ivory hover:underline">
                          Continue without server
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
