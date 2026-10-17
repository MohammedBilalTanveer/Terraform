// One diagnostic check as an outcome card (used on Step 3 diagnose, Step 8 "before you sow", Step 9 "after sowing").
// Everything shown comes from the API's CheckCard (KB text); the outcome buttons call the shared store actions.
import { useState } from "react";
import { motion } from "framer-motion";
import { Ban, ChevronDown, FlaskConical, Lock, ShieldAlert } from "lucide-react";
import type { CheckCard } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import EvidenceChips from "./EvidenceChips";
import { Spinner } from "./LoadingAndError";
import { Badge, BulletList, arr, cx } from "./ui";

/** The baking-soda ("sodium bicarbonate") fizz test and any other weak-evidence check. */
export const isRoughClue = (c: CheckCard) => !!c.weak_evidence || /fizz|baking.?soda|sodium/i.test(`${c.id} ${c.title}`);

/** Has the user recorded an outcome (or said they cannot do it) for this check? */
export function useCheckProgress(cards: CheckCard[]) {
  const outcomes = useTerraform((s) => s.checkOutcomes);
  const unable = useTerraform((s) => s.unableChecks ?? []);
  const done = cards.filter((c) => outcomes.some((o) => o.check_id === c.id) || !!c.user_outcome).length;
  const skipped = cards.filter((c) => unable.includes(c.id) && !outcomes.some((o) => o.check_id === c.id)).length;
  return { done, skipped, total: cards.length };
}

export default function CheckCardView({ card, defaultHowOpen }: { card: CheckCard; defaultHowOpen?: boolean }) {
  const outcomes = useTerraform((s) => s.checkOutcomes);
  const unable = useTerraform((s) => s.unableChecks ?? []);
  const setCheckOutcome = useTerraform((s) => s.setCheckOutcome);
  const setCheckUnable = useTerraform((s) => s.setCheckUnable);
  const loading = useTerraform((s) => s.loading);
  const [pending, setPending] = useState<string | null>(null);
  const roughClue = isRoughClue(card);
  const [howOpen, setHowOpen] = useState(defaultHowOpen ?? roughClue);

  const isUnable = unable.includes(card.id);
  const selected = outcomes.find((o) => o.check_id === card.id)?.outcome_id ?? (isUnable ? null : card.user_outcome);
  const chosen = arr(card.possible_outcomes).find((o) => o.outcome_id === selected);
  const busy = !!loading;

  const choose = async (outcome: string | null, key: string) => {
    setPending(key);
    if (isUnable) await setCheckUnable(card.id, false);
    await setCheckOutcome(card.id, outcome);
    setPending(null);
  };
  const markUnable = async () => {
    setPending("unable");
    await setCheckUnable(card.id, !isUnable);
    setPending(null);
  };

  const optBtn = (key: string, label: string, on: boolean, onClick: () => void, tone: "cyan" | "stone" | "coral" = "cyan") => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={cx(
        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-60",
        on
          ? tone === "coral"
            ? "border-coral/60 bg-coral/15 text-rose-100"
            : tone === "stone"
              ? "border-white/30 bg-white/10 text-ivory"
              : "border-cyan/60 bg-gradient-to-r from-cyan/20 to-violet/15 text-ivory"
          : "border-white/10 bg-white/[0.03] text-mist hover:border-white/25 hover:text-ivory",
      )}
    >
      {pending === key && <Spinner />}
      {label}
    </button>
  );

  return (
    <article
      id={`check-${card.id}`}
      className={cx("glass scroll-mt-28 rounded-2xl p-5", roughClue && "!border-amber/35")}
      aria-labelledby={`chk-${card.id}`}
      data-incomplete={!selected && !isUnable ? "true" : undefined}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan-100">
            <FlaskConical className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <h4 id={`chk-${card.id}`} className="font-heading text-[1.05rem] font-semibold text-ivory">{card.title}</h4>
            {card.purpose && <p className="mt-0.5 text-sm text-mist">{card.purpose}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {roughClue && (
            <Badge tone="amber" icon={<ShieldAlert className="h-3 w-3" aria-hidden />}>Rough clue — not a pH test</Badge>
          )}
          {card.gate_relevant && <Badge tone="violet" icon={<Lock className="h-3 w-3" aria-hidden />}>Affects planting gate</Badge>}
        </div>
      </header>

      {roughClue && arr(card.limitations).length > 0 && (
        <div className="mt-3 rounded-xl border border-amber/30 bg-amber/[0.07] p-3">
          <BulletList items={card.limitations} tone="amber" />
        </div>
      )}

      {(card.explanation || arr(card.actions).length > 0 || arr(card.everyday_amounts).length > 0 || arr(card.safety_notes).length > 0) && (
        <button
          type="button"
          onClick={() => setHowOpen((o) => !o)}
          aria-expanded={howOpen}
          className="mt-3 flex min-h-10 items-center gap-1.5 font-heading text-sm font-semibold text-cyan-200 hover:text-ivory"
        >
          <ChevronDown className={cx("h-4 w-4 transition-transform", howOpen && "rotate-180")} aria-hidden />
          {howOpen ? "Hide how to do this check" : "How to do this check"}
        </button>
      )}
      {howOpen && (
        <>
      {card.explanation && <p className="mt-3 leading-relaxed text-ivory/85">{card.explanation}</p>}
      {arr(card.actions).length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-2">How to do it</div>
          <BulletList items={card.actions} ordered tone="cyan" />
        </div>
      )}
      {arr(card.everyday_amounts).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.everyday_amounts.map((a, i) => (
            <span key={i} className="rounded-lg border border-cyan/15 bg-cyan/[0.05] px-2.5 py-1 text-sm text-ivory/90">{a}</span>
          ))}
        </div>
      )}
      {arr(card.safety_notes).length > 0 && (
        <div className="mt-3 rounded-xl border border-amber/25 bg-amber/[0.05] p-3">
          <BulletList items={card.safety_notes} tone="amber" />
        </div>
      )}
      {!roughClue && arr(card.limitations).length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-mist hover:text-ivory">Limitations</summary>
          <BulletList items={card.limitations} tone="amber" className="mt-2" />
        </details>
      )}

        </>
      )}

      <div className="mt-4 rounded-xl border border-white/8 bg-midnight/40 p-3">
        <div className="eyebrow mb-2">What happened?</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Outcome for ${card.title}`}>
          {optBtn("none", "Not tried", !selected && !isUnable, () => void choose(null, "none"), "stone")}
          {arr(card.possible_outcomes).map((o) => optBtn(o.outcome_id, o.label, selected === o.outcome_id, () => void choose(o.outcome_id, o.outcome_id)))}
          {optBtn("unable", "Unable to do", isUnable, () => void markUnable(), "coral")}
        </div>
        {chosen && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border border-cyan/20 bg-cyan/[0.06] px-3 py-2 text-sm text-ivory/90">
            {chosen.interpretation}
          </motion.p>
        )}
        {isUnable && (
          <p className="mt-3 flex items-center gap-2 text-sm text-mist">
            <Ban className="h-4 w-4 text-coral" aria-hidden /> Recorded as not possible — this stays an open unknown.
          </p>
        )}
      </div>

      <footer className="mt-4 border-t border-white/8 pt-3">
        <EvidenceChips evidence={card.evidence} compact />
      </footer>
    </article>
  );
}

