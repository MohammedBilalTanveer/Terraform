// TERRA·AI side panel. Everything it says comes from the API: step meta, next_best_action and
// /api/assistant/ask answers (with matched KB records). Refusals are shown as "Not in knowledge base".
import { useRef, useState } from "react";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleHelp, Compass, Database, RefreshCw, SearchX, Send, ServerOff, TriangleAlert, X } from "lucide-react";
import { api, ApiError } from "../api/terraformApi";
import type { AskResponse, StepId } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import EvidenceChips from "./EvidenceChips";
import RobotAvatar from "./RobotAvatar";
import { Badge, BulletList, StatusBadge, cx } from "./ui";
import { getStepMeta, stepInfo, useStepStatuses } from "./workflow";

type Exchange = { id: number; question: string; step_id: StepId; response?: AskResponse; error?: string; offline?: boolean };

// Local (non-shared) conversation log so desktop + mobile panels show the same history.
const useAskLog = create<{ log: Exchange[]; push: (e: Exchange) => void; patch: (id: number, p: Partial<Exchange>) => void; clear: () => void }>((set) => ({
  log: [],
  push: (e) => set((s) => ({ log: [...s.log, e].slice(-20) })),
  patch: (id, p) => set((s) => ({ log: s.log.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
  clear: () => set({ log: [] }),
}));
let seq = 1;

// UI copy only — the answers come from the knowledge base via /api/assistant/ask.
const QUICK_QUESTIONS = ["What should I do next?", "How do I store rainwater?", "When is it ready to harvest?"];

export default function AssistantPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const step = useTerraform((s) => s.currentStep);
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const sessionId = useTerraform((s) => s.sessionId);
  const openEvidence = useTerraform((s) => s.openEvidence);
  const backendOnline = useTerraform((s) => s.backendOnline);
  const checkHealth = useTerraform((s) => s.checkHealth);
  const [checking, setChecking] = useState(false);
  const statuses = useStepStatuses();
  const { log, push, patch, clear } = useAskLog();
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const meta = getStepMeta(step, analysis, plan);
  const info = stepInfo(step);
  const nba = plan?.workflow?.next_action?.next_best_action;

  const scrollDown = () => setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);

  /** Send (or re-send) one exchange. On failure the question is put back in the box. */
  const send = async (id: number, text: string) => {
    setAsking(true);
    patch(id, { error: undefined, offline: false, response: undefined });
    scrollDown();
    try {
      const response = await api.ask(text, { session_id: sessionId, plan_id: plan?.plan_id ?? null, step_id: step });
      patch(id, { response });
    } catch (e) {
      const offline = e instanceof ApiError && (e.code === "NETWORK" || e.code === "TIMEOUT");
      patch(id, { error: e instanceof ApiError ? e.message : String(e), offline });
      setQ((cur) => cur || text);
      if (offline) void checkHealth();
    } finally {
      setAsking(false);
      scrollDown();
    }
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || asking) return;
    const id = seq++;
    push({ id, question: text, step_id: step });
    setQ("");
    await send(id, text);
  };

  const recheck = async () => {
    setChecking(true);
    await checkHealth();
    setChecking(false);
  };

  return (
    <section className={cx("glass flex flex-col overflow-hidden rounded-2xl", className)} aria-label="TERRA·AI assistant">
      <header className="relative flex items-center gap-3 border-b border-white/8 bg-gradient-to-r from-cyan/10 via-violet/10 to-transparent px-4 py-3.5">
        <RobotAvatar size={44} thinking={asking} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold tracking-[0.2em] text-ivory">TERRA·AI</div>
          <div className="text-xs text-mist">Answers only from the knowledge base</div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-ghost !p-2" aria-label="Close assistant">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>

      <div ref={listRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {backendOnline === false && (
          <div className="flex items-start gap-3 rounded-xl border border-coral/40 bg-coral/10 p-3.5" role="alert">
            <ServerOff className="mt-0.5 h-5 w-5 shrink-0 text-coral" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-heading text-sm font-semibold text-rose-100">TERRA can't reach the knowledge base server — start the backend</div>
              <p className="mt-0.5 text-xs text-rose-100/75">Answers come only from the knowledge base, so nothing can be answered until it is reachable.</p>
            </div>
            <button type="button" onClick={() => void recheck()} disabled={checking} className="btn-ghost !px-2.5 !py-1.5 text-xs">
              <RefreshCw className={cx("h-3.5 w-3.5", checking && "animate-spin")} aria-hidden /> Retry
            </button>
          </div>
        )}
        {/* Current step briefing — API text only */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="eyebrow">Step {String(info.n).padStart(2, "0")} · {info.label}</span>
            <StatusBadge status={statuses[step]} />
          </div>
          {meta ? (
            <>
              {meta.title && <div className="font-heading font-semibold text-ivory">{meta.title}</div>}
              {meta.summary && <p className="mt-1 text-sm leading-relaxed text-ivory/80">{meta.summary}</p>}
              {!!meta.warnings?.length && (
                <div className="mt-3 rounded-lg border border-amber/25 bg-amber/5 p-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-100">
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Warnings
                  </div>
                  <BulletList items={meta.warnings} tone="amber" />
                </div>
              )}
              {!!meta.questions?.length && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-mist">
                    <CircleHelp className="h-3.5 w-3.5" aria-hidden /> Open questions
                  </div>
                  <ul className="space-y-1.5">
                    {meta.questions.map((qq, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setQ(qq)}
                          className="w-full rounded-lg border border-white/8 px-2.5 py-1.5 text-left text-sm text-ivory/85 hover:border-violet/40 hover:bg-violet/10"
                          title="Put this question in the ask box"
                        >
                          {qq}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-mist">
              {analysis ? "Generate the restoration plan to brief this step." : "Submit an observation and I'll brief each step from the knowledge base."}
            </p>
          )}
        </div>

        {nba && (
          <div className="hero-ring rounded-xl bg-gradient-to-br from-cyan/10 to-violet/10 p-3.5">
            <div className="eyebrow mb-1 flex items-center gap-1.5 !text-cyan-100">
              <Compass className="h-3.5 w-3.5" aria-hidden /> Next best action
            </div>
            <p className="text-sm leading-relaxed text-ivory">{nba}</p>
          </div>
        )}

        {/* Q&A log */}
        <AnimatePresence initial={false}>
          {log.map((e) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-r from-cyan/20 to-violet/20 px-3 py-2 text-sm text-ivory">
                {e.question}
              </div>
              {!e.response && !e.error && (
                <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-mist" role="status">
                  <span className="flex gap-1" aria-hidden>
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </span>
                  TERRA is typing…
                </div>
              )}
              {e.error && (
                <div className="rounded-2xl rounded-bl-md border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm text-rose-100" role="alert">
                  <div className="flex items-start gap-2">
                    {e.offline ? <ServerOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                    <span>{e.offline ? "TERRA can't reach the knowledge base server — start the backend, then retry." : e.error}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" disabled={asking} onClick={() => void send(e.id, e.question)}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
                    </button>
                    <span className="text-xs text-rose-100/60">Your question is kept in the box below.</span>
                  </div>
                </div>
              )}
              {e.response && <Answer r={e.response} onOpen={openEvidence} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <form
        className="border-t border-white/8 p-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          void ask(q);
        }}
      >
        <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Quick questions">
          {QUICK_QUESTIONS.map((qq) => (
            <button
              key={qq}
              type="button"
              disabled={asking}
              onClick={() => void ask(qq)}
              className="shrink-0 rounded-full border border-violet/30 bg-violet/10 px-3 py-1.5 text-xs text-violet-100 transition-colors hover:border-violet/60 hover:bg-violet/20 disabled:opacity-50"
            >
              {qq}
            </button>
          ))}
        </div>
        <label htmlFor="assistant-ask" className="sr-only">Ask TERRA·AI a question</label>
        <div className="flex items-end gap-2">
          <textarea
            id="assistant-ask"
            rows={2}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(q);
              }
            }}
            placeholder={backendOnline === false ? "Backend offline — questions can't be answered" : "Ask about this step…"}
            className="scroll-thin min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/12 bg-midnight/60 px-3 py-2 text-sm text-ivory placeholder:text-mist/50 focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/30"
          />
          <button type="submit" className="btn-primary !p-2.5" disabled={!q.trim() || asking} aria-label="Send question">
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-mist/70">
          <span>Context: {info.label}{plan ? " · plan attached" : ""}</span>
          {log.length > 0 && (
            <button type="button" onClick={clear} className="hover:text-ivory">Clear chat</button>
          )}
        </div>
      </form>
    </section>
  );
}

function Answer({ r, onOpen }: { r: AskResponse; onOpen: (id: string) => void }) {
  return (
    <div
      className={cx(
        "max-w-[96%] rounded-2xl rounded-bl-md border px-3.5 py-3 text-sm",
        r.refused ? "border-amber/30 bg-amber/[0.06]" : "border-white/10 bg-white/[0.04]",
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {r.refused ? (
          <Badge tone="amber" icon={<SearchX className="h-3 w-3" aria-hidden />}>Not in knowledge base</Badge>
        ) : (
          <Badge tone="violet" icon={<Database className="h-3 w-3" aria-hidden />}>From knowledge base</Badge>
        )}
        <Badge tone="stone">{r.generation_mode === "llm_rewrite" ? "LLM rewrite" : "Deterministic"}</Badge>
      </div>
      <p className="whitespace-pre-line leading-relaxed text-ivory/90">{r.answer}</p>
      {!!r.matched?.length && (
        <ul className="mt-2.5 space-y-1.5">
          {r.matched.map((m) => (
            <li key={m.kb_id}>
              <button
                type="button"
                onClick={() => onOpen(m.kb_id)}
                className="group w-full rounded-lg border border-violet/20 bg-violet/[0.06] px-2.5 py-2 text-left hover:border-violet/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-[0.85rem] font-semibold text-violet-100">{m.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-violet-300 opacity-60 group-hover:opacity-100" aria-hidden />
                </div>
                {m.snippet && <div className="mt-0.5 line-clamp-2 text-xs text-mist">{m.snippet}</div>}
                <div className="mt-1 font-mono text-[0.7rem] text-violet-300/80">{m.collection} · {m.kb_id}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5">
        <EvidenceChips evidence={r.evidence} compact />
      </div>
    </div>
  );
}
