"""Keyword retrieval over KB records for the assistant (/api/assistant/ask).

Scoring: tokens (lowercase words, stopwords removed, light plural/-ing stemming) of the question are
matched against each record's title/name (weight x2) and summary/instructions/purpose/tags (x1), each
token weighted by inverse document frequency. Records in the current plan's evidence get x1.25, records
from the collection behind the current step x1.2. The answer is the verbatim KB summary/instructions of
the top 1-3 records. Crop ids, actions, signs, cues and bio-option names are indexed too. If less than a third of the
meaningful question words match the best record (or its score is tiny) the assistant refuses and suggests a KB observation check instead.
"""
from __future__ import annotations

import math
import re
from typing import Dict, List, Optional, Set, Tuple

from .cards import strs, text
from .kb_loader import KnowledgeBase

STOPWORDS = set("""
a an the and or but if then so of to in on at by for with from as is are was were be been being am do does did
doing have has had having i me my we our you your he she it its they them their this that these those what which
who whom whose when where why how can could should would will shall may might must not no yes there here than
too very just also about into over under up down out off again once any all each few more most other some such
only own same both get got make made tell please know want need use using like one thing things way ok okay
grow growing grown here good best better help protect safe safely work start right thing land soil
""".split())
# note: "land"/"soil" are filler for search because nearly every record is about land/soil; the
# question's specific subject (crop, pest, pit, rain...) must be in the KB or the assistant refuses.

SEARCH_COLLECTIONS = [
    "soil_treatments", "diagnostic_checks", "crop_profiles", "planting_methods", "care_stages",
    "pest_management", "harvest_profiles", "regeneration", "timeframe_rules", "observation_cues", "scenarios",
    "troubleshooting", "field_faq",  # v1.2: symptom/question weighted like a title
]
STEP_COLLECTIONS = {
    "observation_log": {"observation_cues"}, "input_echo": {"observation_cues"},
    "missing_analysis": {"diagnostic_checks"}, "fix_protocol": {"soil_treatments"},
    "next_action": {"soil_treatments", "planting_methods"}, "crop_suggestions": {"crop_profiles"},
    "timeframe": {"timeframe_rules", "crop_profiles"}, "planting_method": {"planting_methods"},
    "ongoing_care": {"care_stages", "pest_management", "troubleshooting"}, "harvest": {"harvest_profiles", "regeneration"},
}
SAFE_ANSWER = "The knowledge base does not contain enough information to answer this safely."
MIN_COVERAGE = 0.34  # at least a third of the meaningful question words must be in the record
MIN_SCORE = 2.5


def stem(tok: str) -> str:
    if len(tok) > 5 and tok.endswith("ing"):
        tok = tok[:-3]
    elif len(tok) > 4 and tok.endswith("ies"):
        tok = tok[:-3] + "y"
    elif len(tok) > 4 and tok.endswith("es") and tok[-3] in "sxz":
        tok = tok[:-2]
    elif len(tok) > 3 and tok.endswith("s") and not tok.endswith("ss"):
        tok = tok[:-1]
    return tok


def tokens(s: str) -> List[str]:
    words = re.findall(r"[a-z0-9]+", (s or "").lower().replace("_", " "))
    return [stem(w) for w in words if w not in STOPWORDS and len(w) > 1]


