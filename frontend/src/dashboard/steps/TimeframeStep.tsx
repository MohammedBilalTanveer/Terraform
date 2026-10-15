import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, CalendarRange, CloudRain, Hammer, Hourglass, Pencil, Sprout, Table2, TriangleAlert } from "lucide-react";
import type { TimeframeRow, WeeksRange } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import EvidenceChips from "../../components/EvidenceChips";
import { requestObservationFieldFocus } from "../../components/ObservationForm";
import { Badge, BulletList, Empty, Panel, SeasonFitBadge, SectionTitle, Weeks, arr, cx } from "../../components/ui";
import { NeedPlan, useGo } from "./common";

// Chart palette — validated on the dark surface (lightness band, chroma, CVD ΔE ≥ 13 adjacent).
const C_PREP = "#8f6fdc";
const C_BUFFER = "#c0822a";
const C_MATURITY = "#1aa3c2";
const GAP = 2; // px surface gap between touching segments

const rangeText = (r: WeeksRange | null | undefined) => (!r ? "—" : r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

/** Row geometry in weeks: prep (before sowing) → late-start buffer → maturity. */
function rowParts(r: TimeframeRow) {
  const prep = r.remediation_weeks ?? null;
  const prepEnd = prep?.max ?? 0;
  const buf = r.buffer_weeks?.max ?? 0;
  const m = r.maturity_weeks;
  const sowSpanMax = r.total_weeks?.max ?? buf + m.max;
  const fullMax = r.full_timeline_weeks?.max ?? prepEnd + sowSpanMax;
  return { prep, prepEnd, buf, m, bufEnd: prepEnd + buf, matMinEnd: prepEnd + buf + m.min, fullMax };
}

export default function TimeframeStep() {
  const plan = useTerraform((s) => s.plan);
  const go = useGo();
  const [asTable, setAsTable] = useState(false);
  if (!plan) return <NeedPlan />;
  const tf = plan.workflow.timeframe;
  const wet = tf.wet_season_weeks_remaining;
  const known = typeof wet === "number";
  const rows = arr(tf.rows);
  const hasPrep = !!tf.remediation || rows.some((r) => r.remediation_weeks);

  const estimate = () => {
    requestObservationFieldFocus("wet_season");
    go("observation_log");
  };

  return (
    <div className="grid gap-5">
      <div className={cx("grid gap-5", tf.remediation ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        <Panel className="hero-ring p-5">
          <SectionTitle icon={<CloudRain className="h-4 w-4" aria-hidden />} eyebrow="Wet season" title="Weeks of rain remaining" />
          {known ? (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-black text-gradient-cv">~{wet}</span>
              <span className="font-heading text-mist">weeks (your estimate)</span>
            </div>
          ) : (
            <Badge tone="amber" icon={<TriangleAlert className="h-3 w-3" aria-hidden />}>Season length unknown</Badge>
          )}
          {tf.season_assumption && <p className="mt-3 text-sm leading-relaxed text-ivory/80">{tf.season_assumption}</p>}
          <button type="button" className="btn-ghost mt-4 !py-1.5 text-sm" onClick={estimate}>
            <Pencil className="h-4 w-4" aria-hidden /> {known ? "Change estimate" : "Estimate it"}
          </button>
        </Panel>

        {tf.remediation && (
          <Panel className="p-5">
            <SectionTitle icon={<Hammer className="h-4 w-4" aria-hidden />} eyebrow="Before sowing" title="Soil preparation" />
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-black text-ivory">{rangeText(tf.remediation.weeks)}</span>
              <span className="font-heading text-mist">weeks of prep</span>
            </div>
            {tf.remediation.explanation && <p className="mt-3 text-sm leading-relaxed text-ivory/80">{tf.remediation.explanation}</p>}
            {tf.remediation.kb_id && <EvidenceChips evidence={{ kb_ids: [tf.remediation.kb_id], source_ids: [] }} compact className="mt-3" />}
          </Panel>
        )}

        {tf.buffer && (
          <Panel className="p-5">
            <SectionTitle icon={<Hourglass className="h-4 w-4" aria-hidden />} eyebrow="Safety margin" title="Late-start buffer" />
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-black text-ivory">{rangeText(tf.buffer.weeks)}</span>
              <span className="font-heading text-mist">extra weeks</span>
            </div>
            {tf.buffer.explanation && <p className="mt-3 text-sm leading-relaxed text-ivory/80">{tf.buffer.explanation}</p>}
            {tf.buffer.kb_id && <EvidenceChips evidence={{ kb_ids: [tf.buffer.kb_id], source_ids: [] }} compact className="mt-3" />}
          </Panel>
        )}
      </div>

      {!known && (
        <Panel className="flex flex-wrap items-start gap-4 !border-amber/30 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber/10 text-amber">
            <CalendarClock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-lg font-semibold text-amber-100">Season length unknown — fit cannot be determined</div>
            {tf.comparison && <p className="mt-1 leading-relaxed text-ivory/80">{tf.comparison}</p>}
          </div>
          <button type="button" className="btn-warm" onClick={estimate}>
            <Pencil className="h-4 w-4" aria-hidden /> Go back and estimate it
          </button>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionTitle
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
          eyebrow={hasPrep ? "Full timeline · weeks from today" : "Weeks from sowing"}
          title={hasPrep ? "Prep, buffer and crop time vs wet window" : "Crop time vs wet window"}
          right={
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
              <Table2 className="h-4 w-4" aria-hidden /> {asTable ? "Show chart" : "Show table"}
            </button>
          }
        />
        {known && tf.comparison && <p className="mb-4 text-sm leading-relaxed text-ivory/80">{tf.comparison}</p>}
        {rows.length === 0 ? (
          <Empty>No timeframe rows returned.</Empty>
        ) : asTable ? (
          <TimeTable rows={rows} hasPrep={hasPrep} />
        ) : (
          <TimeChart rows={rows} wet={known ? wet! : null} hasPrep={hasPrep} />
        )}
      </Panel>

      {tf.calendar && arr(tf.calendar.phases).length > 0 && <SeasonCalendar calendar={tf.calendar} />}

      {tf.soil_recovery_note?.text && (
        <Panel className="flex items-start gap-3 !border-sprout/25 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sprout/10 text-sprout">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Beyond this season</div>
            <div className="font-heading font-semibold text-ivory">Soil recovery note</div>
            <p className="mt-1 text-sm leading-relaxed text-ivory/80">{tf.soil_recovery_note.text}</p>
            {tf.soil_recovery_note.kb_id && <EvidenceChips evidence={{ kb_ids: [tf.soil_recovery_note.kb_id], source_ids: [] }} compact className="mt-2" />}
          </div>
        </Panel>
      )}

      <div className="border-t border-white/8 pt-3">
        <EvidenceChips evidence={tf.evidence} />
      </div>
    </div>
  );
}

function Seg({ left, width, color, striped, opacity = 1, delay }: { left: string; width: string; color: string; striped?: boolean; opacity?: number; delay: number }) {
  return (
    <motion.div
      className={cx("absolute inset-y-0 rounded-r-[4px]", striped && "stripes")}
      style={{ left, backgroundColor: color, opacity }}
      initial={{ width: 0 }}
      animate={{ width }}
      transition={{ delay, duration: 0.45 }}
    />
  );
}

function TimeChart({ rows, wet, hasPrep }: { rows: TimeframeRow[]; wet: number | null; hasPrep: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const parts = rows.map(rowParts);
  const maxData = Math.max(...parts.map((p) => p.fullMax), ...(wet !== null ? parts.map((p) => p.prepEnd + wet) : [0]));
  const step = maxData > 24 ? 4 : 2;
  const domain = Math.ceil((maxData + 1) / step) * step;
  const pct = (w: number) => `${(Math.max(0, Math.min(w, domain)) / domain) * 100}%`;
  const w = (a: number, b: number, gap = true) => `calc(${pct(Math.max(0, b - a))} - ${gap ? GAP : 0}px)`;
  const ticks = Array.from({ length: domain / step + 1 }, (_, i) => i * step);

  return (
    <figure>
      <figcaption className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mist">
        {hasPrep && <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm" style={{ background: C_PREP }} aria-hidden /> Soil prep (before sowing)</span>}
        <span className="flex items-center gap-2"><span className="stripes h-3 w-5 rounded-sm" style={{ backgroundColor: C_BUFFER }} aria-hidden /> Late-start buffer</span>
        <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm" style={{ background: C_MATURITY }} aria-hidden /> Crop maturity</span>
        <span className="flex items-center gap-2"><span className="stripes h-3 w-5 rounded-sm" style={{ backgroundColor: C_MATURITY, opacity: 0.6 }} aria-hidden /> Maturity range</span>
        {wet !== null && (
          <span className="flex items-center gap-2"><span className="h-4 w-0.5 bg-ivory" aria-hidden /> Rains end (~{wet} wk after sowing{hasPrep ? ", counted from end of prep" : ""})</span>
        )}
      </figcaption>

      <div className="grid grid-cols-[minmax(7rem,11rem)_1fr] gap-x-4">
        {rows.map((r, i) => {
          const p = parts[i];
          const isHover = hover === r.crop_id;
          const mEnd = p.bufEnd + p.m.max;
          return (
            <div key={r.crop_id} className="contents">
              <div className="flex flex-col justify-center border-b border-white/5 py-3">
                <span className="font-heading text-sm font-semibold text-ivory">{r.name}</span>
                <span className="mt-1"><SeasonFitBadge fit={r.season_fit} /></span>
              </div>
              <div
                className="relative border-b border-white/5 py-3"
                onMouseEnter={() => setHover(r.crop_id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(r.crop_id)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="img"
                aria-label={`${r.name}: ${p.prep ? `prep ${rangeText(p.prep)} weeks, then ` : ""}buffer up to ${p.buf} weeks, maturity ${p.m.min} to ${p.m.max} weeks; full timeline up to ${p.fullMax} weeks${wet !== null ? `; rains end about ${wet} weeks after sowing` : ""}. ${r.explanation}`}
              >
                {ticks.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: pct(t) }} aria-hidden />
                ))}
                {wet !== null && (
                  <>
                    <span className="absolute inset-y-0 bg-cyan/[0.05]" style={{ left: pct(p.prepEnd), width: pct(wet) }} aria-hidden />
                    <span className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-ivory/90 shadow-[0_0_10px_rgba(244,239,230,0.5)]" style={{ left: pct(p.prepEnd + wet) }} aria-hidden />
                  </>
                )}
                <div className="relative h-[14px]">
                  {p.prepEnd > 0 && <Seg left="0%" width={w(0, p.prepEnd)} color={C_PREP} delay={i * 0.05} />}
                  {p.buf > 0 && <Seg left={pct(p.prepEnd)} width={w(p.prepEnd, p.bufEnd)} color={C_BUFFER} striped delay={0.12 + i * 0.05} />}
                  <Seg left={pct(p.bufEnd)} width={w(p.bufEnd, p.matMinEnd)} color={C_MATURITY} delay={0.24 + i * 0.05} />
                  {p.m.max > p.m.min && <Seg left={pct(p.matMinEnd)} width={w(p.matMinEnd, mEnd, false)} color={C_MATURITY} striped opacity={0.6} delay={0.34 + i * 0.05} />}
                </div>
                <div className="mt-1.5 text-xs text-mist" aria-hidden>
                  {p.prep ? `prep ${rangeText(p.prep)} + ` : ""}buffer {rangeText(r.buffer_weeks)} + crop {rangeText(r.maturity_weeks)} →{" "}
                  <span className="text-ivory/85">{r.full_timeline_weeks ? `${rangeText(r.full_timeline_weeks)} wk total` : `up to ${p.fullMax} wk`}</span>
                </div>
                {isHover && (
                  <div className="glass-strong pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-72 -translate-x-1/2 rounded-xl p-3 text-sm shadow-xl" role="tooltip">
                    <div className="font-heading font-semibold text-ivory">{r.name}</div>
                    <div className="mt-1 grid grid-cols-2 gap-x-2 text-mist">
                      {p.prep && (<><span>Soil prep</span><span className="text-ivory"><Weeks range={p.prep} /></span></>)}
                      <span>Buffer</span><span className="text-ivory"><Weeks range={r.buffer_weeks} /></span>
                      <span>Maturity</span><span className="text-ivory"><Weeks range={r.maturity_weeks} /></span>
                      <span>Sowing → harvest</span><span className="text-ivory"><Weeks range={r.total_weeks} /></span>
                      {r.full_timeline_weeks && (<><span>Full timeline</span><span className="text-ivory"><Weeks range={r.full_timeline_weeks} /></span></>)}
                    </div>
                    {r.explanation && <p className="mt-2 text-ivory/80">{r.explanation}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div />
        <div className="relative h-7">
          {ticks.map((t) => (
            <span key={t} className="absolute top-1.5 -translate-x-1/2 font-mono text-xs text-mist" style={{ left: pct(t) }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1 text-right text-xs text-mist">weeks{hasPrep ? " from today (prep starts now)" : " from sowing"}</div>
    </figure>
  );
}

function TimeTable({ rows, hasPrep }: { rows: TimeframeRow[]; hasPrep: boolean }) {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left font-heading text-xs uppercase tracking-wider text-mist">
            <th className="py-2 pr-3" scope="col">Crop</th>
            {hasPrep && <th className="py-2 pr-3" scope="col">Soil prep</th>}
            <th className="py-2 pr-3" scope="col">Buffer</th>
            <th className="py-2 pr-3" scope="col">Maturity</th>
            <th className="py-2 pr-3" scope="col">Sowing → harvest</th>
            {hasPrep && <th className="py-2 pr-3" scope="col">Full timeline</th>}
            <th className="py-2 pr-3" scope="col">Season fit</th>
            <th className="py-2" scope="col">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.crop_id} className="border-t border-white/8 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-heading font-semibold text-ivory">{r.name}</th>
              {hasPrep && <td className="py-2 pr-3 text-ivory/85"><Weeks range={r.remediation_weeks} /></td>}
              <td className="py-2 pr-3 text-ivory/85"><Weeks range={r.buffer_weeks} /></td>
              <td className="py-2 pr-3 text-ivory/85"><Weeks range={r.maturity_weeks} /></td>
              <td className="py-2 pr-3 text-ivory/85"><Weeks range={r.total_weeks} /></td>
              {hasPrep && <td className="py-2 pr-3 text-ivory/85"><Weeks range={r.full_timeline_weeks} /></td>}
              <td className="py-2 pr-3"><SeasonFitBadge fit={r.season_fit} /></td>
              <td className="py-2 text-mist">{r.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeasonCalendar({ calendar }: { calendar: { kb_id: string; phases: { when: string; actions: string[] }[] } }) {
  const phases = calendar.phases;
  return (
    <Panel className="p-5">
      <SectionTitle
        icon={<CalendarRange className="h-4 w-4" aria-hidden />}
        eyebrow="Relative to R — no calendar dates"
        title="Season calendar (relative to the first reliable rain, R)"
        right={calendar.kb_id ? <EvidenceChips evidence={{ kb_ids: [calendar.kb_id], source_ids: [] }} compact /> : undefined}
      />
      <ol className="scroll-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2" aria-label="Season phases in order">
        {phases.map((ph, i) => (
          <li key={i} className="relative w-64 shrink-0 snap-start">
            <div className="mb-3 flex items-center gap-2" aria-hidden>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan/50 bg-midnight font-display text-[0.7rem] font-bold text-cyan-100">
                {i + 1}
              </span>
              {i < phases.length - 1 && <span className="h-px flex-1 bg-gradient-to-r from-cyan/50 to-violet/30" />}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="font-heading font-semibold text-ivory">{ph.when}</div>
              <BulletList items={arr(ph.actions)} tone="cyan" className="mt-2" />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
