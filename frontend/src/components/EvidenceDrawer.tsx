// Self-contained Evidence drawer: reads store.evidenceKbId, fetches the KB record from the API and
// shows it verbatim. Mount once (AppShell does this).
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Database, ExternalLink, ShieldCheck, X } from "lucide-react";
import { api, ApiError } from "../api/terraformApi";
import type { KbRecordResponse } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { Badge, BulletList, cx } from "./ui";
import { ErrorState, SkeletonLines } from "./LoadingAndError";

const cache = new Map<string, KbRecordResponse>();

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);

const LEVEL_TONE: Record<string, "sprout" | "cyan" | "amber"> = {
  locally_verified: "sprout",
  general_guidance: "cyan",
  needs_local_confirmation: "amber",
};

function VerificationBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <Badge tone={value === "fetched_and_read" ? "sprout" : "amber"} icon={<ShieldCheck className="h-3 w-3" aria-hidden />}>
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

export default function EvidenceDrawer() {
  const kbId = useTerraform((s) => s.evidenceKbId);
  const openEvidence = useTerraform((s) => s.openEvidence);
  const [data, setData] = useState<KbRecordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!kbId) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    setTimeout(() => closeRef.current?.focus(), 30);
    const cached = cache.get(kbId);
    if (cached) {
      setData(cached);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setData(null);
    setError(null);
    api
      .getRecord(kbId)
      .then((r) => {
        if (!alive) return;
        cache.set(kbId, r);
        setData(r);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kbId, nonce]);

  useEffect(() => {
    if (!kbId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId]);

  const close = () => {
    openEvidence(null);
    setTimeout(() => lastFocus.current?.focus?.(), 0);
  };

  const rec = data?.record ?? null;
  const isSource = data?.collection === "sources" || (kbId ?? "").startsWith("src_");
  const known = new Set([
    "id", "title", "summary", "instructions", "everyday_amounts", "limitations", "safety_notes", "evidence_level",
    "source_ids", "organization", "url", "verification", "notes", "accessed_on",
  ]);

  return (
    <AnimatePresence>
      {kbId && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-title"
            className="glass-strong absolute right-0 top-0 flex h-full w-full flex-col sm:max-w-xl sm:rounded-l-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div className="min-w-0">
                <div className="eyebrow flex items-center gap-2">
                  {isSource ? <BookOpen className="h-3.5 w-3.5 text-cyan" aria-hidden /> : <Database className="h-3.5 w-3.5 text-violet-300" aria-hidden />}
                  {isSource ? "Source record" : "Knowledge-base record"}
                </div>
                <h2 id="evidence-title" className="mt-1 font-heading text-xl font-semibold text-ivory">
                  {str(rec?.title) ?? (loading ? "Loading…" : kbId)}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-mist">{kbId}</code>
                  {data?.collection && <Badge tone="violet">{data.collection}</Badge>}
                  {str(rec?.evidence_level) && (
                    <Badge tone={LEVEL_TONE[str(rec?.evidence_level)!] ?? "stone"}>{str(rec?.evidence_level)!.replace(/_/g, " ")}</Badge>
                  )}
                </div>
              </div>
              <button ref={closeRef} type="button" onClick={close} className="btn-ghost !p-2" aria-label="Close evidence drawer">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div className="scroll-thin flex-1 space-y-6 overflow-y-auto p-5">
              {loading && <SkeletonLines lines={7} />}
              {error && <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />}
              {rec && (
                <>
                  {str(rec.summary) && <p className="text-[0.98rem] leading-relaxed text-ivory/90">{str(rec.summary)}</p>}

                  <div className="flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-3 py-2 text-sm text-violet-100">
                    <span className="font-mono text-xs">{kbId}</span>
                    <span>· From the TERRAFORM knowledge base (local, KB-only answer)</span>
                  </div>

                  <Block title="Instructions" items={strs(rec.instructions)} ordered />
                  <Block title="Everyday amounts" items={strs(rec.everyday_amounts)} tone="cyan" />
                  <Block title="Limitations" items={strs(rec.limitations)} tone="amber" />
                  <Block title="Safety notes" items={strs(rec.safety_notes)} tone="coral" />

                  <details className="rounded-xl border border-white/10 bg-black/20">
                    <summary className="cursor-pointer select-none px-3 py-2 font-heading text-sm text-mist hover:text-ivory">
                      Raw record ({Object.keys(rec).filter((k) => !known.has(k)).length} more fields)
                    </summary>
                    <pre className="scroll-thin max-h-80 overflow-auto px-3 pb-3 font-mono text-xs leading-relaxed text-mist">
                      {JSON.stringify(rec, null, 2)}
                    </pre>
                  </details>
                </>
              )}
            </div>
            <footer className="border-t border-white/10 px-5 py-3 text-xs text-mist">
              Served by the knowledge-base API · <span className="font-mono">GET /api/knowledge/records/{kbId}</span>
            </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function Block({ title, items, ordered, tone }: { title: string; items: string[]; ordered?: boolean; tone?: "cyan" | "amber" | "coral" }) {
  if (!items.length) return null;
  return (
    <section className={cx(tone === "coral" && "rounded-xl border border-coral/25 bg-coral/5 p-3")}>
      <h3 className="eyebrow mb-2">{title}</h3>
      <BulletList items={items} ordered={ordered} tone={tone} />
    </section>
  );
}
