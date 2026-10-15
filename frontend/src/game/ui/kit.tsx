// Small sci-fi "glass" UI kit for Explorer overlays. Evidence chips + drawer are re-used from the
// shared components (Dashboard session) so both presentations open the same evidence records.
import { useEffect, type ReactNode } from "react";
import { X, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import EvidenceChipsShared from "../../components/EvidenceChips";
import type { Evidence, StepId } from "../../types/terraform";
import { WORKFLOW_STEPS } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Chips({ evidence, compact = true }: { evidence: Evidence | null | undefined; compact?: boolean }) {
  if (!evidence || !evidence.kb_ids?.length) return null;
  return <EvidenceChipsShared evidence={evidence} compact={compact} />;
}

export function stepLabel(id: StepId) {
  const s = WORKFLOW_STEPS.find((w) => w.id === id);
  return s ? `${s.n}. ${s.label}` : id;
}

export function DetailsButton({ step, label = "Show details" }: { step: StepId; label?: string }) {
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const setMode = useTerraform((s) => s.setMode);
  return (
    <button
      type="button"
      onClick={() => {
        setCurrentStep(step);
        setMode("dashboard");
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-ivory/85 hover:border-cyan-300/50 hover:text-cyan-100"
    >
      <ExternalLink className="h-3 w-3" aria-hidden /> {label}
    </button>
  );
}

export function GlassPanel({
  title,
  kicker,
  steps,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  kicker?: string;
  steps?: StepId[];
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className={cx(
        // phones: full-width bottom sheet with internal scroll; sm+: right-hand side panel
        "pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl border border-cyan-300/20 bg-[#0a1124]/95 text-ivory shadow-[0_0_40px_rgba(7,11,26,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:inset-x-auto sm:bottom-3 sm:right-4 sm:top-16 sm:h-auto sm:rounded-2xl sm:bg-[#0a1124]/88",
        wide ? "sm:w-[620px]" : "sm:w-[500px]",
      )}
    >
      <div className="flex items-start gap-3 border-b border-white/10 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          {kicker && <div className="font-display text-[10px] tracking-[0.28em] text-cyan-300/90">{kicker}</div>}
          <h2 className="truncate font-heading text-lg font-semibold">{title}</h2>
          {steps && steps.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {steps.map((s) => (
                <span key={s} className="rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200">
                  Step {stepLabel(s)}
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel (Esc)" className="grid min-h-11 min-w-11 place-items-center rounded-lg p-1.5 text-ivory/70 hover:bg-white/10 hover:text-ivory sm:min-h-0 sm:min-w-0">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div data-panel-scroll className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin]" style={{ touchAction: "pan-y" }}>
        {children}
      </div>
      {footer && <div className="border-t border-white/10 px-4 py-3">{footer}</div>}
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/90">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Bullets({ items, tone = "default" }: { items: string[] | null | undefined; tone?: "default" | "warn" | "safety" }) {
  const list = (items ?? []).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul className="space-y-1 text-[13px] leading-relaxed">
      {list.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span
            className={cx(
              "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
              tone === "warn" ? "bg-amber-300" : tone === "safety" ? "bg-coral" : "bg-cyan-300/80",
            )}
          />
          <span className="text-ivory/90">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Pill({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "amber" | "sprout" | "coral" | "violet" | "muted" }) {
  const map = {
    cyan: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100",
    amber: "border-amber-300/40 bg-amber-400/10 text-amber-100",
    sprout: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    coral: "border-rose-300/40 bg-rose-400/10 text-rose-100",
    violet: "border-violet-300/40 bg-violet-400/10 text-violet-100",
    muted: "border-white/15 bg-white/5 text-ivory/70",
  } as const;
  return <span className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium", map[tone])}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-white/10 bg-white/[0.035] p-3", className)}>{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled, type = "button", tone = "cyan" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; tone?: "cyan" | "sprout" | "amber" }) {
  const map = {
    cyan: "bg-cyan-400/90 text-[#06101f] hover:bg-cyan-300",
    sprout: "bg-emerald-400/90 text-[#06101f] hover:bg-emerald-300",
    amber: "bg-amber-300/90 text-[#1a1003] hover:bg-amber-200",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx("inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0", map[tone])}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12px] font-medium sm:min-h-0 text-ivory/85 hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function Busy({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/5 px-3 py-2 text-[12.5px] text-cyan-100">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const clearError = useTerraform((s) => s.clearError);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button type="button" className="underline" onClick={onRetry}>
          Retry
        </button>
      )}
      <button type="button" className="text-rose-200/70 hover:text-rose-100" onClick={clearError} aria-label="Dismiss error">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const humanize = (s: string) => s.replace(/^(res_|task_|gate_|unknown_|check_)/, "").replace(/_/g, " ");

/**
 * "Resume where you left": after a panel/tab renders, scroll to the focused task (from the quest list)
 * or else the first element marked data-incomplete="true", and give it a brief glow.
 */
export function useAutoFocusItem(deps: unknown[], focusId: string | null | undefined, reduceMotion: boolean) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-panel-scroll]");
      if (!root) return;
      const el =
        (focusId ? root.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(focusId)}"]`) : null) ??
        root.querySelector<HTMLElement>('[data-incomplete="true"]');
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      el.classList.add("ring-2", "ring-cyan-300/80", "shadow-[0_0_24px_rgba(56,225,255,0.35)]");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-cyan-300/80", "shadow-[0_0_24px_rgba(56,225,255,0.35)]"), 2400);
    }, 180);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function ThisOneBadge() {
  return (
    <span className="inline-flex animate-pulse items-center rounded-md border border-cyan-300/60 bg-cyan-400/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-cyan-50">
      ← this one
    </span>
  );
}
