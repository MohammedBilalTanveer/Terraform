// "Growth & care" tab, restructured so it never becomes a giant scroller:
// sticky stage stepper + Tend & advance, the CURRENT stage in full, everything else as collapsed accordions
// (one open at a time). All text comes from the plan (KB); evidence chips stay inside each accordion.
import { useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Navigation, TimerReset, Wheat } from "lucide-react";
import type { CareStage, PlanResponse } from "../../types/terraform";
import { useGame } from "../gameStore";
import type { WorldView } from "../planData";
import RecCard from "./RecCard";
import { Bullets, Card, Chips, GhostButton, Pill, PrimaryButton, Section, cx } from "./kit";

function Acc({ id, open, onToggle, title, sub, children }: { id: string; open: string | null; onToggle: (id: string) => void; title: string; sub?: string; children: ReactNode }) {
  const isOpen = open === id;
  return (
    <div className={cx("overflow-hidden rounded-xl border bg-white/[0.03]", isOpen ? "border-cyan-300/40" : "border-white/10")}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => onToggle(id)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04]"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-cyan-300" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ivory/50" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{title}</span>
          {sub && <span className="block truncate text-[11px] text-ivory/55">{sub}</span>}
        </span>
      </button>
      {isOpen && <div className="space-y-2 border-t border-white/10 px-3 py-3">{children}</div>}
    </div>
  );
}

function StageBody({ s }: { s: CareStage }) {
  return (
    <>
      {s.timing_description && <p className="text-[12px] text-ivory/65">{s.timing_description}</p>}
      <div className="grid gap-1 text-[12.5px]">
        {s.water && <div><span className="text-cyan-200/90">Water: </span>{s.water}</div>}
        {s.mulch && <div><span className="text-cyan-200/90">Mulch: </span>{s.mulch}</div>}
        {s.nutrients && <div><span className="text-cyan-200/90">Nutrients: </span>{s.nutrients}</div>}
        {s.weeds && <div><span className="text-cyan-200/90">Weeds: </span>{s.weeds}</div>}
        {s.dry_spell && <div><span className="text-amber-200/90">Dry spell: </span>{s.dry_spell}</div>}
      </div>
      <Bullets items={s.actions} />
      {s.watch_for.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-amber-200/90">Watch for</div>
          <Bullets items={s.watch_for} tone="warn" />
        </div>
      )}
      <Chips evidence={s.evidence} />
    </>
  );
}

