"""Observation analysis (workflow steps 01-03): input echo, archetype match, unknowns, checks, conflicts.

  * Archetype: sum the scenario `signals[].weight` of present tags; compare with
    `match_thresholds` (strong / partial, otherwise weak). Never a confident diagnosis.
  * Unknowns: scenario `unknowns` whose `resolved_by_tags` are all absent (an unknown with an empty
    `resolved_by_tags` list can only be resolved by its checks, so it stays open until one is confirmed).
  * Checks: diagnostic checks that apply (applies_when) and resolve an open unknown (via
    `resolves_unknowns` or the unknown's `check_ids`), plus any check the user already confirmed.
    Gate-relevant checks first, weak-evidence checks last.
  * Failure factors (scenario `failure_factors`, v1.1b): observed iff a direct `triggered_by_tags` tag is
    present; likely iff an `indirect_tags` clue is present or `always_likely`; else not_indicated.
    `*_unknown` tags in either list are ignored (an unknown can never make a factor observed or likely).
  * Conflicts: (a) form answer vs. description disagreeing inside one exclusive tag group (neutral text),
    (b) local advice claims (`local_advice_trees_only`) explained with the KB records that mention that tag.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

from .cards import strs, text, to_recommendation
from .evidence import make_evidence
from .kb_loader import KnowledgeBase
from .retrieval import applies, mentions_tag
from .tagging import TagResult, observed_tags

PHOTO_MESSAGE_ATTACHED = "Photo attached; visual analysis is not enabled. The text description was used."
PHOTO_MESSAGE_NONE = "No photo attached. The text description was used."
PHOTO_MESSAGE_CONFIRMED = ("Photo cues you confirmed were used as tentative observations: {labels}. "
                           "A photo cannot show soil chemistry, depth or hardpan continuity.")
FACTOR_ORDER = {"observed": 0, "likely": 1, "not_indicated": 2}
LOCAL_ADVICE_HANDLING = "Treated as a claim to check against your own observations, not as verified fact."
NO_LOCAL_ADVICE = "No local advice was given."
NOT_DIAGNOSIS = "This is not a laboratory diagnosis."

# observation fields that can be left unknown -> tags that mean "provided"
UNKNOWABLE_FIELDS = [
    ("slope", "Slope of the land", ["slope_flat", "slope_slight", "slope_steep"]),
    ("pooling", "Where rainwater pools", ["pooling_none", "pooling_some", "pooling_widespread"]),
    ("digging_resistance", "How continuous the hard layer is",
     ["hardpan_patchy", "hardpan_continuous", "digging_deep_possible"]),
    ("rain_window", "Where you are in the rainy season",
     ["rain_not_started", "rain_just_started", "rain_ongoing", "rain_ending"]),
    ("wet_season_weeks_remaining", "Weeks of rain remaining", ["season_known"]),
    ("available_resources", "Materials and tools you have", None),
    ("local_advice", "What local farmers advise", ["local_advice_trees_only", "local_advice_other"]),
    ("photo_id", "Photo of the land", ["photo_attached"]),
]
RESOURCE_PREFIXES = ("res_",)
SCARCITY_TAGS = {"no_compost", "low_water"}
GENERIC_WHY = "Optional detail; adding it makes the plan more specific."
PHOTO_WHY = "Optional. A photo is kept with your log; it is not analysed."


def archetype(kb: KnowledgeBase, scenario: dict, tr: TagResult) -> dict:
    signals = [s for s in scenario.get("signals") or [] if isinstance(s, dict) and s.get("tag")]
    score = 0.0
    matched, missing = [], []
    for s in signals:
        label = s.get("label") or tr.label(s["tag"])
        if s["tag"] in tr.tag_set:
            score += float(s.get("weight") or 0)
            matched.append(label)
        else:
            missing.append(label)
    th = scenario.get("match_thresholds") or {}
    strong, partial = float(th.get("strong", 6)), float(th.get("partial", 3))
    strength = "strong" if score >= strong else "partial" if score >= partial else "weak"
    label = text(scenario.get("soil_archetype")) or text(scenario.get("title"))
    statement = f"Likely candidate: {label} (match: {strength}). {NOT_DIAGNOSIS}"
    return {
        "scenario_id": scenario["id"],
        "label": label,
        "match_strength": strength,
        "matched_signals": matched,
        "missing_signals": missing,
        "statement": statement,
        "evidence": make_evidence(kb, [scenario["id"]]),
    }


def open_unknowns(scenario: dict, tr: TagResult, confirmed_check_ids: List[str]) -> List[dict]:
    out = []
    for u in scenario.get("unknowns") or []:
        if not isinstance(u, dict):
            continue
        resolved_by = u.get("resolved_by_tags") or []
        if resolved_by and any(t in tr.tag_set for t in resolved_by):
            continue
        if not resolved_by and any(c in confirmed_check_ids for c in u.get("check_ids") or []):
            continue
        out.append(u)
    return out


def unknown_cards(kb: KnowledgeBase, scenario: dict, unknowns: List[dict]) -> List[dict]:
    return [{
        "id": u.get("id", ""),
        "label": text(u.get("label")),
        "why_it_matters": text(u.get("why_it_matters")),
        "check_ids": [c for c in u.get("check_ids") or [] if kb.has(c)],
        "evidence": make_evidence(kb, [scenario["id"], *(u.get("check_ids") or [])]),
    } for u in unknowns]


def check_cards(kb: KnowledgeBase, tr: TagResult, unknowns: List[dict], confirmed: Dict[str, str]) -> List[dict]:
    open_ids = {u.get("id") for u in unknowns}
    label_of = {u.get("id"): text(u.get("label")) for u in unknowns}
    via_unknown: Dict[str, List[str]] = {}
    for u in unknowns:
        for c in u.get("check_ids") or []:
            via_unknown.setdefault(c, []).append(u.get("id"))
    cards = []
    for rec in kb.records("diagnostic_checks"):
        rid = rec["id"]
        resolves = [x for x in rec.get("resolves_unknowns") or [] if x in open_ids]
        for x in via_unknown.get(rid, []):
            if x not in resolves:
                resolves.append(x)
        relevant = bool(resolves) and applies(rec, tr.tag_set)
        if not relevant and rid not in confirmed:
            continue
        why = [label_of[x] for x in resolves if label_of.get(x)]
        card = to_recommendation(kb, rec, tr, "check", why=why or None)
        card.update({
            "purpose": text(rec.get("purpose")) or text(rec.get("summary")),
            "weak_evidence": bool(rec.get("weak_evidence")),
            "gate_relevant": bool(rec.get("gate_relevant")),
            "possible_outcomes": [{
                "outcome_id": str(o.get("outcome_id", "")),
                "label": text(o.get("label")),
                "interpretation": text(o.get("interpretation")),
                "implies_tags": [t for t in o.get("implies_tags") or [] if isinstance(t, str)],
            } for o in rec.get("possible_outcomes") or [] if isinstance(o, dict)],
            "user_outcome": confirmed.get(rid),
        })
        cards.append(card)
    cards.sort(key=lambda c: (c["user_outcome"] is not None, not c["gate_relevant"], c["weak_evidence"]))
    return cards


def local_advice_claim(obs: dict, tr: TagResult) -> Optional[str]:
    """The user's local-advice claim, verbatim: the local_advice field, or the sentence of the
    description in which a local-advice cue matched."""
    field_text = (obs.get("local_advice") or "").strip()
    if field_text:
        return field_text
    desc = obs.get("description") or ""
    for t in tr.tags:
        if t["tag"] in ("local_advice_trees_only", "local_advice_other") and t["source"] == "description":
            phrase = (t.get("matched_text") or "").lower()
            for sentence in re.split(r"(?<=[.!?])\s+|\n+", desc):
                if phrase and phrase in sentence.lower().replace("\u2019", "'"):
                    return sentence.strip()
            return desc.strip() or None
    return None


def local_advice_records(kb: KnowledgeBase, tag: str) -> List[dict]:
    """KB records (checks, treatments, planting methods) that mention a local-advice tag."""
    out = []
    for coll in ("soil_treatments", "diagnostic_checks", "planting_methods"):
        for rec in kb.records(coll):
            if mentions_tag(rec, tag):
                out.append(rec)
    return out


def conflicts(kb: KnowledgeBase, scenario: dict, tr: TagResult) -> List[dict]:
    out = []
    for c in tr.conflicts:
        kept, dropped = c["kept"], c["dropped"]
        out.append({
            "id": f"conflict_{c['group']}",
            "label": f"Two answers disagree: {kept['label']} / {dropped['label']}",
            "explanation": (f"Your {kept['source']} answer ({kept['label']}) and your {dropped['source']} "
                            f"({dropped['label']}) disagree. The {kept['source']} answer was used; a check can settle it."),
            "evidence": make_evidence(kb, [x for x in (kept.get("cue_id"), dropped.get("cue_id")) if x]),
        })
    if "local_advice_trees_only" in tr.tag_set:
        recs = [r for r in local_advice_records(kb, "local_advice_trees_only")
                if r.get("priority") != "avoid"]
        explanation = ""
        ids: List[str] = []
        if recs:
            explanation = text(recs[0].get("summary"))
            ids = [r["id"] for r in recs[:3]]
        if not explanation:
            for u in scenario.get("unknowns") or []:
                if "local_advice_trees_only" in (u.get("resolved_by_tags") or []):
                    explanation = text(u.get("why_it_matters"))
                    ids = [scenario["id"], *(u.get("check_ids") or [])]
                    break
        if explanation:
            out.append({
                "id": "conflict_local_advice_trees_only",
                "label": f"Local advice vs. your observations: {tr.label('local_advice_trees_only')}",
                "explanation": explanation,
                "evidence": make_evidence(kb, ids or [scenario["id"]]),
            })
    return out


def _real_tags(values) -> List[str]:
    return [t for t in values or [] if isinstance(t, str) and not t.endswith("_unknown")]


def failure_factors(kb: KnowledgeBase, scenario: dict, tr: TagResult, confirmed_check_ids: List[str]) -> List[dict]:
    """observed iff a direct triggered_by tag is present; likely iff an indirect clue is present or the
    KB marks the factor always_likely; else not_indicated. *_unknown tags are ignored."""
    out = []
    for f in scenario.get("failure_factors") or []:
        if not isinstance(f, dict) or not f.get("id"):
            continue
        present = [t for t in _real_tags(f.get("triggered_by_tags")) if t in tr.tag_set]
        clues = [t for t in _real_tags(f.get("indirect_tags")) if t in tr.tag_set and t not in present]
        status = "observed" if present else "likely" if (clues or f.get("always_likely")) else "not_indicated"
        addressed = [x for x in f.get("addressed_by") or [] if isinstance(x, str) and kb.has(x)]
        out.append({
            "id": f["id"], "label": text(f.get("label")), "explanation": text(f.get("explanation")),
            "what_is_missing": text(f.get("what_is_missing")), "status": status,
            "triggered_by": [tr.label(t) for t in present], "clues": [tr.label(t) for t in clues],
            "addressed_by": addressed,
            "evidence": make_evidence(kb, [scenario["id"], *addressed], f.get("source_ids") or []),
        })
    out.sort(key=lambda x: FACTOR_ORDER[x["status"]])
    return out


def faithful_summary(tr: TagResult) -> str:
    labels = []
    for t in observed_tags(tr):
        if t["label"] not in labels:
            labels.append(t["label"])
    if not labels:
        return "You reported nothing that matched the knowledge base cues yet."
    return "You reported: " + ", ".join(labels) + "."


def not_provided(scenario: dict, tr: TagResult, obs: dict) -> List[dict]:
    unknowns = [u for u in scenario.get("unknowns") or [] if isinstance(u, dict)]
    out = []
    for fname, flabel, provided_tags in UNKNOWABLE_FIELDS:
        if provided_tags is None:  # resources
            provided = bool(obs.get("available_resources")) or any(
                t.startswith(RESOURCE_PREFIXES) or t in SCARCITY_TAGS for t in tr.tag_set)
            group = [t for t in tr.labels if t.startswith(RESOURCE_PREFIXES)] + list(SCARCITY_TAGS)
        else:
            provided = any(t in tr.tag_set for t in provided_tags)
            group = provided_tags
        if fname == "local_advice":
            provided = provided or bool((obs.get("local_advice") or "").strip())
        if provided:
            continue
        match = next((u for u in unknowns if set(u.get("resolved_by_tags") or []) & set(group)), None)
        why = text(match.get("why_it_matters")) if match else (PHOTO_WHY if fname == "photo_id" else GENERIC_WHY)
        out.append({"field": fname, "label": text(match.get("label")) if match else flabel, "why_it_matters": why})
    return out


def step(step_id: str, status: str, title: str, summary: str, questions=None, warnings=None, evidence=None) -> dict:
    return {"step_id": step_id, "status": status, "title": title, "summary": summary,
            "questions": list(questions or []), "warnings": list(warnings or []),
            "evidence": evidence or {"kb_ids": [], "source_ids": []}}


def analyze(kb: KnowledgeBase, scenario: dict, tr: TagResult, obs: dict) -> dict:
    """Returns the analysis body (without ids/meta), every advice item carrying evidence."""
    confirmed = {c.get("check_id"): c.get("outcome_id") for c in obs.get("user_confirmed_checks") or []
                 if c.get("check_id")}
    arch = archetype(kb, scenario, tr)
    unknowns = open_unknowns(scenario, tr, list(confirmed))
    ucards = unknown_cards(kb, scenario, unknowns)
    checks = check_cards(kb, tr, unknowns, confirmed)
    confs = conflicts(kb, scenario, tr)

    cue_ids = [t["cue_id"] for t in tr.tags if t.get("cue_id")]
    observed = observed_tags(tr)
    summary = faithful_summary(tr)
    photo_attached = "photo_attached" in tr.tag_set
    photo_labels = [t["label"] for t in tr.tags if t["source"] == "photo" and t["tag"] != "photo_attached"]
    advice_text = local_advice_claim(obs, tr)

    checks_done = []
    by_id = {r["id"]: r for r in kb.records("diagnostic_checks")}
    for cid, oid in confirmed.items():
        rec = by_id.get(cid)
        if not rec:
            continue
        lab = next((text(o.get("label")) for o in rec.get("possible_outcomes") or [] if o.get("outcome_id") == oid), oid)
        checks_done.append({"check_id": cid, "outcome_id": oid, "label": f"{text(rec.get('title'))}: {lab}"})

    input_echo = {
        "user_text": obs.get("description") or "",
        "faithful_summary": summary,
        "observed_facts": [{"fact": t["label"], "source": t["source"], "cue_id": t.get("cue_id"),
                            "matched_text": t.get("matched_text")} for t in observed],
        "not_provided": not_provided(scenario, tr, obs),
        "photo_status": ("analyzed_tentative_confirmed" if photo_labels else
                         "attached_not_analyzed" if photo_attached else "not_provided"),
        "photo_message": (PHOTO_MESSAGE_CONFIRMED.format(labels=", ".join(photo_labels)) if photo_labels else
                          PHOTO_MESSAGE_ATTACHED if photo_attached else PHOTO_MESSAGE_NONE),
        "local_advice": {"provided": bool(advice_text), "text": advice_text,
                         "handling": LOCAL_ADVICE_HANDLING if advice_text else NO_LOCAL_ADVICE},
        "checks_already_done": checks_done,
    }
    missing = {"archetype": arch, "unknowns": ucards, "checks": checks, "conflicts": confs,
               "failure_factors": failure_factors(kb, scenario, tr, list(confirmed))}

    cue_ev = make_evidence(kb, cue_ids)
    steps = {
        "observation_log": step(
            "observation_log", "complete" if (obs.get("description") or "").strip() else "needs_input",
            "Observation log", f"{len(observed)} observation(s) recorded.",
            warnings=[PHOTO_MESSAGE_ATTACHED] if photo_attached else [], evidence=cue_ev),
        "input_echo": step("input_echo", "complete", "Input echo", summary,
                           questions=[n["label"] for n in input_echo["not_provided"]],
                           warnings=[c["label"] for c in confs], evidence=cue_ev),
        "missing_analysis": step(
            "missing_analysis", "complete", "Missing analysis",
            f"{arch['statement']} Open questions: {len(ucards)}. Checks suggested: {len(checks)}.",
            questions=[u["label"] for u in ucards],
            warnings=[c["label"] for c in confs],
            evidence=make_evidence(kb, [scenario["id"], *[c["id"] for c in checks]])),
    }
    return {"derived_tags": tr.tags, "steps": steps, "input_echo": input_echo, "missing_analysis": missing}
