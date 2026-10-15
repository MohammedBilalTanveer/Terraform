// Steps 2–3 at the Soil Inspection Patch (and the Runoff Gully survey): echo, unknowns, checks, plan.
import { FileText, FlaskConical, HelpCircle, Map as MapIcon, Sprout } from "lucide-react";
import type { CheckCard } from "../../types/terraform";
import { useTerraform } from "../../store/terraformStore";
import { useGame } from "../gameStore";
import { Bullets, Busy, Card, Chips, DetailsButton, ErrorNote, GlassPanel, PrimaryButton, Pill, Section, cx } from "./kit";

function CheckCardView({ check }: { check: CheckCard }) {
  const setCheckOutcome = useTerraform((s) => s.setCheckOutcome);
  const outcomes = useTerraform((s) => s.checkOutcomes);
  const loading = useTerraform((s) => s.loading);
  const chosen = outcomes.find((c) => c.check_id === check.id)?.outcome_id ?? check.user_outcome;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-1.5">
        <FlaskConical className="h-4 w-4 text-cyan-300" aria-hidden />
        <h4 className="font-heading text-[14px] font-semibold">{check.title}</h4>
        {check.weak_evidence && <Pill tone="amber">Weak clue only</Pill>}
        {check.gate_relevant && <Pill tone="violet">Affects planting gate</Pill>}
      </div>
      {check.purpose && <p className="mt-1.5 text-[13px] text-ivory/85">{check.purpose}</p>}
      <div className="mt-2">
        <Bullets items={check.actions} />
      </div>
      {check.everyday_amounts?.length > 0 && (
        <div className="mt-2">
          <Bullets items={check.everyday_amounts} />
        </div>
      )}
      {check.safety_notes?.length > 0 && (
        <div className="mt-2">
          <Bullets items={check.safety_notes} tone="safety" />
        </div>
      )}
      <div className="mt-3 text-[11px] font-semibold text-cyan-200/90">What did you find?</div>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {check.possible_outcomes.map((o) => (
          <button
            key={o.outcome_id}
            type="button"
            disabled={!!loading}
            onClick={() => void setCheckOutcome(check.id, chosen === o.outcome_id ? null : o.outcome_id)}
            className={cx(
              "rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] transition disabled:opacity-50",
              chosen === o.outcome_id ? "border-cyan-300/70 bg-cyan-400/15" : "border-white/12 bg-white/[0.03] hover:border-white/30",
            )}
          >
            <div className="font-medium text-ivory">{o.label}</div>
            {chosen === o.outcome_id && o.interpretation && <div className="mt-0.5 text-[12px] text-cyan-100/85">{o.interpretation}</div>}
          </button>
        ))}
      </div>
      <div className="mt-2.5">
        <Chips evidence={check.evidence} />
      </div>
    </Card>
  );
}

