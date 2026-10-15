// Small presentational primitives shared by landing + dashboard. No agricultural content here.
import type { HTMLAttributes, ReactNode } from "react";
import { CircleCheck, CircleDashed, CircleDot, CircleDotDashed, Lock, PencilLine } from "lucide-react";
import type { Confidence, SeasonFit, StepStatus } from "../types/terraform";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Null-safe array helper for defensive rendering of API payloads. */
export function arr<T>(a: T[] | null | undefined): T[] {
  return Array.isArray(a) ? a : [];
}

export function Panel({
  children,
  className,
  as: As = "section",
  ...rest
}: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside" } & HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx("glass rounded-2xl", className)} {...rest}>
      {children}
    </As>
  );
}

type Tone = "cyan" | "violet" | "terracotta" | "coral" | "sprout" | "amber" | "stone" | "ivory";

const toneClass: Record<Tone, string> = {
  cyan: "border-cyan/30 bg-cyan/10 text-cyan-100",
  violet: "border-violet/35 bg-violet/12 text-violet-100",
  terracotta: "border-terracotta/35 bg-terracotta/12 text-orange-100",
  coral: "border-coral/40 bg-coral/12 text-rose-100",
  sprout: "border-sprout/35 bg-sprout/10 text-emerald-100",
  amber: "border-amber/35 bg-amber/10 text-amber-100",
  stone: "border-white/12 bg-white/5 text-mist",
  ivory: "border-white/20 bg-white/10 text-ivory",
};

export function Badge({
  tone = "stone",
  children,
  icon,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-heading text-xs font-semibold leading-none whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function SectionTitle({
  icon,
  eyebrow,
  title,
  right,
  className,
}: {
  icon?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-3 flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200">
            {icon}
          </span>
        )}
        <div>
          {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
          <h3 className="font-heading text-lg font-semibold text-ivory">{title}</h3>
        </div>
      </div>
      {right}
    </div>
  );
}

export function BulletList({
  items,
  tone = "stone",
  ordered = false,
  className,
}: {
  items: string[];
  tone?: "stone" | "cyan" | "amber" | "coral" | "sprout" | "violet";
  ordered?: boolean;
  className?: string;
}) {
  const dot: Record<string, string> = {
    stone: "bg-mist/60",
    cyan: "bg-cyan",
    amber: "bg-amber",
    coral: "bg-coral",
    sprout: "bg-sprout",
    violet: "bg-violet",
  };
  if (!items.length) return null;
  if (ordered)
    return (
      <ol className={cx("space-y-2", className)}>
        {items.map((t, i) => (
          <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-ivory/90">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan/30 bg-cyan/10 font-heading text-xs font-semibold text-cyan-100">
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    );
  return (
    <ul className={cx("space-y-1.5", className)}>
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-[0.95rem] leading-relaxed text-ivory/85">
          <span className={cx("mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full", dot[tone])} aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function ConfidenceBadge({ value }: { value: Confidence | null | undefined }) {
  if (!value) return null;
  const tone: Record<Confidence, Tone> = { high: "sprout", medium: "cyan", low: "amber" };
  const bars = { low: 1, medium: 2, high: 3 }[value];
  return (
    <Badge tone={tone[value]} title={`Confidence: ${value}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cx("w-1 rounded-sm", b <= bars ? "bg-current" : "bg-current/25")} style={{ height: 4 + b * 2 }} />
        ))}
      </span>
      <span className="capitalize">{value} confidence</span>
    </Badge>
  );
}

export const STATUS_META: Record<StepStatus, { label: string; tone: Tone; ring: string; text: string }> = {
  needs_input: { label: "Needs input", tone: "stone", ring: "border-white/20", text: "text-mist" },
  ready: { label: "Ready", tone: "cyan", ring: "border-cyan/60", text: "text-cyan-200" },
  in_progress: { label: "In progress", tone: "violet", ring: "border-violet/70", text: "text-violet-200" },
  complete: { label: "Complete", tone: "sprout", ring: "border-sprout/60", text: "text-emerald-200" },
  blocked: { label: "Blocked", tone: "coral", ring: "border-coral/60", text: "text-rose-200" },
};

export function StatusIcon({ status, className = "h-4 w-4" }: { status: StepStatus; className?: string }) {
  switch (status) {
    case "complete":
      return <CircleCheck className={cx(className, "text-sprout")} aria-hidden />;
    case "blocked":
      return <Lock className={cx(className, "text-coral")} aria-hidden />;
    case "in_progress":
      return <CircleDotDashed className={cx(className, "text-violet-300")} aria-hidden />;
    case "ready":
      return <CircleDot className={cx(className, "text-cyan")} aria-hidden />;
    default:
      return <PencilLine className={cx(className, "text-mist/70")} aria-hidden />;
  }
}

export function StatusBadge({ status }: { status: StepStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.needs_input;
  return (
    <Badge tone={m.tone} icon={<StatusIcon status={status} className="h-3.5 w-3.5" />}>
      {m.label}
    </Badge>
  );
}

export const SEASON_FIT_META: Record<SeasonFit, { label: string; tone: Tone }> = {
  fits: { label: "Fits the season", tone: "sprout" },
  tight: { label: "Tight fit", tone: "amber" },
  high_risk: { label: "High season risk", tone: "coral" },
  unknown: { label: "Season fit unknown", tone: "stone" },
};

export function SeasonFitBadge({ fit }: { fit: SeasonFit }) {
  const m = SEASON_FIT_META[fit] ?? SEASON_FIT_META.unknown;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export const FIT_LABEL_META: Record<string, { label: string; tone: Tone }> = {
  good_fit: { label: "Good fit", tone: "sprout" },
  possible: { label: "Possible", tone: "cyan" },
  high_risk: { label: "High risk", tone: "coral" },
  excluded: { label: "Excluded", tone: "stone" },
};

export function Weeks({ range }: { range: { min: number; max: number } | null | undefined }) {
  if (!range) return <span className="text-mist">—</span>;
  return (
    <span>
      {range.min === range.max ? range.min : `${range.min}–${range.max}`} weeks
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-white/12 px-4 py-3 text-sm text-mist">
      <CircleDashed className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Pretty-print a snake_case enum/tag value as UI text (navigation copy only). */
export const humanize = (s: string) => s.replace(/^(res_|task_|gate_)/, "").replace(/_/g, " ");
