"""Evidence collection/validation and the confidence rule (CONTRACT.md section 4).

Confidence rule:
  high   = record evidence_level == "locally_verified"
           OR (record has >=1 source AND none of the unknowns relevant to this context remain)
  medium = >=1 source, but some relevant (non-key) unknowns remain
  low    = no sources, OR a key unknown (hard layer continuity / season length) relevant to this
           context is unresolved.

"Relevant unknowns" per context:
  soil      (treatments, planting methods, regeneration): key = hardpan_unknown; others = slope/pooling
  crop      (crop cards, timeframe rows, trial advice):   key = hardpan_unknown, season_unknown; others = rain
  check     (diagnostic checks): no key unknowns (checks are how unknowns get resolved)
  care      (care stages, pests, harvest): no key unknowns
"""
from __future__ import annotations

from typing import Iterable, List, Set

from .kb_loader import KnowledgeBase

CONTEXT_UNKNOWNS = {
    "soil": ({"hardpan_unknown"}, {"slope_unknown", "pooling_unknown"}),
    "crop": ({"hardpan_unknown", "season_unknown"}, {"rain_unknown"}),
    "check": (set(), set()),
    "care": (set(), {"rain_unknown"}),
}


def confidence(record: dict, tags: Set[str], context: str = "soil") -> str:
    if record.get("evidence_level") == "locally_verified":
        return "high"
    if not record.get("source_ids"):
        return "low"
    key, other = CONTEXT_UNKNOWNS.get(context, (set(), set()))
    if key & tags:
        return "low"
    if other & tags:
        return "medium"
    return "high"


def make_evidence(kb: KnowledgeBase, kb_ids: Iterable[str], extra_source_ids: Iterable[str] = ()) -> dict:
    """Build an Evidence object; keeps only ids that exist in the KB, and sources of those records."""
    ids: List[str] = []
    for i in kb_ids:
        if isinstance(i, str) and kb.has(i) and i not in ids:
            ids.append(i)
    srcs: List[str] = []
    known_sources = kb.sources
    for i in ids:
        rec = kb.get(i) or {}
        for s in rec.get("source_ids") or []:
            if s in known_sources and s not in srcs:
                srcs.append(s)
    for s in extra_source_ids:
        if s in known_sources and s not in srcs:
            srcs.append(s)
    return {"kb_ids": ids, "source_ids": srcs}


def merge_evidence(*evs: dict) -> dict:
    kb_ids: List[str] = []
    src: List[str] = []
    for e in evs:
        if not e:
            continue
        for i in e.get("kb_ids", []):
            if i not in kb_ids:
                kb_ids.append(i)
        for s in e.get("source_ids", []):
            if s not in src:
                src.append(s)
    return {"kb_ids": kb_ids, "source_ids": src}


def collect_all(obj, out=None) -> dict:
    """Walk a response structure and merge every nested `evidence` object."""
    if out is None:
        out = {"kb_ids": [], "source_ids": []}
    if isinstance(obj, dict):
        ev = obj.get("evidence")
        if isinstance(ev, dict) and "kb_ids" in ev:
            for i in ev.get("kb_ids", []):
                if i not in out["kb_ids"]:
                    out["kb_ids"].append(i)
            for s in ev.get("source_ids", []):
                if s not in out["source_ids"]:
                    out["source_ids"].append(s)
        for k, v in obj.items():
            if k != "evidence":
                collect_all(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_all(v, out)
    return out


def invalid_ids(kb: KnowledgeBase, evidence: dict) -> List[str]:
    bad = [i for i in evidence.get("kb_ids", []) if not kb.has(i)]
    bad += [s for s in evidence.get("source_ids", []) if s not in kb.sources]
    return bad
