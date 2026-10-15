"""Turn KB records into response cards. Every string copied here comes from the KB record itself;
the only Python-authored text is neutral connective text (e.g. "General guidance for this land type")."""
from __future__ import annotations

from typing import Any, Iterable, List, Optional

from .evidence import confidence, make_evidence
from .kb_loader import KnowledgeBase
from .retrieval import is_unconditional, triggering_tags
from .tagging import TagResult

GENERAL_MATCH = "General guidance for this land type"
VALID_PRIORITIES = {"do_first", "do_next", "avoid", "optional"}


def strs(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        out = []
        for v in value:
            if isinstance(v, str):
                if v.strip():
                    out.append(v)
            elif isinstance(v, dict):
                # e.g. {"text": "..."} or step objects; keep any text-like value
                txt = v.get("text") or v.get("instruction") or v.get("label") or v.get("step")
                if isinstance(txt, str) and txt.strip():
                    out.append(txt)
            elif v is not None:
                out.append(str(v))
        return out
    return [str(value)]


def text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(strs(value))
    return str(value)


def why_matches(record: dict, tr: TagResult) -> List[str]:
    trig = triggering_tags(record, tr.tag_set)
    if trig:
        return [tr.label(t) for t in trig]
    return [GENERAL_MATCH]


def to_recommendation(
    kb: KnowledgeBase,
    record: dict,
    tr: TagResult,
    context: str = "soil",
    *,
    extra_actions: Iterable[str] = (),
    extra_limitations: Iterable[str] = (),
    why: Optional[List[str]] = None,
    extra_kb_ids: Iterable[str] = (),
) -> dict:
    task = record.get("task") if isinstance(record.get("task"), dict) else None
    actions = strs(record.get("instructions")) or strs(record.get("steps"))
    if record.get("steps") and record.get("instructions"):
        for s in strs(record.get("steps")):
            if s not in actions:
                actions.append(s)
    if isinstance(record.get("when_to_sow"), str) and record["when_to_sow"].strip():
        actions.append(record["when_to_sow"])
    actions += [a for a in extra_actions if a not in actions]
    limitations = strs(record.get("limitations")) + [x for x in extra_limitations]
    pri = record.get("priority")
    return {
        "id": record["id"],
        "title": text(record.get("title")) or record["id"],
        "explanation": text(record.get("summary")) or text(record.get("purpose")),
        "actions": actions,
        "everyday_amounts": strs(record.get("everyday_amounts")),
        "why_this_matches": why if why is not None else why_matches(record, tr),
        "limitations": limitations,
        "safety_notes": strs(record.get("safety_notes")),
        "confidence": confidence(record, tr.tag_set, context),
        "priority": pri if pri in VALID_PRIORITIES else None,
        "category": record.get("category") or record.get("method_type") or None,
        "task_id": task.get("task_id") if task else None,
        "task_label": (task.get("label") or task.get("task_id")) if task else None,
        "evidence": make_evidence(kb, [record["id"], *extra_kb_ids]),
    }


def unconditional(record: dict) -> bool:
    return is_unconditional(record)