class Index:
    def __init__(self, kb: KnowledgeBase):
        self.kb = kb
        self.docs: List[Tuple[str, str, Set[str], Set[str]]] = []  # (id, collection, title toks, body toks)
        df: Dict[str, int] = {}
        for coll in SEARCH_COLLECTIONS:
            for rec in kb.records(coll):
                title = " ".join([text(rec.get("title")), text(rec.get("name")), " ".join(strs(rec.get("local_names"))),
                                  text(rec.get("question")), text(rec.get("symptom"))])
                aw = rec.get("applies_when") if isinstance(rec.get("applies_when"), dict) else {}
                tagtxt = " ".join(list(aw.get("any_tags") or []) + list(aw.get("all_tags") or []) +
                                  list(rec.get("suitability_tags") or []) + [str(rec.get("category") or ""),
                                                                            str(rec.get("method_type") or ""),
                                                                            str(rec.get("stage") or "")])
                crop_refs = list(rec.get("crop_ids") or []) + [str(rec.get("crop_id") or "")]
                crop_names = " ".join(c.replace("crop_", "") for c in crop_refs if c and c != "*")
                bio = " ".join(text(b.get("name")) for b in (rec.get("bio_options") or []) if isinstance(b, dict))
                body = " ".join([text(rec.get("summary")), text(rec.get("purpose")), " ".join(strs(rec.get("instructions"))),
                                 " ".join(strs(rec.get("steps"))), " ".join(strs(rec.get("signs"))),
                                 " ".join(strs(rec.get("actions"))), " ".join(strs(rec.get("watch_for"))),
                                 " ".join(strs(rec.get("everyday_amounts"))), " ".join(strs(rec.get("ripeness_cues_see"))),
                                 " ".join(strs(rec.get("ripeness_cues_feel"))), text(rec.get("dry_spell")),
                                 text(rec.get("water_needs_plain")), text(rec.get("rooting_notes")),
                                 text(rec.get("explanation")), text(rec.get("when_to_sow")), crop_names, bio, tagtxt,
                                 text(rec.get("answer")), " ".join(strs(rec.get("likely_causes"))),
                                 text(rec.get("phase")), text(rec.get("where")),
                                 " ".join(text(o.get("label")) + " " + text(o.get("interpretation"))
                                          for o in rec.get("possible_outcomes") or [] if isinstance(o, dict))])
                tt = set(tokens(title)) | set(tokens(crop_names))
                bt = set(tokens(body))
                self.docs.append((rec["id"], coll, tt, bt))
                for t in tt | bt:
                    df[t] = df.get(t, 0) + 1
        n = max(len(self.docs), 1)
        self.idf = {t: math.log(1 + n / c) for t, c in df.items()}

    def search(self, question: str, prefer_ids: Set[str], step_id: Optional[str]) -> Tuple[List[dict], int]:
        q = list(dict.fromkeys(tokens(question)))
        if not q:
            return [], 0
        step_colls = STEP_COLLECTIONS.get(step_id or "", set())
        results = []
        for rid, coll, tt, bt in self.docs:
            matched = [t for t in q if t in tt or t in bt]
            if not matched:
                continue
            score = sum(self.idf.get(t, 0.0) * (2.0 if t in tt else 1.0) for t in matched)
            if rid in prefer_ids:
                score *= 1.25
            if coll in step_colls:
                score *= 1.2
            results.append({"kb_id": rid, "collection": coll, "score": score, "coverage": len(matched) / len(q)})
        results.sort(key=lambda r: (-r["score"], -r["coverage"]))
        return results, len(q)


def get_index(kb: KnowledgeBase) -> Index:
    idx = getattr(kb, "_assistant_index", None)
    if idx is None:
        idx = Index(kb)
        setattr(kb, "_assistant_index", idx)
    return idx


def record_snippet(rec: dict) -> str:
    return text(rec.get("answer")) or text(rec.get("summary")) or text(rec.get("purpose"))


def record_answer_text(rec: dict) -> str:
    if text(rec.get("answer")):  # field FAQ: the KB answer verbatim
        return text(rec.get("answer"))
    parts = [text(rec.get("summary")) or text(rec.get("purpose"))]
    instr = strs(rec.get("instructions")) or strs(rec.get("steps")) or strs(rec.get("actions"))
    parts += instr[:3]
    return f"{text(rec.get('title')) or rec['id']}: " + " ".join(p for p in parts if p)


def suggested_check(kb: KnowledgeBase, results: List[dict]) -> Optional[dict]:
    for r in results:
        if r["collection"] == "diagnostic_checks":
            return kb.get(r["kb_id"])
    checks = kb.records("diagnostic_checks")
    rel = [c for c in checks if c.get("gate_relevant") and not c.get("weak_evidence")]
    return (rel or checks or [None])[0]


