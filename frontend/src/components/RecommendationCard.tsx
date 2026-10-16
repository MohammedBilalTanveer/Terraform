// Renders one API Recommendation verbatim. No advice text is authored here.
import { useState } from "react";
import { motion } from "framer-motion";
import { Ban, Check, ChevronDown, Ruler, ShieldAlert, Target, TriangleAlert } from "lucide-react";
import type { Recommendation } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import EvidenceChips from "./EvidenceChips";
import LockedTask from "./LockedTask";
import { Badge, BulletList, ConfidenceBadge, cx, humanize } from "./ui";
import { useTaskLock } from "./workflow";

export type RecommendationCardProps = {
  rec: Recommendation;
  /** Optional step number shown in ordered layouts (planting method). */
  index?: number;
  className?: string;
  /** Not collapsible: opens the "why this matches · limitations" block. Collapsible: opens the whole body. */
  defaultOpen?: boolean;
  /** Collapsed by default: header, explanation, safety notes and the task control stay visible; steps/amounts fold away. */
  collapsible?: boolean;
};

const PRIORITY: Record<string, { label: string; tone: "cyan" | "violet" | "coral" | "stone"; accent: string }> = {
  do_first: { label: "Do first", tone: "cyan", accent: "from-cyan/70 to-violet/50" },
  do_next: { label: "Do next", tone: "violet", accent: "from-violet/70 to-fuchsia-400/40" },
  avoid: { label: "Avoid", tone: "coral", accent: "from-coral/80 to-terracotta/50" },
  optional: { label: "Optional", tone: "stone", accent: "from-white/30 to-white/5" },
};

