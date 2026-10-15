"""Tag-based record selection.

`applies_when` semantics (CONTRACT.md section 3): a record applies if
(any_tags empty OR at least one present) AND (all all_tags present) AND (no none_tags present).
"""
from __future__ import annotations

from typing import Iterable, List, Optional, Set

from .kb_loader import KnowledgeBase

PRIORITY_ORDER = {"do_first": 0, "do_next": 1, "optional": 2, "avoid": 3}


def _aw(record: dict) -> dict:
    aw = record.get("applies_when")
    return aw if isinstance(aw, dict) else {}


def tag_lists(record: dict):
    aw = _aw(record)
    return (
        [t for t in aw.get("any_tags") or [] if isinstance(t, str)],
        [t for t in aw.get("all_tags") or [] if isinstance(t, str)],
        [t for t in aw.get("none_tags") or [] if isinstance(t, str)],
    )


def applies(record: dict, tags: Set[str]) -> bool:
    any_t, all_t, none_t = tag_lists(record)
    if any_t and not any(t in tags for t in any_t):
        return False
    if any(t not in tags for t in all_t):
        return False
    if any(t in tags for t in none_t):
        return False
    return True


def triggering_tags(record: dict, tags: Set[str]) -> List[str]:
    """Present tags that appear in the record's any_tags/all_tags (what made it match)."""
    any_t, all_t, _ = tag_lists(record)
    out: List[str] = []
    for t in any_t + all_t:
        if t in tags and t not in out:
            out.append(t)
    return out


def blocking_tags(record: dict, tags: Set[str]) -> List[str]:
    """Present tags that appear in the record's none_tags (what excluded it)."""
    _, _, none_t = tag_lists(record)
    return [t for t in none_t if t in tags]


def is_unconditional(record: dict) -> bool:
    any_t, all_t, none_t = tag_lists(record)
    return not any_t and not all_t and not none_t


def mentions_tag(record: dict, tag: str) -> bool:
    any_t, all_t, none_t = tag_lists(record)
    return tag in any_t or tag in all_t or tag in none_t


def select(
    kb: KnowledgeBase,
    collection: str,
    tags: Set[str],
    *,
    category: Optional[Iterable[str]] = None,
    priority: Optional[Iterable[str]] = None,
    method_type: Optional[Iterable[str]] = None,
    scenario_id: Optional[str] = None,
) -> List[dict]:
    cats = set(category) if category is not None else None
    pris = set(priority) if priority is not None else None
    mts = set(method_type) if method_type is not None else None
    out = []
    for rec in kb.records(collection):
        if scenario_id and rec.get("scenario_tags") and scenario_id not in rec.get("scenario_tags", []):
            continue
        if cats is not None and rec.get("category") not in cats:
            continue
        if pris is not None and rec.get("priority") not in pris:
            continue
        if mts is not None and rec.get("method_type") not in mts:
            continue
        if applies(rec, tags):
            out.append(rec)
    return out


def for_crop(records: Iterable[dict], crop_id: str) -> List[dict]:
    """Records whose crop_ids include the crop or the generic marker '*'."""
    out = []
    for rec in records:
        ids = rec.get("crop_ids") or []
        if crop_id in ids or "*" in ids or rec.get("crop_id") == crop_id:
            out.append(rec)
    return out