def answer(kb: KnowledgeBase, question: str, prefer_ids: Set[str], step_id: Optional[str]) -> dict:
    idx = get_index(kb)
    results, _nq = idx.search(question, prefer_ids, step_id)
    best = results[0] if results else None
    if not best or best["coverage"] < MIN_COVERAGE or best["score"] < MIN_SCORE:
        chk = suggested_check(kb, results)
        ans = SAFE_ANSWER
        ids = []
        if chk:
            ans += f" Suggested observation: {text(chk.get('title'))}. {text(chk.get('summary'))}"
            ids = [chk["id"]]
        return {"answer": ans, "refused": True, "matched": [], "kb_ids": ids}
    top = [r for r in results[:3] if r["score"] >= 0.6 * best["score"] and r["coverage"] >= MIN_COVERAGE / 2]
    matched, parts = [], []
    for r in top:
        rec = kb.get(r["kb_id"])
        if not rec:
            continue
        snippet = record_snippet(rec)
        matched.append({"kb_id": rec["id"], "title": text(rec.get("title")) or rec["id"],
                        "snippet": snippet[:240], "collection": r["collection"]})
        parts.append(record_answer_text(rec))
    return {"answer": "\n\n".join(parts), "refused": False, "matched": matched, "kb_ids": [m["kb_id"] for m in matched]}


# ---------------------------------------------------------------- v1.3 "what next?" intent
NEXT_STEP_PATTERN = re.compile(
    r"\b(what(?:'s|s| is)? next|what now|what do i do( now| next)?|what should i do|what (?:do|should) i do next|"
    r"where (?:do|should) i go|what(?:'s|s| is) left|what remains|what is remaining|next step|next steps|"
    r"what(?:'s|s| is) the next)\b")


def is_next_step_question(question: str) -> bool:
    q = (question or "").lower().replace("\u2019", "'")
    return bool(NEXT_STEP_PATTERN.search(q))


def next_step_answer(kb: KnowledgeBase, plan: dict) -> dict:
    """Answer from the stored plan, in the enforced workflow order:
    prepare -> readiness (tasks, then tests) -> choose a crop -> plant (all KB text)."""
    from .planner import PHASE_ORDER, SOW_TASKS, gate_phase, task_phase  # local import: avoids a cycle

    wf = plan.get("workflow") or {}
    na = wf.get("next_action") or {}
    completed = set(plan.get("completed_tasks") or [])
    selected = (plan.get("_inputs") or {}).get("selected_crop_id")
    matched, ids = [], [plan.get("scenario_id") or ""]

    def add_match(kb_id, title, snippet, coll):
        if kb_id and kb_id not in [m["kb_id"] for m in matched]:
            matched.append({"kb_id": kb_id, "title": title or kb_id, "snippet": (snippet or "")[:240], "collection": coll})
            ids.append(kb_id)

    open_gates = [g for g in na.get("readiness_gate") or [] if g.get("required") and not g.get("satisfied")]
    open_gates.sort(key=lambda g: PHASE_ORDER.get(gate_phase(kb, g, list(completed)), 1))  # stable
    lines = [na.get("next_best_action") or ""]
    if open_gates:
        lines.append("Still open before planting:")
    for g in open_gates:
        task = next((t for t in g.get("satisfied_by_tasks") or [] if t not in completed and t in kb.task_ids), None)
        line = f"- {g.get('label')}"
        if g.get("blocking_reason") == "task_not_done" and task:
            line += f": {kb.task_ids[task]}"
        elif g.get("blocking_reason") in ("test_not_run", "test_failed") and (g.get("verification") or {}).get("test"):
            line += f": {g['verification']['test']}"
        lines.append(line)
        add_match(g.get("id"), g.get("label"), g.get("detail"), "scenarios.readiness_gate")
        if task:
            for rid in kb.task_owner.get(task, [])[:1]:
                rec = kb.get(rid) or {}
                add_match(rid, text(rec.get("title")), record_snippet(rec), kb.collection_of(rid) or "")

    if not open_gates:
        crops = (wf.get("crop_suggestions") or {}).get("field_crops") or []
        if not selected:
            step = "Next, choose a crop from the crop suggestions"
            if crops:
                step += f" (top-ranked: {crops[0]['name']})"
                add_match(crops[0]["crop_id"], crops[0]["name"], crops[0].get("maturity_description"), "crop_profiles")
            lines.append(step + ".")
        else:
            sow = next((c for c in (wf.get("planting_method") or {}).get("sowing") or []
                        if c.get("task_id") and c["task_id"] not in completed and task_phase(kb, c["task_id"]) == "plant"), None)
            if sow:
                lines.append(f"Next, plant: {sow['task_label']}.")
                add_match(sow["id"], sow["title"], sow["explanation"], "planting_methods")
    return {"answer": "\n".join(l for l in lines if l), "refused": False, "matched": matched,
            "kb_ids": [i for i in ids if i]}