export default function RecommendationCard({ rec, index, className, defaultOpen = false, collapsible = false }: RecommendationCardProps) {
  const completed = useTerraform((s) => s.completedTasks);
  const toggleTask = useTerraform((s) => s.toggleTask);
  const busy = useTerraform((s) => s.loading);
  const [open, setOpen] = useState(defaultOpen);
  const [pending, setPending] = useState(false);
  const [detail, setDetail] = useState(!collapsible && defaultOpen);
  const lock = useTaskLock(rec);
  const bodyShown = !collapsible || open;

  const p = rec.priority ? PRIORITY[rec.priority] : null;
  const isAvoid = rec.priority === "avoid";
  const done = !!rec.task_id && completed.includes(rec.task_id);
  const actions = rec.actions ?? [];
  const amounts = rec.everyday_amounts ?? [];
  const why = rec.why_this_matches ?? [];
  const limits = rec.limitations ?? [];
  const safety = rec.safety_notes ?? [];
  const hasDetail = limits.length > 0 || why.length > 0;

  const onToggle = async () => {
    if (!rec.task_id) return;
    setPending(true);
    await toggleTask(rec.task_id);
    setPending(false);
  };

  return (
    <motion.article
      layout="position"
      className={cx(
        "glass relative overflow-hidden rounded-2xl p-5",
        isAvoid && "!border-coral/25 !bg-coral/[0.04]",
        done && "!border-sprout/30",
        className,
      )}
      aria-labelledby={`rec-${rec.id}`}
      data-incomplete={rec.task_id && !done && !lock.locked ? "true" : undefined}
    >
      {p && <span className={cx("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", p.accent)} aria-hidden />}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {typeof index === "number" && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/25 to-violet/25 font-display text-sm font-bold text-ivory">
              {index}
            </span>
          )}
          {isAvoid && typeof index !== "number" && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
              <Ban className="h-5 w-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h4 id={`rec-${rec.id}`} className="font-heading text-[1.05rem] font-semibold leading-snug text-ivory">
              {rec.title}
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {p && <Badge tone={p.tone}>{p.label}</Badge>}
              {rec.category && <Badge tone="stone">{humanize(rec.category)}</Badge>}
              <ConfidenceBadge value={rec.confidence} />
              {safety.length > 0 && !bodyShown && <Badge tone="amber" icon={<ShieldAlert className="h-3 w-3" aria-hidden />}>Safety notes inside</Badge>}
            </div>
          </div>
        </div>
        {rec.task_id && !lock.locked && (
          <button
            type="button"
            onClick={onToggle}
            disabled={pending || busy === "plan"}
            aria-pressed={done}
            aria-label={`${done ? "Mark not done" : "Mark done"}: ${rec.task_label ?? rec.title}`}
            className={cx(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-heading font-semibold transition-colors disabled:opacity-50",
              done
                ? "border-sprout/50 bg-sprout/15 text-emerald-100"
                : "border-white/15 bg-white/5 text-ivory hover:border-cyan/50 hover:bg-cyan/10",
            )}
          >
            <span className={cx("grid h-5 w-5 place-items-center rounded-md border", done ? "border-sprout bg-sprout text-midnight" : "border-white/30")}>
              {done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
            </span>
            <span className="max-w-[14rem] truncate text-left">{rec.task_label ?? "Task"}</span>
          </button>
        )}
      </header>

      {rec.task_id && lock.locked && <LockedTask className="mt-3" reason={lock.reason} label={rec.task_label ?? rec.title} />}

      {rec.explanation && bodyShown && <p className="mt-3 leading-relaxed text-ivory/85">{rec.explanation}</p>}

      {bodyShown && actions.length > 0 && (
        <div className="mt-4">
          <BulletList items={actions} ordered={!isAvoid} tone={isAvoid ? "coral" : "cyan"} />
        </div>
      )}

      {bodyShown && amounts.length > 0 && (
        <div className="mt-4 rounded-xl border border-cyan/15 bg-cyan/[0.05] p-3">
          <div className="eyebrow mb-2 flex items-center gap-1.5 !text-cyan-100/80">
            <Ruler className="h-3.5 w-3.5" aria-hidden /> Everyday amounts
          </div>
          <ul className="flex flex-wrap gap-2">
            {amounts.map((a, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-midnight/40 px-2.5 py-1.5 text-sm text-ivory/90">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {safety.length > 0 && bodyShown && (
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/[0.07] p-3">
          <div className="eyebrow mb-1.5 flex items-center gap-1.5 !text-amber-100">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Safety
          </div>
          <BulletList items={safety} tone="amber" />
        </div>
      )}

      {collapsible && (actions.length > 0 || amounts.length > 0 || hasDetail) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 flex min-h-10 items-center gap-1.5 font-heading text-sm font-semibold text-cyan-200 hover:text-ivory"
        >
          <ChevronDown className={cx("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
          {open ? "Hide steps & details" : "Show steps, amounts & details"}
        </button>
      )}

      {bodyShown && hasDetail && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setDetail((d) => !d)}
            aria-expanded={detail}
            className="flex min-h-10 items-center gap-1.5 font-heading text-sm font-semibold text-mist hover:text-ivory"
          >
            <ChevronDown className={cx("h-4 w-4 transition-transform", detail && "rotate-180")} aria-hidden />
            Why this matches · limitations
          </button>
          {detail && (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {why.length > 0 && (
                <div>
                  <div className="eyebrow mb-1.5 flex items-center gap-1.5"><Target className="h-3.5 w-3.5" aria-hidden />Why this matches</div>
                  <BulletList items={why} tone="violet" />
                </div>
              )}
              {limits.length > 0 && (
                <div>
                  <div className="eyebrow mb-1.5 flex items-center gap-1.5"><TriangleAlert className="h-3.5 w-3.5" aria-hidden />Limitations</div>
                  <BulletList items={limits} tone="amber" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <footer className={cx("border-t border-white/8", bodyShown ? "mt-4 pt-3" : "mt-2 pt-2")}>
        <EvidenceChips evidence={rec.evidence} compact />
      </footer>
    </motion.article>
  );
}
