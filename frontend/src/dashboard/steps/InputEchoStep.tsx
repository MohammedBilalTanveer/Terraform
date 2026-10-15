import { Camera, CircleHelp, Eye, MessageSquareQuote, Pencil, Tags, Users } from "lucide-react";
import { api } from "../../api/terraformApi";
import { useTerraform } from "../../store/terraformStore";
import EvidenceChips from "../../components/EvidenceChips";
import { Badge, Empty, Panel, SectionTitle, arr } from "../../components/ui";
import { NeedAnalysis, SourceBadge, useGo } from "./common";

export default function InputEchoStep() {
  const analysis = useTerraform((s) => s.analysis);
  const observation = useTerraform((s) => s.observation);
  const previewUrl = useTerraform((s) => s.photoPreviewUrl);
  const go = useGo();
  if (!analysis) return <NeedAnalysis />;
  const echo = analysis.input_echo;
  const photoSrc = previewUrl ?? (observation?.photo_id ? api.photoUrl(observation.photo_id) : null);

  return (
    <div className="grid gap-5">
      <Panel className="hero-ring p-5 sm:p-6">
        <SectionTitle
          icon={<MessageSquareQuote className="h-4 w-4" aria-hidden />}
          eyebrow="Verbatim"
          title="What you wrote"
          right={
            <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => go("observation_log")}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit observation
            </button>
          }
        />
        <blockquote className="rounded-xl border-l-2 border-cyan/60 bg-midnight/50 px-4 py-3 text-[1.02rem] italic leading-relaxed text-ivory/90">
          “{echo.user_text}”
        </blockquote>
        {echo.faithful_summary && (
          <div className="mt-4">
            <div className="eyebrow mb-1">What the system heard</div>
            <p className="leading-relaxed text-ivory/85">{echo.faithful_summary}</p>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle icon={<Eye className="h-4 w-4" aria-hidden />} title="You observed" right={<Badge tone="cyan">{arr(echo.observed_facts).length}</Badge>} />
          {arr(echo.observed_facts).length ? (
            <ul className="space-y-2">
              {echo.observed_facts.map((f, i) => (
                <li key={i} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ivory">{f.fact}</span>
                    <SourceBadge source={f.source} />
                  </div>
                  {f.matched_text && <div className="mt-1 text-sm text-mist">matched: <mark className="rounded bg-violet/20 px-1 text-violet-100">“{f.matched_text}”</mark></div>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No facts could be matched from your description yet.</Empty>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<CircleHelp className="h-4 w-4" aria-hidden />} title="Not provided yet" right={<Badge tone="amber">{arr(echo.not_provided).length}</Badge>} />
          {arr(echo.not_provided).length ? (
            <ul className="space-y-2">
              {echo.not_provided.map((n) => (
                <li key={n.field} className="rounded-xl border border-dashed border-amber/25 bg-amber/[0.04] px-3 py-2.5">
                  <div className="font-heading font-semibold text-amber-100">{n.label}</div>
                  <div className="mt-0.5 text-sm text-mist">{n.why_it_matters}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing important is missing.</Empty>
          )}
          {arr(echo.not_provided).length > 0 && (
            <button type="button" className="btn-ghost mt-3 !py-1.5 text-sm" onClick={() => go("observation_log")}>
              <Pencil className="h-4 w-4" aria-hidden /> Add these details
            </button>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle icon={<Camera className="h-4 w-4" aria-hidden />} title="Photo" />
          <div className="flex items-start gap-4">
            {photoSrc && echo.photo_status !== "not_provided" ? (
              <img src={photoSrc} alt="The land photo you attached" className="h-24 w-32 shrink-0 rounded-lg border border-white/10 object-cover" />
            ) : null}
            <div>
              <Badge tone={echo.photo_status === "not_provided" ? "stone" : "cyan"}>
                {echo.photo_status === "not_provided" ? "No photo" : "Attached · not analysed"}
              </Badge>
              {echo.photo_message && <p className="mt-2 text-sm text-mist">{echo.photo_message}</p>}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<Users className="h-4 w-4" aria-hidden />} title="Local advice" />
          {echo.local_advice?.provided ? (
            <>
              <blockquote className="rounded-lg border-l-2 border-amber/60 bg-amber/5 px-3 py-2 italic text-ivory/90">“{echo.local_advice.text}”</blockquote>
              <p className="mt-2 text-sm text-mist">{echo.local_advice.handling}</p>
            </>
          ) : (
            <p className="text-sm text-mist">{echo.local_advice?.handling || "No local advice was given."}</p>
          )}
        </Panel>
      </div>

      <Panel className="p-5">
        <SectionTitle icon={<Tags className="h-4 w-4" aria-hidden />} eyebrow="Machine-readable" title="Derived tags" right={<Badge tone="violet">{arr(analysis.derived_tags).length}</Badge>} />
        <ul className="flex flex-wrap gap-2">
          {arr(analysis.derived_tags).map((t) => (
            <li key={t.tag + t.source} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5" title={t.matched_text ? `matched “${t.matched_text}”` : undefined}>
              <span className="text-sm text-ivory">{t.label}</span>
              <code className="font-mono text-xs text-mist">{t.tag}</code>
              <SourceBadge source={t.source} />
            </li>
          ))}
        </ul>
        {arr(echo.checks_already_done).length > 0 && (
          <div className="mt-4">
            <div className="eyebrow mb-1.5">Field checks already done</div>
            <ul className="flex flex-wrap gap-2">
              {echo.checks_already_done.map((c) => (
                <li key={c.check_id}><Badge tone="sprout">{c.label}</Badge></li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 border-t border-white/8 pt-3">
          <EvidenceChips evidence={analysis.steps?.input_echo?.evidence ?? analysis.evidence} />
        </div>
      </Panel>
    </div>
  );
}