export default function CareTab({
  plan,
  view,
  stages,
  sown,
  onAdvance,
  onFinish,
}: {
  plan: PlanResponse;
  view: WorldView;
  stages: CareStage[];
  sown: boolean;
  onAdvance: () => void;
  onFinish: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null); // one open item at a time
  const [grp, setGrp] = useState<string | null>(null); // one open group at a time
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const toggleGrp = (id: string) => {
    setGrp((g) => (g === id ? null : id));
    setOpen(null);
  };
  const oc = plan.workflow.ongoing_care;
  const last = Math.max(0, stages.length - 1);
  const cur = sown ? stages[view.careIdx] : undefined;
  const careDone = view.careDone && view.careIdx >= last;
  const ready = view.stage === "harvest_ready";
  const setTargetOverride = useGame((s) => s.setTargetOverride);
  const setOverlay = useGame((s) => s.setOverlay);
  const say = useGame((s) => s.say);

  return (
    <div className="space-y-3">
      {/* sticky header: stepper + the one action that matters */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-white/10 bg-[#0a1124] px-4 pb-2.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-ivory/55">{sown ? `Stage ${view.careIdx + 1} of ${stages.length || 1}` : "Not sown yet"}</div>
            <div className="truncate font-heading text-[15px] font-semibold">{sown ? cur?.label ?? "Growing" : "Preview of the care stages"}</div>
          </div>
          {sown && !careDone && view.careIdx < last && (
            <PrimaryButton tone="sprout" onClick={onAdvance}>
              <TimerReset className="h-4 w-4" /> Tend & advance
            </PrimaryButton>
          )}
          {sown && !careDone && view.careIdx >= last && (
            <PrimaryButton tone="amber" onClick={onFinish}>
              <Wheat className="h-4 w-4" /> Finish care
            </PrimaryButton>
          )}
          {ready && (
            <GhostButton
              onClick={() => {
                setTargetOverride("harvest");
                say("Head to the Harvest Point.");
                setOverlay(null);
              }}
            >
              <Navigation className="h-3.5 w-3.5" /> Harvest Point
            </GhostButton>
          )}
        </div>
        <div className="mt-2 flex gap-1" role="list" aria-label="Care stages">
          {stages.map((s, i) => {
            const done = sown && (i < view.careIdx || (careDone && i === last));
            const current = sown && i === view.careIdx && !careDone;
            return (
              <button
                key={s.id}
                type="button"
                role="listitem"
                onClick={() => {
                  setGrp("group:stages");
                  setOpen(`stage:${s.id}`);
                }}
                title={s.label}
                className={cx(
                  "flex min-h-8 flex-1 items-center justify-center gap-1 truncate rounded-lg border px-1 text-[10.5px] font-medium",
                  done ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : current ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-50" : "border-white/10 bg-white/[0.03] text-ivory/55",
                )}
              >
                {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                <span className="hidden truncate min-[480px]:inline">{s.stage.replace(/_/g, " ")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!sown && (
        <Card>
          <p className="text-[13px] text-ivory/80">Nothing is growing yet. Prepare the plot, pass the readiness gate, choose a crop and sow first — the stages below are a preview.</p>
        </Card>
      )}
      {oc.crop_basis !== "selected" && <p className="text-[11.5px] text-amber-200/80">Care basis: {oc.crop_basis.replace(/_/g, " ")}</p>}
      {ready && (
        <Card className="border-amber-300/30">
          <div className="flex items-center gap-2 text-[13px] text-amber-100">
            <Pill tone="amber">Ready for the Harvest Point</Pill> The last care stage is complete.
          </div>
        </Card>
      )}

      {cur && (
        <Card className="border-cyan-300/40" >
          <div data-incomplete={ready ? undefined : "true"} data-care-current className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-semibold">{cur.label}</span>
              <Pill tone="cyan">current</Pill>
              <Pill tone="muted">{cur.stage.replace(/_/g, " ")}</Pill>
            </div>
            <StageBody s={cur} />
          </div>
        </Card>
      )}

      <Acc id="group:stages" open={grp} onToggle={toggleGrp} title={sown ? "Other stages" : "Care stages"} sub={`${stages.length - (sown ? 1 : 0)} stages — tap to expand`}>
        <div className="space-y-1.5">
          {stages.map((s, i) =>
            sown && i === view.careIdx ? null : (
              <Acc key={s.id} id={`stage:${s.id}`} open={open} onToggle={toggle} title={s.label} sub={s.timing_description || s.stage.replace(/_/g, " ")}>
                <StageBody s={s} />
              </Acc>
            ),
          )}
        </div>
      </Acc>

      {oc.pest_watch.length > 0 && (
        <Acc id="group:pest" open={grp} onToggle={toggleGrp} title={`Pest watch (${oc.pest_watch.length})`} sub="Signs and what to do">
          <div className="space-y-1.5">
            {oc.pest_watch.map((p) => (
              <Acc key={p.id} id={`pest:${p.id}`} open={open} onToggle={toggle} title={p.title}>
                <div className="text-[11px] font-semibold text-amber-200/90">Signs</div>
                <Bullets items={p.signs} tone="warn" />
                <div className="text-[11px] font-semibold text-cyan-200/90">Actions</div>
                <Bullets items={p.actions} />
                {p.bio_options.map((b, i) => (
                  <div key={i} className="rounded-lg bg-white/[0.03] p-2 text-[12px]">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-ivory/70">{b.preparation}</div>
                    <Bullets items={b.safe_use} />
                    <Bullets items={b.cautions} tone="safety" />
                  </div>
                ))}
                <Bullets items={p.cautions} tone="safety" />
                <Chips evidence={p.evidence} />
              </Acc>
            ))}
          </div>
        </Acc>
      )}

      {(oc.stress_mitigation?.length ?? 0) > 0 && (
        <Acc id="group:stress" open={grp} onToggle={toggleGrp} title={`Stress & weather (${oc.stress_mitigation!.length})`}>
          <div className="space-y-1.5">
            {oc.stress_mitigation!.map((r) => (
              <Acc key={r.id} id={`stress:${r.id}`} open={open} onToggle={toggle} title={r.title} sub={r.stressor}>
                {r.explanation && <p className="text-[12.5px] text-ivory/85">{r.explanation}</p>}
                {r.signs?.length > 0 && (
                  <>
                    <div className="text-[11px] font-semibold text-amber-200/90">Signs</div>
                    <Bullets items={r.signs} tone="warn" />
                  </>
                )}
                <Bullets items={r.actions} />
                <Bullets items={r.safety_notes} tone="safety" />
                <Chips evidence={r.evidence} />
              </Acc>
            ))}
          </div>
        </Acc>
      )}

      {(oc.troubleshooting?.length ?? 0) > 0 && (
        <Acc id="group:trouble" open={grp} onToggle={toggleGrp} title={`Troubleshooting (${oc.troubleshooting!.length})`} sub="Symptom → likely cause → action">
          <div className="space-y-1.5">
            {oc.troubleshooting!.map((t) => (
              <Acc key={t.id} id={`trouble:${t.id}`} open={open} onToggle={toggle} title={t.symptom}>
                <div className="text-[11px] font-semibold text-amber-200/90">Likely causes</div>
                <Bullets items={t.likely_causes} tone="warn" />
                <div className="text-[11px] font-semibold text-cyan-200/90">What to do</div>
                <Bullets items={t.actions} />
                <Chips evidence={t.evidence} />
              </Acc>
            ))}
          </div>
        </Acc>
      )}

      {oc.dry_spell_plan.length > 0 && (
        <Acc id="group:dry" open={grp} onToggle={toggleGrp} title={`Dry-spell plan (${oc.dry_spell_plan.length})`} sub="Tasks are done at Water Storage">
          <div className="space-y-1.5">
            {oc.dry_spell_plan.map((r) => (
              <Acc key={r.id} id={`dry:${r.id}`} open={open} onToggle={toggle} title={r.title} sub={r.task_label ?? undefined}>
                <RecCard rec={r} defaultOpen />
              </Acc>
            ))}
          </div>
        </Acc>
      )}
    </div>
  );
}
