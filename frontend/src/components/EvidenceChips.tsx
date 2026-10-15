import { useState } from "react";
import { BookOpen, Database } from "lucide-react";
import type { Evidence } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { cx } from "./ui";

export type EvidenceChipsProps = { evidence: Evidence | null | undefined; compact?: boolean; className?: string };

/**
 * KB evidence IDs (violet) and source IDs (cyan) as clickable chips.
 * Clicking any chip opens the Evidence drawer, which fetches the record from the API.
 */
export default function EvidenceChips({ evidence, compact = false, className }: EvidenceChipsProps) {
  const openEvidence = useTerraform((s) => s.openEvidence);
  const [expanded, setExpanded] = useState(false);
  const kb = evidence?.kb_ids ?? [];
  // KB-only display: only knowledge-base record IDs are shown (research sources stay internal in sources.json)
  const all = kb.map((id) => ({ id, kind: "kb" as const }));
  if (!all.length) {
    return <span className="text-xs text-mist/70">No knowledge-base IDs returned</span>;
  }
  const limit = compact ? 3 : 8;
  const shown = expanded ? all : all.slice(0, limit);
  const hidden = all.length - shown.length;

  return (
    <div className={cx("flex flex-wrap items-center gap-1.5", className)} aria-label="Knowledge-base evidence">
      {!compact && <span className="eyebrow mr-1 !text-[0.7rem]">From the knowledge base</span>}
      {shown.map(({ id, kind }) => (
        <button
          key={kind + id}
          type="button"
          onClick={() => openEvidence(id)}
          title={`From the TERRAFORM knowledge base — open record ${id}`}
          aria-label={kind === "kb" ? `Open knowledge-base record ${id}` : `Open source ${id}`}
          className={cx(
            "group inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs leading-none transition-colors",
            kind === "kb"
              ? "border-violet/35 bg-violet/10 text-violet-200 hover:border-violet/70 hover:bg-violet/20"
              : "border-cyan/30 bg-cyan/8 text-cyan-200 hover:border-cyan/60 hover:bg-cyan/15",
          )}
        >
          {kind === "kb" ? <Database className="h-3 w-3 shrink-0" aria-hidden /> : <BookOpen className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="truncate">{id}</span>
        </button>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-md border border-white/12 px-2 py-1 text-xs text-mist hover:bg-white/5"
          aria-label={`Show ${hidden} more evidence IDs`}
        >
          +{hidden} more
        </button>
      )}
      {expanded && all.length > limit && (
        <button type="button" onClick={() => setExpanded(false)} className="px-1 text-xs text-mist underline-offset-2 hover:underline">
          less
        </button>
      )}
    </div>
  );
}
