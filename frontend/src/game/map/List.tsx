// Grouped location list (NEXT UP / WORK STATIONS / EXPLORE) with All / To do / Done filters.
import { ArrowRight, Lock } from "lucide-react";
import { PLACE_INFO } from "../places";
import type { StationId } from "../worldConfig";
import { cx } from "../ui/kit";
import { PIN_ICON } from "./pinIcons";
import type { StationStatus, StatusKind } from "./status";

export type ListRow = {
  id: StationId;
  name: string;
  color: string;
  status: StationStatus;
  isNext: boolean;
  isHere: boolean;
  distance: number;
};

export type Filter = "all" | "todo" | "done";

export const chipClass = (k: StatusKind) =>
  cx(
    "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight",
    k === "todo" && "border-amber-300/45 bg-amber-300/15 text-amber-200",
    k === "done" && "border-emerald-300/40 bg-emerald-400/15 text-emerald-200",
    k === "locked" && "border-slate-300/25 bg-slate-400/15 text-slate-200",
    k === "explore" && "border-sky-300/25 bg-sky-400/10 text-sky-200",
  );

function Row({ r, nextLabel, hot, onTravel, onHot }: { r: ListRow; nextLabel: string | null; hot: boolean; onTravel: (id: StationId) => void; onHot: (id: StationId | null) => void }) {
  const Icon = PIN_ICON[r.id];
  const st = r.status;
  const ring = r.isNext ? "#38e1ff" : st.kind === "locked" ? "#8a93a8" : r.color;
  return (
    <li>
      <button
        type="button"
        onClick={() => onTravel(r.id)}
        onPointerEnter={(e) => e.pointerType !== "touch" && onHot(r.id)}
        onPointerLeave={() => onHot(null)}
        onFocus={() => onHot(r.id)}
        onBlur={() => onHot(null)}
        aria-label={`Travel to ${r.name}. ${st.chip}. ${r.isHere ? "You are here" : `${r.distance} metres`}`}
        className={cx(
          "group flex min-h-[58px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
          r.isNext ? "border-cyan-300/55 bg-cyan-400/[0.09]" : "border-white/10 bg-white/[0.035] hover:border-white/30 hover:bg-white/[0.08]",
          hot && "border-white/45 bg-white/[0.09]",
        )}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#101a36]" style={{ boxShadow: `inset 0 0 0 2px ${ring}, 0 0 12px ${ring}44` }}>
          <Icon className={cx("h-5 w-5 text-white", st.kind === "locked" && "opacity-60")} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-[13.5px] font-semibold leading-tight text-ivory">{r.name}</span>
          <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-ivory/60">{r.isNext && nextLabel ? `Next: ${nextLabel}` : PLACE_INFO[r.id].short}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className={chipClass(st.kind)}>
              {st.kind === "locked" && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
              <span className="truncate">{st.chip}</span>
            </span>
            <span className={cx("shrink-0 text-[11px]", r.isHere ? "font-semibold text-white" : "text-ivory/55")}>{r.isHere ? "you're here" : `${r.distance} m`}</span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-ivory/40 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" aria-hidden />
      </button>
    </li>
  );
}

function Group({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className={cx("mb-1.5 px-0.5 font-display text-[11px] tracking-[0.24em]", tone)}>{title}</h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

export function LocationList({
  rows,
  filter,
  setFilter,
  nextLabel,
  hot,
  onHot,
  onTravel,
}: {
  rows: ListRow[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  nextLabel: string | null;
  hot: StationId | null;
  onHot: (id: StationId | null) => void;
  onTravel: (id: StationId) => void;
}) {
  const counts = {
    all: rows.length,
    todo: rows.filter((r) => r.status.kind === "todo" || r.status.kind === "locked").length,
    done: rows.filter((r) => r.status.kind === "done").length,
  };
  const keep = (r: ListRow) => (filter === "all" ? true : filter === "todo" ? r.status.kind === "todo" || r.status.kind === "locked" : r.status.kind === "done");
  const shown = rows.filter(keep);
  const next = shown.filter((r) => r.isNext);
  const work = shown.filter((r) => !r.isNext && r.status.kind !== "explore");
  const explore = shown.filter((r) => !r.isNext && r.status.kind === "explore" && filter === "all");
  const mk = (r: ListRow) => <Row key={r.id} r={r} nextLabel={nextLabel} hot={hot === r.id} onTravel={onTravel} onHot={onHot} />;
  const tabs: [Filter, string][] = [
    ["all", "All"],
    ["todo", "To do"],
    ["done", "Done"],
  ];
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b max-[400px]:justify-center border-white/10 bg-[#0a1124]/95 px-3 py-2">
        <div className="font-display text-[11px] tracking-[0.22em] text-amber-200/90 max-[400px]:hidden tf-wm-listtitle">LOCATIONS</div>
        <div className="flex gap-1" role="group" aria-label="Filter locations">
          {tabs.map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                "tf-wm-chipbtn rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors",
                filter === f ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100" : "border-white/15 text-ivory/65 hover:bg-white/10",
              )}
            >
              {label} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tf-wm-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3">
        {next.length > 0 && (
          <Group title="NEXT UP" tone="text-cyan-300">
            {next.map(mk)}
          </Group>
        )}
        {work.length > 0 && (
          <Group title="WORK STATIONS" tone="text-amber-200/90">
            {work.map(mk)}
          </Group>
        )}
        {explore.length > 0 && (
          <Group title="EXPLORE" tone="text-sky-200/80">
            {explore.map(mk)}
          </Group>
        )}
        {next.length + work.length + explore.length === 0 && <div className="py-6 text-center text-[12.5px] text-ivory/55">{filter === "done" ? "Nothing finished yet — go to a work station." : "Nothing left to do here."}</div>}
      </div>
    </>
  );
}
