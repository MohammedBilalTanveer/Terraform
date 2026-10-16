"""Plan assembly (workflow steps 04-10). Transparent, tag-driven rules; all advice text is copied
from KB records, Python only adds neutral connective text and numbers derived from KB numbers.

FIX PROTOCOL (04)
  * soil_treatments whose applies_when matches the derived tags, grouped by `priority`
    (do_first / do_next / avoid / optional; missing priority -> optional), KB order kept.
  * why_this_matches = labels of present tags listed in the record's any_tags/all_tags, or
    "General guidance for this land type" for unconditional records.
  * requires_resources: if the user listed resources at all (or said "no compost"), each required
    res_* tag the user lacks appends the record's `alternatives_if_missing` to actions, and a neutral
    "Needs ..." line to limitations.

ADAPTATIONS ("why this plan differs")
  For each key variation tag present (hardpan_continuous, hardpan_patchy, slope_*, pooling_*,
  local_advice_trees_only, no_compost, low_water, season_known/unknown): soil_treatments +
  planting_methods + regeneration records included because the tag is in their any/all tags, records
  not used because the tag is in their none_tags (and they would otherwise apply), and crops whose
  cautions name the tag. Effect text: "Included: <titles>. Not used: <titles>. Crop cautions: <names>."

NEXT ACTION (05)
  Scenario readiness_gate items that apply. task_done = any satisfied_by_tasks completed;
  test_result = the user's recorded PASS/FAIL for the gate's KB `verification` test;
  satisfied = task_done AND (verification is null OR test passed OR risk accepted); accepting a risk
  waives only the test, never the task (v1.3). A FAIL keeps the gate open and the KB `if_fail` text is
  added to the step warnings. blocking_reason: task_not_done / test_not_run / test_failed / null.
  next_action.gate_tasks = applicable task records for every task referenced by an applicable gate. The baking-soda fizz check is never required.
  planting_readiness: ready (all required satisfied) / ready_with_accepted_risk (the rest accepted) /
  not_ready. blocked_until = labels of unsatisfied, unaccepted required gates.

CROP SUGGESTIONS (06) — score_breakdown entries {factor, points, reason}
  acid_tolerant +2; shallow_rooting_ok +2 (hardpan_continuous and NOT shallow_rooting_ok: -4);
  drought_tolerant +2 (+1 more with low_water); short_season +2; nitrogen_fixing +1;
  low_fertility_ok +1; high_water_demand -2 (-4 with low_water); needs_deep_soil -2
  (-4 with hardpan_continuous); season fit: fits +2 / tight 0 / high_risk -3 / unknown 0;
  each missing resource_need -1 (only if the user listed resources); caution `penalize` -3,
  caution `exclude` -> excluded list. fit_label: >=7 good_fit, >=3 possible, else high_risk.
  Trees always go to tree_options. Field crops ranked by score; top 5 shown plus any further
  good_fit/possible ones. trial_advice = the KB small-trial record (id/title/task mentions "trial")
  when hardpan_continuous, local_advice_trees_only, low_water or season_unknown.

TIMEFRAME (07)
  buffer = time_buffer_late_start. total = maturity + buffer. remediation = time_remediation_prep
  (prep_weeks, done before sowing); full_timeline = remediation + buffer + maturity. Season fit still
  compares only buffer + maturity with the wet window, because preparation happens before the rains. With W weeks remaining:
  fits if total.max <= W; tight if total.min <= W < total.max; high_risk if total.min > W;
  unknown if W is not given (text from time_rule_unknown_season); rain_ending without W -> high_risk.

PLANTING METHOD (08): applicable planting_methods split into methods (pit, raised bed, container,
  stone line, half moon), sowing, water_capture (water storage, mulching), irrigation.
ONGOING CARE (09): crop = selected crop (if valid) else top-ranked field crop. Care stages: crop-specific
  records override generic ("*") ones per stage, sorted by order. pest_watch = crop.pest_ids + generic
  pests. dry_spell_plan = applicable soil_treatments of category mulch / water_capture (not "avoid").
  stress_mitigation = applicable stress_mitigation records (heat, hot wind, dry spell, waterlogging ...).
HARVEST (10): the crop's harvest profile + applicable regeneration records.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from .cards import strs, text, to_recommendation
from .evidence import collect_all, confidence, make_evidence, merge_evidence
from .kb_loader import KnowledgeBase
from .reasoning import (LOCAL_ADVICE_HANDLING, archetype, local_advice_claim, local_advice_records,
                        open_unknowns, step)
from .retrieval import applies, blocking_tags, for_crop, triggering_tags
from .tagging import TagResult, observed_tags

SAFE_MESSAGE = "The knowledge base does not contain enough information to recommend this safely."

STEP_TITLES = {
    "observation_log": "Observation log", "input_echo": "Input echo", "missing_analysis": "Missing analysis",
    "fix_protocol": "Fix protocol", "next_action": "Next action", "crop_suggestions": "Crop suggestions",
    "timeframe": "Timeframe", "planting_method": "Planting method", "ongoing_care": "Ongoing care",
    "harvest": "Harvest",
}
STEP_ORDER = list(STEP_TITLES)

KEY_VARIATION_TAGS = [
    "hardpan_continuous", "hardpan_patchy", "slope_flat", "slope_slight", "slope_steep", "slope_unknown",
    "pooling_none", "pooling_some", "pooling_widespread", "local_advice_trees_only", "no_compost",
    "low_water", "season_known", "season_unknown",
]
TRIAL_TRIGGERS = ("hardpan_continuous", "local_advice_trees_only", "low_water", "season_unknown")
METHOD_GROUPS = {
    "planting_pit": "methods", "raised_bed": "methods", "container": "methods", "stone_line": "methods",
    "half_moon": "methods", "sowing": "sowing", "water_storage": "water_capture", "mulching": "water_capture",
    "irrigation": "irrigation",
}
VERIFICATION_KEYS = ("test", "pass", "fail", "if_fail")
PLANT_TASKS = ("task_sow_seeds", "task_mulch_after_sowing", "task_plant_tree_seedlings")
SOW_TASKS = ("task_sow_seeds", "task_plant_tree_seedlings")  # sowing/planting itself starts care + harvest
READINESS_WORDS = ("confirm", "test", "recheck", "verify", "check")
PHASE_ORDER = {"prepare": 0, "readiness": 1, "plant": 2}
LOCK_MESSAGES = {
    "choose_crop": "Choose a crop first.",
    "pass_gate": "Pass the readiness gate first.",
    "choose_crop_and_pass_gate": "Choose a crop and pass the readiness gate first.",
}
LONG_TERM_CATEGORIES = ("tree", "soil_builder")  # shown as long-term options, never ranked as food crops
SCARCITY_MISSING = {"no_compost": ["res_compost", "res_manure"]}
DRY_SPELL_CATEGORIES = ("mulch", "water_capture")
MAX_FIELD_CROPS = 5

# step -> tag groups whose open unknowns become that step's questions
STEP_UNKNOWN_TAGS = {
    "fix_protocol": {"hardpan_patchy", "hardpan_continuous", "slope_flat", "slope_slight", "slope_steep",
                     "pooling_none", "pooling_some", "pooling_widespread", "no_compost", "low_water",
                     "res_compost", "drains_fast", "drains_slow"},
    "crop_suggestions": {"season_known", "local_advice_trees_only", "local_advice_other"},
    "timeframe": {"season_known", "rain_not_started", "rain_just_started", "rain_ongoing", "rain_ending"},
}


# ------------------------------------------------------------------ helpers
def _weeks(v) -> Optional[Dict[str, float]]:
    if isinstance(v, dict) and v.get("min") is not None and v.get("max") is not None:
        try:
            return {"min": float(v["min"]), "max": float(v["max"])}
        except (TypeError, ValueError):
            return None
    return None


def _num(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:g}"


def _rng(w: Dict[str, float]) -> str:
    return _num(w["min"]) if w["min"] == w["max"] else f"{_num(w['min'])}-{_num(w['max'])}"


def missing_resources(required: List[str], tr: TagResult) -> List[str]:
    missing = []
    for res in required or []:
        lacks = False
        if tr.resources_given and res not in tr.tag_set:
            lacks = True
        for scarce, res_list in SCARCITY_MISSING.items():
            if scarce in tr.tag_set and res in res_list and res not in tr.tag_set:
                lacks = True
        if lacks:
            missing.append(res)
    return missing


def resource_aware_rec(kb, rec, tr, context="soil", **kw) -> dict:
    missing = missing_resources(rec.get("requires_resources") or [], tr)
    extra_actions, extra_lim = [], []
    if missing:
        extra_actions = strs(rec.get("alternatives_if_missing"))
        extra_lim = ["Needs " + ", ".join(tr.label(m) for m in missing) + ", which is not in what you reported having."]
    return to_recommendation(kb, rec, tr, context, extra_actions=extra_actions, extra_limitations=extra_lim, **kw)


def season_fit(maturity, buffer, weeks: Optional[float], rain_ending: bool) -> Tuple[str, Optional[dict]]:
    if not maturity:
        return "unknown", None
    total = {"min": maturity["min"] + buffer["min"], "max": maturity["max"] + buffer["max"]}
    if weeks is None:
        return ("high_risk" if rain_ending else "unknown"), total
    if total["max"] <= weeks:
        return "fits", total
    if total["min"] <= weeks < total["max"]:
        return "tight", total
    return "high_risk", total


def find_trial_record(kb: KnowledgeBase, tags: Set[str]) -> Optional[dict]:
    cands = []
    for coll in ("soil_treatments", "planting_methods", "diagnostic_checks"):
        for rec in kb.records(coll):
            task = rec.get("task") if isinstance(rec.get("task"), dict) else {}
            hay = " ".join([rec["id"], text(rec.get("title")), str(task.get("task_id") or "")]).lower()
            if "trial" in hay:
                cands.append(rec)
    applicable = [r for r in cands if applies(r, tags)]
    pick = applicable or cands
    # prefer soil treatments / planting methods (they carry tasks) over checks
    pick.sort(key=lambda r: (kb.collection_of(r["id"]) == "diagnostic_checks", not r.get("task")))
    return pick[0] if pick else None


def unknown_questions(scenario: dict, tr: TagResult, step_id: str) -> List[str]:
    groups = STEP_UNKNOWN_TAGS.get(step_id)
    if not groups:
        return []
    out = []
    for u in open_unknowns(scenario, tr, []):
        if set(u.get("resolved_by_tags") or []) & groups:
            out.append(text(u.get("label")))
    return out


# ------------------------------------------------------------------ gates
def is_fizz_gate(g: dict) -> bool:
    hay = " ".join([str(g.get("id", ""))] + [str(t) for t in g.get("satisfied_by_tasks") or []]).lower()
    return "fizz" in hay or "baking_soda" in hay


def task_phase(kb: KnowledgeBase, task_id: Optional[str]) -> Optional[str]:
    """Workflow phase of a task. The KB value (task.phase) wins; for older KBs without it a fallback is derived:
    sow/mulch-after-sowing/tree-planting tasks and tasks on `sowing` planting methods -> plant, except
    confirmation/test/check tasks -> readiness; everything else -> prepare."""
    if not task_id:
        return None
    owners = [kb.get(o) for o in kb.task_owner.get(task_id, [])]
    for rec in owners:
        ph = ((rec or {}).get("task") or {}).get("phase")
        if ph in PHASE_ORDER:
            return ph
    if task_id in PLANT_TASKS:
        return "plant"
    if any(w in task_id for w in READINESS_WORDS):
        return "readiness"
    if any(r and r.get("method_type") == "sowing" for r in owners):
        return "plant"
    return "prepare"


def lock_state(phase: Optional[str], readiness: str, crop_selected: bool):
    """plant-phase tasks need a chosen crop AND planting_readiness != not_ready; others are never locked."""
    if phase != "plant":
        return False, None
    need_gate = readiness == "not_ready"
    need_crop = not crop_selected
    if need_gate and need_crop:
        return True, "choose_crop_and_pass_gate"
    if need_gate:
        return True, "pass_gate"
    if need_crop:
        return True, "choose_crop"
    return False, None


def annotate_tasks(kb: KnowledgeBase, node, readiness: str, crop_selected: bool) -> None:
    """Add phase / locked / locked_reason to every Recommendation (dict with task_id + why_this_matches)."""
    if isinstance(node, dict):
        if "task_id" in node and "why_this_matches" in node:
            ph = task_phase(kb, node.get("task_id"))
            locked, reason = lock_state(ph, readiness, crop_selected)
            node.update({"phase": ph, "locked": locked, "locked_reason": reason})
        for v in node.values():
            annotate_tasks(kb, v, readiness, crop_selected)
    elif isinstance(node, list):
        for v in node:
            annotate_tasks(kb, v, readiness, crop_selected)


def gate_phase(kb: KnowledgeBase, g: dict, completed: List[str]) -> str:
    if g.get("task_done"):
        return "readiness"  # only the empirical test remains
    todo = [t for t in g.get("satisfied_by_tasks") or [] if t not in completed]
    return task_phase(kb, todo[0]) if todo else "readiness"


def verification_of(g: dict) -> Optional[dict]:
    v = g.get("verification")
    if not isinstance(v, dict):
        return None
    out = {k: text(v.get(k)) for k in VERIFICATION_KEYS}
    return out if any(out.values()) else None


def gate_task_done(g: dict, completed: List[str]) -> bool:
    return any(t in completed for t in g.get("satisfied_by_tasks") or [])


def compute_gates(kb: KnowledgeBase, scenario: dict, tags: Set[str], completed: List[str], accepted: List[str],
                  gate_results: Optional[Dict[str, str]] = None):
    """v1.3: accepting a risk waives only the empirical test, never the task.
    satisfied = task_done AND (verification is null OR test passed OR risk accepted)."""
    results = {k: v for k, v in (gate_results or {}).items() if v in ("pass", "fail")}
    items = []
    for g in scenario.get("readiness_gate") or []:
        if not isinstance(g, dict) or not applies(g, tags):
            continue
        tasks = [t for t in g.get("satisfied_by_tasks") or [] if isinstance(t, str)]
        owners = [o for t in tasks for o in kb.task_owner.get(t, [])]
        verification = verification_of(g)
        task_done = any(t in completed for t in tasks)
        test_result = results.get(g.get("id"))
        accepted_risk = g.get("id") in accepted and task_done
        test_ok = verification is None or test_result == "pass"
        if not task_done:
            reason = "task_not_done"
        elif test_ok or accepted_risk:
            reason = None
        else:
            reason = "test_failed" if test_result == "fail" else "test_not_run"
        items.append({
            "id": g.get("id", ""),
            "label": text(g.get("label")),
            "detail": text(g.get("detail")),
            "required": bool(g.get("required")) and not is_fizz_gate(g),
            "satisfied_by_tasks": tasks,
            "satisfied": task_done and (test_ok or accepted_risk),
            "accepted_risk": accepted_risk,
            "verification": verification,
            "test_result": test_result,
            "task_done": task_done,
            "can_accept_risk": bool(task_done and verification is not None and test_result != "pass" and not accepted_risk),
            "blocking_reason": reason,
            "evidence": make_evidence(kb, [scenario["id"], *owners], g.get("source_ids") or []),
        })
    required = [g for g in items if g["required"]]
    blocked = [g for g in required if not g["satisfied"]]
    if blocked:
        readiness = "not_ready"
    elif any(g["accepted_risk"] and not (g["verification"] is None or g["test_result"] == "pass") for g in required):
        readiness = "ready_with_accepted_risk"
    else:
        readiness = "ready"
    blocked = sorted(blocked, key=lambda g: PHASE_ORDER.get(gate_phase(kb, g, completed), 1))  # stable
    blocked_until = [g["label"] for g in blocked]
    if blocked:
        b = blocked[0]
        v = b.get("verification") or {}
        if b["blocking_reason"] == "test_failed" and v.get("if_fail"):
            nba = f"{b['label']}: {v['if_fail']}"
        elif b["blocking_reason"] == "test_not_run" and v.get("test"):
            nba = f"{b['label']}: {v['test']}"
        else:
            nba = b["label"] + (f": {b['detail']}" if b["detail"] else "")
    elif readiness == "ready_with_accepted_risk":
        nba = "All readiness items are done; some tests were skipped as an accepted risk. You can move on to planting."
    else:
        nba = "All readiness items are done. You can move on to planting."
    return items, readiness, blocked_until, nba


def gate_task_cards(kb: KnowledgeBase, gates: List[dict], tr: TagResult) -> List[dict]:
    """Completable task records (treatments / planting methods) for every task referenced by an applicable gate."""
    out, seen = [], set()
    for g in gates:
        for t in g["satisfied_by_tasks"]:
            for rid in kb.task_owner.get(t, []):
                rec = kb.get(rid)
                coll = kb.collection_of(rid)
                if rid in seen or not rec or coll not in ("soil_treatments", "planting_methods"):
                    continue
                if not applies(rec, tr.tag_set):
                    continue
                seen.add(rid)
                out.append(resource_aware_rec(kb, rec, tr, "soil"))
    return out


# ------------------------------------------------------------------ crops
def score_crop(kb, crop, tr: TagResult, buffer, weeks, rain_ending, unknown_rule) -> dict:
    tags = tr.tag_set
    suit = set(crop.get("suitability_tags") or [])
    water = text(crop.get("water_needs_plain"))
    rooting = text(crop.get("rooting_notes"))
    mat_desc = text(crop.get("maturity_description"))
    br: List[dict] = []
    triggers: Set[str] = set()

    def add(factor, pts, reason):
        br.append({"factor": factor, "points": int(pts), "reason": reason or f"Knowledge base tag: {factor}"})

    if "acid_tolerant" in suit:
        add("acid_tolerant", 2, "Knowledge base tag: acid_tolerant")
    hard = "hardpan_continuous" in tags
    if "shallow_rooting_ok" in suit:
        add("shallow_rooting_ok", 2, rooting)
    elif hard:
        add("not_shallow_rooting_with_continuous_hardpan", -4, rooting)
        triggers.add("hardpan_continuous")
    if "drought_tolerant" in suit:
        add("drought_tolerant", 2, water)
        if "low_water" in tags:
            add("drought_tolerant_with_low_water", 1, water)
    if "short_season" in suit:
        add("short_season", 2, mat_desc)
    if "nitrogen_fixing" in suit:
        add("nitrogen_fixing", 1, "Knowledge base tag: nitrogen_fixing")
    if "low_fertility_ok" in suit:
        add("low_fertility_ok", 1, "Knowledge base tag: low_fertility_ok")
    if "high_water_demand" in suit:
        add("high_water_demand_with_low_water" if "low_water" in tags else "high_water_demand",
            -4 if "low_water" in tags else -2, water)
        if "low_water" in tags:
            triggers.add("low_water")
    if "needs_deep_soil" in suit:
        add("needs_deep_soil_with_continuous_hardpan" if hard else "needs_deep_soil", -4 if hard else -2, rooting)
        if hard:
            triggers.add("hardpan_continuous")

    maturity = _weeks(crop.get("maturity_weeks"))
    is_tree = crop.get("category") in LONG_TERM_CATEGORIES
    fit, total = season_fit(maturity, buffer["weeks"], weeks, rain_ending)
    if is_tree:
        # trees are long-term options measured in years: no wet-season fit is scored
        fit, total = "unknown", None
    fit_pts = {"fits": 2, "tight": 0, "high_risk": -3, "unknown": 0}[fit]
    if maturity and not is_tree:
        if weeks is None:
            fit_reason = unknown_rule or SAFE_MESSAGE
        else:
            fit_reason = (f"{_rng(maturity)} weeks to mature + {_rng(buffer['weeks'])} weeks buffer = "
                          f"{_rng(total)} weeks; your estimate is {_num(weeks)} weeks.")
        add(f"season_fit_{fit}", fit_pts, fit_reason)

    needs = [r for r in crop.get("resource_needs") or [] if isinstance(r, str)]
    missing = missing_resources(needs, tr) if tr.resources_given else []
    for m in missing:
        add("missing_resource", -1, f"Missing: {tr.label(m)}")

    cautions_triggered, excluded = [], False
    for c in crop.get("cautions") or []:
        if not isinstance(c, dict) or c.get("when_tag") not in tags:
            continue
        reason = text(c.get("reason"))
        cautions_triggered.append(reason)
        triggers.add(c.get("when_tag"))
        if c.get("effect") == "exclude":
            excluded = True
            add(f"caution_exclude_{c.get('when_tag')}", 0, reason)
        else:
            add(f"caution_{c.get('when_tag')}", -3, reason)

    score = sum(e["points"] for e in br)
    if excluded:
        fit_label = "excluded"
    elif score >= 7:
        fit_label = "good_fit"
    elif score >= 3:
        fit_label = "possible"
    else:
        fit_label = "high_risk"
    why = strs(crop.get("why_it_may_fit"))  # KB-authored list preferred
    if not why:
        for e in br:
            if e["points"] > 0 and e["reason"] and e["reason"] not in why:
                why.append(e["reason"])
    ev_ids = [crop["id"], buffer["kb_id"]]
    tree_limits = []
    if is_tree:
        trule = kb.get("time_rule_trees")
        if trule:
            tree_limits = [text(trule.get("explanation")) or text(trule.get("summary"))]
            ev_ids.append(trule["id"])
    elif weeks is None and maturity:
        ev_ids.append("time_rule_unknown_season")
    category = crop.get("category") if crop.get("category") in ("field_crop", "tree", "soil_builder") else "field_crop"
    return {
        "crop_id": crop["id"],
        "name": text(crop.get("name")) or text(crop.get("title")) or crop["id"],
        "local_names": strs(crop.get("local_names")),
        "category": category,
        "rank": 0,
        "score": int(score),
        "fit_label": fit_label,
        "why_it_may_fit": why,
        "water_needs": water,
        "rooting_notes": rooting,
        "maturity_weeks": maturity,
        "maturity_description": mat_desc,
        "season_fit": fit,
        "resource_needs": needs,
        "missing_resources": missing,
        "limitations": strs(crop.get("limitations")) + [c for c in cautions_triggered if c] + tree_limits,
        "cautions_triggered": [c for c in cautions_triggered if c],
        "score_breakdown": br,
        "confidence": confidence(crop, tags, "crop"),
        "evidence": make_evidence(kb, ev_ids),
        "_total": total,
        "_triggers": triggers,
    }


# ------------------------------------------------------------------ main
def build_plan(kb: KnowledgeBase, scenario: dict, tr: TagResult, obs: dict, selected_crop_id: Optional[str],
               completed_tasks: List[str], accepted_risks: List[str],
               gate_results: Optional[Dict[str, str]] = None) -> dict:
    gate_results = {k: v for k, v in (gate_results or {}).items() if v in ("pass", "fail")}
    tags = tr.tag_set
    weeks = tr.weeks_remaining
    rain_ending = "rain_ending" in tags

    # ---------------- 04 fix protocol
    groups = {"do_first": [], "do_next": [], "avoid": [], "optional": []}
    for rec in kb.records("soil_treatments"):
        if applies(rec, tags):
            card = resource_aware_rec(kb, rec, tr, "soil")
            groups[card["priority"] or "optional"].append(card)
    fix_cards = [c for g in groups.values() for c in g]
    fix_tasks = [c["task_id"] for c in fix_cards if c["task_id"] and c["priority"] != "avoid"]
    fix_tasks = list(dict.fromkeys(fix_tasks))

    # ---------------- timeframe basics (needed for crop scoring)
    buffer_rec = kb.get("time_buffer_late_start") or next(
        (r for r in kb.records("timeframe_rules") if _weeks(r.get("buffer_weeks"))), None)
    unknown_rec = kb.get("time_rule_unknown_season") or next(
        (r for r in kb.records("timeframe_rules") if "unknown" in r["id"]), None)
    unknown_text = (text(unknown_rec.get("explanation")) or text(unknown_rec.get("summary"))) if unknown_rec else ""
    buffer = {
        "kb_id": buffer_rec["id"] if buffer_rec else "",
        "weeks": _weeks(buffer_rec.get("buffer_weeks")) if buffer_rec else {"min": 0.0, "max": 0.0},
        "explanation": (text(buffer_rec.get("explanation")) or text(buffer_rec.get("summary"))) if buffer_rec else SAFE_MESSAGE,
    }
    if buffer["weeks"] is None:
        buffer["weeks"] = {"min": 0.0, "max": 0.0}
    rem_rec = kb.get("time_remediation_prep") or next(
        (r for r in kb.records("timeframe_rules") if _weeks(r.get("prep_weeks"))), None)
    remediation = None
    if rem_rec and _weeks(rem_rec.get("prep_weeks")):
        remediation = {"kb_id": rem_rec["id"], "weeks": _weeks(rem_rec.get("prep_weeks")),
                       "explanation": text(rem_rec.get("explanation")) or text(rem_rec.get("summary"))}
    cal_rec = kb.get("time_calendar_relative_to_rain") or next(
        (r for r in kb.records("timeframe_rules") if isinstance(r.get("phases"), list)), None)
    calendar = None
    if cal_rec:
        phases = [{"when": text(p.get("when")), "actions": strs(p.get("actions"))}
                  for p in cal_rec.get("phases") or [] if isinstance(p, dict) and p.get("when")]
        calendar = {"kb_id": cal_rec["id"], "phases": phases} if phases else None
    rec_rec = kb.get("time_soil_recovery")
    soil_recovery = ({"kb_id": rec_rec["id"], "text": text(rec_rec.get("explanation")) or text(rec_rec.get("summary"))}
                     if rec_rec else None)

    # ---------------- 06 crops
    cards = [score_crop(kb, c, tr, buffer, weeks, rain_ending, unknown_text) for c in kb.records("crop_profiles")]
    excluded = [c for c in cards if c["fit_label"] == "excluded"]
    fields = sorted([c for c in cards if c["category"] == "field_crop" and c["fit_label"] != "excluded"],
                    key=lambda c: -c["score"])
    trees = sorted([c for c in cards if c["category"] in LONG_TERM_CATEGORIES and c["fit_label"] != "excluded"],
                   key=lambda c: -c["score"])
    for i, c in enumerate(fields):
        c["rank"] = i + 1
    for i, c in enumerate(trees):
        c["rank"] = i + 1
    shown = fields[:MAX_FIELD_CROPS] + [c for c in fields[MAX_FIELD_CROPS:] if c["fit_label"] in ("good_fit", "possible")]

    trial = None
    if any(t in tags for t in TRIAL_TRIGGERS):
        trec = find_trial_record(kb, tags)
        if trec:
            trial = resource_aware_rec(kb, trec, tr, "crop")

    advice_text = local_advice_claim(obs, tr) or ""
    local_note = None
    if advice_text:
        atag = "local_advice_trees_only" if "local_advice_trees_only" in tags else "local_advice_other"
        recs = [r for r in local_advice_records(kb, atag) if r.get("priority") != "avoid"]
        kb_text = text(recs[0].get("summary")) if recs else ""
        if not kb_text:
            for u in scenario.get("unknowns") or []:
                if atag in (u.get("resolved_by_tags") or []):
                    chk = kb.get((u.get("check_ids") or [None])[0] or "")
                    kb_text = text(chk.get("summary")) if chk else text(u.get("why_it_matters"))
                    break
        end = "" if advice_text[-1:] in ".!?" else "."
        local_note = f'You were told: "{advice_text}{end}" {LOCAL_ADVICE_HANDLING}' + (f" {kb_text}" if kb_text else "")

    crop_by_id = {c["id"]: c for c in kb.records("crop_profiles")}
    sel_valid = selected_crop_id if selected_crop_id in crop_by_id else None
    if sel_valid:
        care_crop_id, basis = sel_valid, "selected"
    elif fields:
        care_crop_id, basis = fields[0]["crop_id"], "top_ranked_default"
    else:
        care_crop_id, basis = None, "none"
    care_crop = crop_by_id.get(care_crop_id) if care_crop_id else None

    # ---------------- 07 timeframe rows
    rows = []
    compare_rec = kb.get("time_rule_compare") or next(
        (r for r in kb.records("timeframe_rules") if isinstance(r.get("fit_rules"), dict)), None)
    fit_rules = {}
    for r in kb.records("timeframe_rules"):
        f = r.get("season_fit")
        if isinstance(f, str):
            fit_rules.setdefault(f, r)
    for c in shown:
        if not c["maturity_weeks"]:
            continue
        total = c["_total"]
        if weeks is None:
            expl = unknown_text or SAFE_MESSAGE
            ev_ids = [c["crop_id"], buffer["kb_id"], unknown_rec["id"] if unknown_rec else ""]
            if rain_ending:
                rr = next((r for r in kb.records("timeframe_rules") if "rain_ending" in triggering_tags(r, tags)), None)
                if rr:
                    expl = f"{text(rr.get('explanation')) or text(rr.get('summary'))} {expl}".strip()
                    ev_ids.append(rr["id"])
        else:
            expl = (f"{_rng(c['maturity_weeks'])} weeks to mature + {_rng(buffer['weeks'])} weeks buffer = "
                    f"{_rng(total)} weeks, compared with your estimate of {_num(weeks)} weeks.")
            ev_ids = [c["crop_id"], buffer["kb_id"]]
            fr = fit_rules.get(c["season_fit"])
            if fr:
                expl += " " + (text(fr.get("explanation")) or text(fr.get("summary")))
                ev_ids.append(fr["id"])
            elif compare_rec:
                line = next((i for i in strs(compare_rec.get("instructions"))
                             if i.lower().startswith(c["season_fit"] + ":")), "")
                if line:
                    expl += " " + line
                    ev_ids.append(compare_rec["id"])
        rem_w = remediation["weeks"] if remediation else None
        full = ({"min": total["min"] + rem_w["min"], "max": total["max"] + rem_w["max"]} if rem_w else dict(total))
        if remediation:
            ev_ids.append(remediation["kb_id"])
        rows.append({
            "crop_id": c["crop_id"], "name": c["name"], "maturity_weeks": c["maturity_weeks"],
            "buffer_weeks": buffer["weeks"], "total_weeks": total, "season_fit": c["season_fit"],
            "explanation": expl, "evidence": make_evidence(kb, ev_ids),
            "remediation_weeks": rem_w, "full_timeline_weeks": full,
        })
    if weeks is None:
        season_assumption = unknown_text or SAFE_MESSAGE
        comparison = unknown_text or SAFE_MESSAGE
    else:
        season_assumption = f"Your estimate: about {_num(weeks)} weeks of rain remain."
        counts = {k: sum(1 for r in rows if r["season_fit"] == k) for k in ("fits", "tight", "high_risk")}
        comparison = (f"Compared with your estimate of {_num(weeks)} weeks: {counts['fits']} crop(s) fit, "
                      f"{counts['tight']} are tight, {counts['high_risk']} are high risk.")
        if compare_rec:
            comparison += " " + (text(compare_rec.get("explanation")) or text(compare_rec.get("summary")))

    # ---------------- 08 planting methods
    pm = {"methods": [], "sowing": [], "water_capture": [], "irrigation": []}
    preferred = set(care_crop.get("planting_method_ids") or []) if care_crop else set()
    method_recs = [r for r in kb.records("planting_methods") if applies(r, tags)]
    method_recs.sort(key=lambda r: r["id"] not in preferred)
    for rec in method_recs:
        pm[METHOD_GROUPS.get(rec.get("method_type"), "methods")].append(resource_aware_rec(kb, rec, tr, "soil"))
    method_tasks = list(dict.fromkeys(c["task_id"] for g in pm.values() for c in g if c["task_id"]))

    # ---------------- 09 ongoing care
    stages, pests, dry = [], [], []
    care_all = [r for r in kb.records("care_stages") if applies(r, tags)]
    if care_crop_id:
        listed = set(care_crop.get("care_stage_ids") or [])
        specific = [r for r in care_all if care_crop_id in (r.get("crop_ids") or []) or r["id"] in listed]
    else:
        specific = []
    generic = [r for r in care_all if "*" in (r.get("crop_ids") or []) and r not in specific]
    by_stage: Dict[str, dict] = {}
    for r in generic:
        by_stage.setdefault(str(r.get("stage") or r["id"]), r)
    for r in specific:
        by_stage[str(r.get("stage") or r["id"])] = r
    for r in sorted(by_stage.values(), key=lambda r: float(r.get("order") or 0)):
        stages.append({
            "id": r["id"], "stage": str(r.get("stage") or ""), "order": float(r.get("order") or 0),
            "label": text(r.get("label")) or text(r.get("title")),
            "timing_description": text(r.get("timing_description")),
            "water": text(r.get("water")), "mulch": text(r.get("mulch")), "nutrients": text(r.get("nutrients")),
            "weeds": text(r.get("weeds")), "watch_for": strs(r.get("watch_for")), "dry_spell": text(r.get("dry_spell")),
            "actions": strs(r.get("actions")) or strs(r.get("instructions")),
            "evidence": make_evidence(kb, [r["id"]]),
        })
    pest_ids = list(care_crop.get("pest_ids") or []) if care_crop else []
    for r in kb.records("pest_management"):
        if "*" in (r.get("crop_ids") or []) and r["id"] not in pest_ids:
            pest_ids.append(r["id"])
    for pid in pest_ids:
        r = kb.get(pid)
        if not r or kb.collection_of(pid) != "pest_management" or not applies(r, tags):
            continue
        pests.append({
            "id": r["id"], "title": text(r.get("title")), "signs": strs(r.get("signs")),
            "actions": strs(r.get("actions")) or strs(r.get("instructions")),
            "bio_options": [{
                "name": text(b.get("name")), "preparation": text(b.get("preparation")),
                "safe_use": strs(b.get("safe_use")), "cautions": strs(b.get("cautions")),
            } for b in r.get("bio_options") or [] if isinstance(b, dict)],
            "cautions": strs(r.get("cautions")) or strs(r.get("safety_notes")),
            "evidence": make_evidence(kb, [r["id"]]),
        })
    for rec in kb.records("soil_treatments"):
        if rec.get("category") in DRY_SPELL_CATEGORIES and rec.get("priority") != "avoid" and applies(rec, tags):
            dry.append(resource_aware_rec(kb, rec, tr, "care"))
    trouble = []
    for rec in kb.records("troubleshooting"):
        if not applies(rec, tags):
            continue
        related = [x for x in rec.get("related_kb_ids") or [] if isinstance(x, str) and kb.has(x)]
        trouble.append({
            "id": rec["id"], "symptom": text(rec.get("symptom")) or text(rec.get("title")),
            "likely_causes": strs(rec.get("likely_causes")),
            "actions": strs(rec.get("actions")) or strs(rec.get("instructions")),
            "evidence": make_evidence(kb, [rec["id"], *related]),
        })
    stress = []
    for rec in kb.records("stress_mitigation"):
        if not applies(rec, tags):
            continue
        card = to_recommendation(kb, rec, tr, "care")
        acts = strs(rec.get("actions"))
        if acts:
            card["actions"] = acts + [a for a in card["actions"] if a not in acts]
        card.update({"stressor": text(rec.get("stressor")), "signs": strs(rec.get("signs"))})
        stress.append(card)

    # ---------------- 10 harvest
    hp = None
    if care_crop:
        hp = kb.get(care_crop.get("harvest_profile_id") or "") or next(
            (h for h in kb.records("harvest_profiles") if h.get("crop_id") == care_crop_id), None)
    regen = [to_recommendation(kb, r, tr, "soil") for r in kb.records("regeneration") if applies(r, tags)]

    # ---------------- 05 gates
    gates, readiness, blocked_until, nba = compute_gates(kb, scenario, tags, completed_tasks, accepted_risks,
                                                         gate_results)
    gate_warn = [f"Not yet done: {b}" for b in blocked_until]
    for g in gates:
        v = g.get("verification") or {}
        if g["test_result"] == "fail":
            gate_warn.append(f"Test failed: {g['label']}." + (f" {v['if_fail']}" if v.get("if_fail") else ""))
        elif g["task_done"] and v and g["test_result"] is None and not g["accepted_risk"]:
            gate_warn.append(f"Test pending: {g['label']}." + (f" {v['test']}" if v.get("test") else ""))

    # ---------------- adaptations
    adaptations = build_adaptations(kb, tr, cards, scenario, trial, trees)

    # ---------------- statuses & step metas
    steps_status = compute_steps_status(obs, fix_tasks, method_tasks, completed_tasks, readiness, sel_valid)
    steps_status = _apply_sown_gate(steps_status, completed_tasks, readiness, sel_valid)
    unk_q = lambda sid: unknown_questions(scenario, tr, sid)  # noqa: E731

    fix_step = step("fix_protocol", steps_status["fix_protocol"], STEP_TITLES["fix_protocol"],
                    f"Do first: {len(groups['do_first'])}. Do next: {len(groups['do_next'])}. "
                    f"Avoid: {len(groups['avoid'])}. Optional: {len(groups['optional'])}.",
                    questions=unk_q("fix_protocol"),
                    warnings=[] if fix_cards else [SAFE_MESSAGE],
                    evidence=merge_evidence(*[c["evidence"] for c in fix_cards]))
    fix_step.update(groups)

    na_step = step("next_action", steps_status["next_action"], STEP_TITLES["next_action"], nba,
                   questions=[], warnings=gate_warn,
                   evidence=merge_evidence(*[g["evidence"] for g in gates]))
    na_step.update({"readiness_gate": gates, "blocked_until": blocked_until,
                    "planting_readiness": readiness, "next_best_action": nba,
                    "gate_tasks": gate_task_cards(kb, gates, tr)})

    for c in cards:
        c.pop("_total", None)
        c.pop("_triggers", None)
    crop_warn = [] if shown else [SAFE_MESSAGE]
    cs_step = step("crop_suggestions", steps_status["crop_suggestions"], STEP_TITLES["crop_suggestions"],
                   f"Field crops shown: {len(shown)}. Tree options: {len(trees)}. Excluded: {len(excluded)}.",
                   questions=unk_q("crop_suggestions"), warnings=crop_warn,
                   evidence=merge_evidence(*[c["evidence"] for c in shown + trees + excluded],
                                           trial["evidence"] if trial else {}))
    cs_step.update({"field_crops": shown, "tree_options": trees, "excluded": excluded,
                    "trial_advice": trial, "local_advice_note": local_note})

    tf_warn = [unknown_text or SAFE_MESSAGE] if weeks is None else []
    tf_step = step("timeframe", steps_status["timeframe"], STEP_TITLES["timeframe"], comparison,
                   questions=unk_q("timeframe"), warnings=tf_warn,
                   evidence=merge_evidence(make_evidence(kb, [buffer["kb_id"], unknown_rec["id"] if unknown_rec else "",
                                                              compare_rec["id"] if compare_rec and weeks is not None else "",
                                                              remediation["kb_id"] if remediation else "",
                                                              soil_recovery["kb_id"] if soil_recovery else "",
                                                              calendar["kb_id"] if calendar else ""]),
                                           *[r["evidence"] for r in rows]))
    tf_step.update({"season_assumption": season_assumption, "wet_season_weeks_remaining": weeks,
                    "buffer": buffer, "rows": rows, "comparison": comparison,
                    "remediation": remediation, "soil_recovery_note": soil_recovery, "calendar": calendar})

    pm_cards = [c for g in pm.values() for c in g]
    pm_warn = ([] if readiness != "not_ready" else [f"Not yet done: {b}" for b in blocked_until]) + \
              ([] if pm_cards else [SAFE_MESSAGE])
    pm_step = step("planting_method", steps_status["planting_method"], STEP_TITLES["planting_method"],
                   f"Methods: {len(pm['methods'])}. Sowing: {len(pm['sowing'])}. Water capture: {len(pm['water_capture'])}. "
                   f"Irrigation: {len(pm['irrigation'])}.",
                   warnings=pm_warn, evidence=merge_evidence(*[c["evidence"] for c in pm_cards]))
    pm_step.update(pm)

    care_name = text(care_crop.get("name")) if care_crop else ""
    oc_warn = [] if stages else [SAFE_MESSAGE]
    oc_step = step("ongoing_care", steps_status["ongoing_care"], STEP_TITLES["ongoing_care"],
                   (f"Care plan for {care_name}." if care_crop else SAFE_MESSAGE) +
                   (" Based on the top-ranked crop; choose a crop to change it." if basis == "top_ranked_default" else ""),
                   warnings=oc_warn,
                   evidence=merge_evidence(*[s["evidence"] for s in stages], *[p["evidence"] for p in pests],
                                           *[d["evidence"] for d in dry], *[x["evidence"] for x in stress],
                                           *[x["evidence"] for x in trouble]))
    oc_step.update({"crop_id": care_crop_id, "crop_basis": basis, "stages": stages, "pest_watch": pests,
                    "dry_spell_plan": dry, "stress_mitigation": stress, "troubleshooting": trouble})

    hv_step = step("harvest", steps_status["harvest"], STEP_TITLES["harvest"],
                   f"Harvest guide for {care_name}." if hp else SAFE_MESSAGE,
                   warnings=[] if hp else [SAFE_MESSAGE],
                   evidence=merge_evidence(make_evidence(kb, [hp["id"]] if hp else []), *[r["evidence"] for r in regen]))
    hv_step.update({
        "crop_id": care_crop_id,
        "ripeness_cues_see": strs(hp.get("ripeness_cues_see")) if hp else [],
        "ripeness_cues_feel": strs(hp.get("ripeness_cues_feel")) if hp else [],
        "method": strs(hp.get("method")) if hp else [],
        "drying_storage": strs(hp.get("drying_storage")) if hp else [],
        "do_not_store": strs(hp.get("do_not_store")) if hp else [],
        "residue_handling": strs(hp.get("residue_handling")) if hp else [],
        "regeneration": regen,
    })

    workflow = {"fix_protocol": fix_step, "next_action": na_step, "crop_suggestions": cs_step,
                "timeframe": tf_step, "planting_method": pm_step, "ongoing_care": oc_step, "harvest": hv_step}

    annotate_tasks(kb, workflow, readiness, bool(sel_valid))

    arch = archetype(kb, scenario, tr)
    situation = situation_summary(scenario, tr, arch)
    evidence = merge_evidence(make_evidence(kb, [scenario["id"]]), collect_all(workflow),
                              make_evidence(kb, [t["cue_id"] for t in tr.tags if t.get("cue_id")]))
    return {
        "derived_tags": tr.tags,
        "situation_summary": situation,
        "adaptations": adaptations,
        "workflow": workflow,
        "steps_status": steps_status,
        "completed_tasks": list(completed_tasks),
        "accepted_risks": list(accepted_risks),
        "gate_results": dict(gate_results),
        "evidence": evidence,
    }


def situation_summary(scenario: dict, tr: TagResult, arch: dict) -> str:
    labels = list(dict.fromkeys(t["label"] for t in observed_tags(tr)))
    parts = []
    parts.append("Based on what you reported: " + (", ".join(labels) if labels else "no matching details yet") + ".")
    parts.append(arch["statement"])
    open_u = [text(u.get("label")) for u in open_unknowns(scenario, tr, [])]
    if open_u:
        parts.append("Still unknown: " + "; ".join(open_u) + ".")
    return " ".join(parts)


def build_adaptations(kb: KnowledgeBase, tr: TagResult, crop_cards: List[dict], scenario: Optional[dict] = None,
                      trial: Optional[dict] = None, trees: Optional[List[dict]] = None) -> List[dict]:
    tags = tr.tag_set
    pool = kb.records("soil_treatments") + kb.records("planting_methods") + kb.records("regeneration")
    gates = [g for g in (scenario or {}).get("readiness_gate") or [] if isinstance(g, dict)]
    out = []
    for t in KEY_VARIATION_TAGS:
        if t not in tags:
            continue
        included = [r for r in pool if applies(r, tags) and t in triggering_tags(r, tags)]
        excluded = [r for r in pool if t in blocking_tags(r, tags) and applies(r, tags - {t})]
        cautioned = [c for c in crop_cards if t in c.get("_triggers", set())]
        g_in = [g for g in gates if applies(g, tags) and t in triggering_tags(g, tags)]
        g_out = [g for g in gates if t in blocking_tags(g, tags) and applies(g, tags - {t})]
        extra_parts, extra_ids = [], []
        if t == "local_advice_trees_only":
            if trees:
                extra_parts.append("Tree options are listed separately as long-term options: "
                                   + "; ".join(c["name"] for c in trees) + ".")
                extra_ids += [c["crop_id"] for c in trees]
            if trial:
                extra_parts.append(f"Field crops are still offered, starting with: {trial['title']}.")
                extra_ids.append(trial["id"])
        if not (included or excluded or cautioned or g_in or g_out or extra_parts):
            continue
        parts = []
        if g_in:
            parts.append("Readiness items added: " + "; ".join(text(g.get("label")) for g in g_in) + ".")
        if g_out:
            parts.append("Readiness items not used: " + "; ".join(text(g.get("label")) for g in g_out) + ".")
        if included:
            parts.append("Included: " + "; ".join(text(r.get("title")) for r in included) + ".")
        if excluded:
            parts.append("Not used: " + "; ".join(text(r.get("title")) for r in excluded) + ".")
        if cautioned:
            parts.append("Crops scored down or excluded: " + "; ".join(c["name"] for c in cautioned) + ".")
        parts += extra_parts
        ids = ([r["id"] for r in included + excluded] + [c["crop_id"] for c in cautioned] + extra_ids
               + ([scenario["id"]] if (g_in or g_out) and scenario else []))
        out.append({"trigger_tag": t, "label": tr.label(t), "effect": " ".join(parts),
                    "kb_ids": [i for i in dict.fromkeys(ids) if kb.has(i)]})
    return out


def compute_steps_status(obs: dict, fix_tasks: List[str], method_tasks: List[str], completed: List[str],
                         readiness: str, selected_crop: Optional[str]) -> Dict[str, str]:
    done = set(completed)

    def frac(tasks):
        if not tasks:
            return "ready"
        n = sum(1 for t in tasks if t in done)
        return "complete" if n == len(tasks) else "in_progress" if n else "ready"

    gated = readiness != "not_ready"
    if not gated:
        pm = "blocked"
    elif not selected_crop:
        pm = "ready"  # unlocks only once a crop is chosen
    else:
        pm = frac(method_tasks)
    return {
        "observation_log": "complete" if (obs.get("description") or "").strip() else "needs_input",
        "input_echo": "complete",
        "missing_analysis": "complete",
        "fix_protocol": frac(fix_tasks),
        "next_action": "complete" if gated else "in_progress",
        "crop_suggestions": "complete" if selected_crop else "ready",
        "timeframe": "ready",
        "planting_method": pm,
        "ongoing_care": "ready" if gated else "blocked",
        "harvest": "ready" if gated else "blocked",
    }


def _apply_sown_gate(steps_status: Dict[str, str], completed: List[str], readiness: str,
                     selected_crop: Optional[str]) -> Dict[str, str]:
    """Care and harvest stay blocked until a plant-phase sow task is done (with a crop chosen and the gate passed)."""
    sown = readiness != "not_ready" and bool(selected_crop) and any(t in completed for t in SOW_TASKS)
    out = dict(steps_status)
    out["ongoing_care"] = "ready" if sown else "blocked"
    out["harvest"] = "ready" if sown else "blocked"
    return out
