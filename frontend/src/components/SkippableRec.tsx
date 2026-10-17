// A recommendation row that can be skipped. Skipping is UI-only (store.skippedSteps): it never completes a backend task
// and never changes a readiness gate. Skipped rows collapse to one line with an Undo link (callers sort them to the bottom).
import { Check, RotateCcw, SkipForward } from "lucide-react";
import type { Recommendation } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import RecommendationCard, { type RecommendationCardProps } from "./RecommendationCard";
import { Badge, cx } from "./ui";
import { skipKey, type SkipKind } from "./workflow";

export type SkippableRecProps = Omit<RecommendationCardProps, "headerExtra" | "note"> & {
  /** null → required row: no Skip button. */
  kind: SkipKind | null;
  /** extra badge text, e.g. "Required for tree crops" */
  noteText?: string;
};

const NOTE: Record<SkipKind, string> = {
  optional: "Optional",
  alternative: "Another option already covers this",
  good_to_know: "Good to know",
};

export default function SkippableRec({ rec, kind, noteText, className, ...card }: SkippableRecProps) {
  const key = skipKey(rec);
  const skipped = useTerraform((s) => s.skippedSteps.includes(key));
  const skipStep = useTerraform((s) => s.skipStep);
  const unskipStep = useTerraform((s) => s.unskipStep);

  if (skipped) {
    return (
      <div
        className={cx("flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3", className)}
        role="group"
        aria-label={`Skipped: ${rec.title}`}
      >
        <SkipForward className="h-4 w-4 shrink-0 text-mist" aria-hidden />
        <span className="min-w-0 flex-1 font-heading text-sm text-mist line-through decoration-white/20">{rec.title}</span>
        <Badge tone="stone">Skipped</Badge>
        <button type="button" onClick={() => unskipStep(key)} className="inline-flex min-h-11 items-center gap-1.5 px-2 font-heading text-sm text-cyan-200 underline-offset-2 hover:underline">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Undo
        </button>
      </div>
    );
  }

  const extra = kind ? (
    <>
      {kind === "good_to_know" && (
        <button type="button" onClick={() => skipStep(key)} className="btn-ghost !px-3 !py-2 text-sm" aria-label={`Got it: ${rec.title}`}>
          <Check className="h-4 w-4" aria-hidden /> Got it
        </button>
      )}
      <button type="button" onClick={() => skipStep(key)} className="btn-ghost !px-3 !py-2 text-sm" aria-label={`Skip: ${rec.title}`}>
        <SkipForward className="h-4 w-4" aria-hidden /> Skip
      </button>
    </>
  ) : undefined;

  const note = (kind || noteText) && (
    <Badge tone={kind === "good_to_know" ? "cyan" : "violet"}>{noteText ?? (kind ? NOTE[kind] : "")}</Badge>
  );

  return <RecommendationCard rec={rec} className={className} {...card} headerExtra={extra} note={note || undefined} />;
}

/** Counts for the "x of y done · n skipped" chips. */
export function countRows(recs: Recommendation[], completed: string[], skipped: string[]) {
  let done = 0;
  let skip = 0;
  for (const r of recs) {
    if (skipped.includes(skipKey(r))) skip++;
    else if (r.task_id && completed.includes(r.task_id)) done++;
  }
  return { done, skipped: skip, total: recs.length };
}

/** Stable partition: skipped rows go to the bottom, original order otherwise. */
export function skippedLast(recs: Recommendation[], skipped: string[]) {
  return [...recs.filter((r) => !skipped.includes(skipKey(r))), ...recs.filter((r) => skipped.includes(skipKey(r)))];
}
