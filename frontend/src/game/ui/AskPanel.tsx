// "Ask TERRA" — free questions answered only by POST /api/assistant/ask (KB-grounded or refused).
import { useRef, useState } from "react";
import { Bot, DatabaseZap, Send } from "lucide-react";
import type { AskResponse } from "../../types/terraform";
import { api } from "../../api/terraformApi";
import { useTerraform } from "../../store/terraformStore";
import { Busy, Card, Chips, ErrorNote, GlassPanel, Pill, cx } from "./kit";

type QA = { q: string; a: AskResponse };
let history: QA[] = []; // kept across panel open/close within the session

export default function AskPanel({ onClose }: { onClose: () => void }) {
  const sessionId = useTerraform((s) => s.sessionId);
  const plan = useTerraform((s) => s.plan);
  const step = useTerraform((s) => s.currentStep);
  const openEvidence = useTerraform((s) => s.openEvidence);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [list, setList] = useState<QA[]>(history);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const a = await api.ask(question, { session_id: sessionId, plan_id: plan?.plan_id ?? null, step_id: step });
      history = [{ q: question, a }, ...history].slice(0, 8);
      setList(history);
      setQ("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <GlassPanel title="Ask TERRA" kicker="KNOWLEDGE-BASE ONLY" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. How do I check how deep the hard layer is?"
          className="min-w-0 flex-1 rounded-lg border border-white/12 bg-[#060a18]/70 px-3 py-2 text-[13px] placeholder:text-ivory/35 focus:border-cyan-300/60 focus:outline-none"
          aria-label="Question for TERRA"
        />
        <button type="submit" disabled={!q.trim() || busy} className="rounded-lg bg-cyan-400/90 px-3 text-[#06101f] disabled:opacity-40" aria-label="Ask">
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="text-[11.5px] text-ivory/55">TERRA answers only from the TERRAFORM knowledge base. If it isn't in there, it will say so.</p>
      {busy && <Busy label="Searching the knowledge base…" />}
      {err && <ErrorNote message={err} onRetry={() => void ask()} />}
      {list.map((x, i) => (
        <div key={i} className="space-y-2">
          <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-white/8 px-3 py-1.5 text-[13px]">{x.q}</div>
          <Card className={cx(x.a.refused ? "border-amber-300/35 bg-amber-400/[0.05]" : "border-cyan-300/25")}>
            <div className="mb-1 flex items-center gap-1.5">
              {x.a.refused ? <DatabaseZap className="h-4 w-4 text-amber-300" /> : <Bot className="h-4 w-4 text-cyan-300" />}
              <span className="font-display text-[10px] tracking-[0.2em] text-ivory/70">TERRA</span>
              {x.a.refused && <Pill tone="amber">Not in my knowledge base</Pill>}
              {x.a.llm_used && <Pill tone="violet">re-worded</Pill>}
            </div>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ivory/90">{x.a.answer}</p>
            {x.a.matched.length > 0 && (
              <ul className="mt-2 space-y-1">
                {x.a.matched.map((m) => (
                  <li key={m.kb_id}>
                    <button type="button" onClick={() => openEvidence(m.kb_id)} className="w-full rounded-lg bg-white/[0.03] px-2 py-1 text-left text-[12px] hover:bg-white/[0.07]">
                      <span className="font-medium text-cyan-100">{m.title}</span> <span className="text-ivory/45">· {m.collection}</span>
                      {m.snippet && <div className="line-clamp-2 text-ivory/65">{m.snippet}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2">
              <Chips evidence={x.a.evidence} />
            </div>
          </Card>
        </div>
      ))}
    </GlassPanel>
  );
}