export default function SoilPanel({ onClose, mode = "soil" }: { onClose: () => void; mode?: "soil" | "gully" }) {
  const analysis = useTerraform((s) => s.analysis);
  const plan = useTerraform((s) => s.plan);
  const loading = useTerraform((s) => s.loading);
  const error = useTerraform((s) => s.error);
  const generatePlan = useTerraform((s) => s.generatePlan);
  const toast = useTerraform((s) => s.toast);
  const setOverlay = useGame((s) => s.setOverlay);
  const setTargetOverride = useGame((s) => s.setTargetOverride);

  const title = mode === "gully" ? "Runoff Gully — field survey" : "Soil Inspection Patch";
  if (!analysis) {
    return (
      <GlassPanel title={title} kicker="NO OBSERVATIONS YET" steps={["input_echo", "missing_analysis"]} onClose={onClose}>
        <Card>
          <p className="text-[13px] text-ivory/85">There is nothing to inspect against yet. Log your observations at the Observation Board first.</p>
          <div className="mt-3">
            <PrimaryButton
              onClick={() => {
                setTargetOverride("board");
                setOverlay(null);
              }}
            >
              <MapIcon className="h-4 w-4" /> Guide me to the board
            </PrimaryButton>
          </div>
        </Card>
      </GlassPanel>
    );
  }
  const echo = analysis.input_echo;
  const ma = analysis.missing_analysis;

  const onPlan = async () => {
    const p = await generatePlan();
    if (p) {
      toast("success", "Plan generated from the knowledge base.");
      setOverlay(null);
    }
  };

  return (
    <GlassPanel
      title={title}
      kicker={mode === "gully" ? "SURVEY · WHAT YOU REPORTED" : "INSPECT · ECHO · UNKNOWNS"}
      steps={["input_echo", "missing_analysis"]}
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DetailsButton step="missing_analysis" />
          <PrimaryButton tone="sprout" onClick={() => void onPlan()} disabled={loading === "plan" || loading === "analyze"}>
            <Sprout className="h-4 w-4" /> {plan ? "Regenerate plan" : "Generate plan"}
          </PrimaryButton>
        </div>
      }
    >
      {loading === "analyze" && <Busy label="Re-checking your observations…" />}
      {loading === "plan" && <Busy label="Building your plan from the knowledge base…" />}
      {error && <ErrorNote message={error} />}

      <Section title="What you told me" right={<Chips evidence={analysis.steps.input_echo?.evidence} />}>
        <Card>
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ivory/50" aria-hidden />
            <blockquote className="text-[13px] italic leading-relaxed text-ivory/80">“{echo.user_text}”</blockquote>
          </div>
          {echo.faithful_summary && <p className="mt-2 text-[13px] text-cyan-50/90">{echo.faithful_summary}</p>}
        </Card>
        {echo.observed_facts.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Observed facts">
            {echo.observed_facts.map((f, i) => (
              <li key={i} title={`source: ${f.source}${f.matched_text ? ` — “${f.matched_text}”` : ""}`} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] text-ivory/85">
                {f.fact} <span className="text-ivory/40">· {f.source}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 text-[12px] text-ivory/70">
          <Pill tone={echo.photo_status === "attached_not_analyzed" ? "cyan" : "muted"}>photo: {echo.photo_status.replace(/_/g, " ")}</Pill>
          {echo.photo_message && <span>{echo.photo_message}</span>}
        </div>
        {echo.local_advice?.provided && (
          <Card className="border-amber-300/25">
            <div className="text-[11px] font-semibold text-amber-200">Local advice</div>
            <p className="text-[13px] italic text-ivory/85">“{echo.local_advice.text}”</p>
            <p className="mt-1 text-[12px] text-amber-100/80">{echo.local_advice.handling}</p>
          </Card>
        )}
      </Section>

      {echo.not_provided.length > 0 && (
        <Section title="Not provided yet">
          <ul className="space-y-1.5">
            {echo.not_provided.map((n) => (
              <li key={n.field} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[12.5px]">
                <div className="flex items-center gap-1.5 font-medium">
                  <HelpCircle className="h-3.5 w-3.5 text-amber-300" aria-hidden /> {n.label}
                </div>
                <div className="text-ivory/65">{n.why_it_matters}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Land type match" right={<Chips evidence={ma.archetype.evidence} />}>
        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-heading text-[14px] font-semibold">{ma.archetype.label}</span>
            <Pill tone={ma.archetype.match_strength === "strong" ? "sprout" : ma.archetype.match_strength === "partial" ? "amber" : "coral"}>{ma.archetype.match_strength} match</Pill>
          </div>
          <p className="mt-1.5 text-[13px] text-ivory/85">{ma.archetype.statement}</p>
          {ma.archetype.missing_signals.length > 0 && (
            <div className="mt-2 text-[12px] text-ivory/65">Missing signals: {ma.archetype.missing_signals.join(", ")}</div>
          )}
        </Card>
      </Section>

      {ma.conflicts.length > 0 && (
        <Section title="Conflicts to resolve">
          {ma.conflicts.map((c) => (
            <Card key={c.id} className="border-rose-300/25">
              <div className="font-medium">{c.label}</div>
              <p className="text-[12.5px] text-ivory/80">{c.explanation}</p>
              <div className="mt-1.5">
                <Chips evidence={c.evidence} />
              </div>
            </Card>
          ))}
        </Section>
      )}

      <Section title={`Unknowns (${ma.unknowns.length})`}>
        {ma.unknowns.length === 0 ? (
          <p className="text-[12.5px] text-ivory/65">No open unknowns reported.</p>
        ) : (
          ma.unknowns.map((u) => (
            <Card key={u.id}>
              <div className="font-medium">{u.label}</div>
              <p className="text-[12.5px] text-ivory/75">{u.why_it_matters}</p>
              <div className="mt-1.5">
                <Chips evidence={u.evidence} />
              </div>
            </Card>
          ))
        )}
      </Section>

      <Section title={`Checks you can do (${ma.checks.length})`}>
        {ma.checks.map((c) => (
          <CheckCardView key={c.id} check={c} />
        ))}
      </Section>
    </GlassPanel>
  );
}
