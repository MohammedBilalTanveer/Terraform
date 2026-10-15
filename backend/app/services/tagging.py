"""Observation -> derived tags, driven by the KB file `observation_cues.json`.

Rules (all keyword phrases and field->value mappings come from the KB):
  1. Structured form fields: a cue's `field_matches` maps a form field value to its tag (source "form").
  2. Free text: each cue's lowercase `keywords` are matched as whole phrases in the cue's `text_fields`
     ("description", "local_advice", "resources_text"), with word boundaries. A `negation_guard`
     phrase found anywhere in a scanned field cancels that cue's text match for that field
     (e.g. "not red" cancels the reddish cue; "runs off" cancels "soaks in").
  3. Confirmed checks: `diagnostic_checks[].possible_outcomes[].implies_tags` (source "check").
  4. Mutually exclusive groups from the contract vocabulary (slope, pooling, rain window, hardpan,
     digging, local advice, fizz, drainage) keep one tag: check > form > text; on a tie the longer
     (more specific) matched phrase wins. Cross-source disagreements are reported as conflicts.
  3b. Photo cues the user CONFIRMED (`photo_confirmed_tags`) become tags with source "photo", but only if
     the tag exists in the KB cue vocabulary AND is a visible cue (VISIBLE_PHOTO_TAGS); others are ignored.
  5. Unknown is a real state: `slope_unknown`, `pooling_unknown`, `rain_unknown`, `hardpan_unknown`,
     `season_unknown` and `local_advice_none` are added when nothing determined them (never `false`).
     `season_known` if wet_season_weeks_remaining is given; `photo_attached` if a photo_id is given;
     non-empty local advice with no matching cue -> `local_advice_other`.
A small fallback maps the contract's own form enums to contract tags only when the KB has no
`field_matches` entry for that field value (vocabulary mapping, not advice).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from .kb_loader import KnowledgeBase

TEXT_SOURCE = {"description": "description", "local_advice": "local_advice", "resources_text": "form"}
SOURCE_RANK = {"check": 3, "form": 2, "photo": 2, "description": 1, "local_advice": 1}

EXCLUSIVE_GROUPS: Dict[str, List[str]] = {
    "slope": ["slope_flat", "slope_slight", "slope_steep"],
    "pooling": ["pooling_none", "pooling_some", "pooling_widespread"],
    "rain_window": ["rain_not_started", "rain_just_started", "rain_ongoing", "rain_ending"],
    "hardpan": ["hardpan_patchy", "hardpan_continuous"],
    "digging": ["digging_shallow", "digging_deep_possible"],
    "local_advice": ["local_advice_trees_only", "local_advice_other", "local_advice_none"],
    "fizz": ["fizz_seen", "fizz_none"],
    "drainage": ["drains_fast", "drains_slow"],
}

# group -> (unknown tag, tags that determine the group)
UNKNOWN_RULES = {
    "slope": ("slope_unknown", ["slope_flat", "slope_slight", "slope_steep"]),
    "pooling": ("pooling_unknown", ["pooling_none", "pooling_some", "pooling_widespread"]),
    "rain_window": ("rain_unknown", ["rain_not_started", "rain_just_started", "rain_ongoing", "rain_ending"]),
    "hardpan": ("hardpan_unknown", ["hardpan_patchy", "hardpan_continuous", "digging_deep_possible"]),
}

# Neutral labels for synthesized state tags when the KB has no cue for them.
NEUTRAL_LABELS = {
    "slope_unknown": "slope not reported",
    "pooling_unknown": "pooling not reported",
    "rain_unknown": "rain timing not reported",
    "hardpan_unknown": "how continuous the hard layer is: not yet known",
    "season_unknown": "weeks of rain remaining: not estimated",
    "season_known": "weeks of rain remaining: estimate given",
    "local_advice_none": "no local advice given",
    "local_advice_other": "local advice given",
    "photo_attached": "photo attached",
}

# Fallback mapping of contract form enums -> contract tags (used only if the KB lacks a field_match).
FALLBACK_FIELD_MAP: Dict[str, Dict[str, str]] = {
    "surface_colour": {"reddish": "colour_reddish", "dark": "colour_dark", "pale": "colour_pale"},
    "surface_texture": {"stony": "texture_stony", "gravelly": "texture_gravelly",
                        "rock_lumps": "texture_rock_lumps", "crusted": "texture_crusted"},
    "digging_resistance": {"hard_layer_near_surface": "digging_shallow", "varies_by_spot": "hardpan_patchy",
                           "rock_sheet_everywhere": "hardpan_continuous", "can_dig_deep": "digging_deep_possible"},
    "rain_behavior": {"fast_runoff": "runoff_fast", "soaks_in": "rain_soaks_in", "red_streams": "erosion_marks",
                      "pools": "pooling_some"},
    "vegetation": {"dry_grass": "vegetation_dry_grass", "thorny_shrubs": "vegetation_thorny_shrubs",
                   "trees_nearby": "vegetation_trees_nearby"},
    "slope": {"flat": "slope_flat", "slight": "slope_slight", "steep": "slope_steep"},
    "pooling": {"none_seen": "pooling_none", "some_areas": "pooling_some", "widespread": "pooling_widespread"},
    "rain_window": {"not_started": "rain_not_started", "just_started": "rain_just_started",
                    "ongoing": "rain_ongoing", "ending": "rain_ending"},
    "available_resources": {
        "compost": "res_compost", "manure": "res_manure", "mulch": "res_mulch", "leaf_litter": "res_leaf_litter",
        "stones": "res_stones", "wood_ash": "res_wood_ash", "crushed_shells": "res_crushed_shells",
        "water_containers": "res_water_containers", "seeds": "res_seeds", "hand_tools": "res_hand_tools",
        "bucket": "res_bucket", "none_compost": "no_compost", "little_water": "low_water",
    },
}

# Cues a photo can show. Never soil chemistry, depth or hard-layer continuity.
VISIBLE_PHOTO_TAGS = [
    "colour_reddish", "colour_dark", "colour_pale",
    "texture_stony", "texture_gravelly", "texture_rock_lumps", "texture_crusted",
    "erosion_marks", "pooling_none", "pooling_some", "pooling_widespread",
    "vegetation_dry_grass", "vegetation_thorny_shrubs", "vegetation_trees_nearby",
    "slope_flat", "slope_slight", "slope_steep",
]
PHOTO_CONFIRMED_TEXT = "confirmed from photo"

STATE_TAGS = {"slope_unknown", "pooling_unknown", "rain_unknown", "hardpan_unknown", "season_unknown",
              "local_advice_none"}


@dataclass
class TagResult:
    tags: List[dict]
    tag_set: Set[str]
    labels: Dict[str, str]
    conflicts: List[dict] = field(default_factory=list)
    weeks_remaining: Optional[float] = None
    resources_given: bool = False

    def label(self, tag: str) -> str:
        return self.labels.get(tag, tag)


def normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    t = str(text).lower().replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", t).strip()


def _pattern(phrase: str) -> re.Pattern:
    return re.compile(r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])")


def match_cue_text(text: str, keywords: List[str], guards: List[str]) -> Optional[str]:
    """Return the longest keyword matched in `text` after applying negation guards, or None."""
    if not text:
        return None
    kws = [normalize(k) for k in keywords if isinstance(k, str) and k.strip()]
    for g in guards or []:
        g = normalize(g)
        if g and _pattern(g).search(text):
            return None
    best = None
    for k in kws:
        if _pattern(k).search(text) and (best is None or len(k) > len(best)):
            best = k
    return best


def _field_values(obs: dict, field_name: str) -> List[str]:
    v = obs.get(field_name)
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v if x is not None]
    return [str(v)]


def derive_tags(kb: KnowledgeBase, observation: dict) -> TagResult:
    obs = observation or {}
    cues = [c for c in kb.records("observation_cues") if isinstance(c.get("tag"), str)]
    cue_by_tag: Dict[str, dict] = {}
    for c in cues:
        cue_by_tag.setdefault(c["tag"], c)
    labels: Dict[str, str] = {t: str(c.get("label") or c.get("title") or t) for t, c in cue_by_tag.items()}
    for t, lab in NEUTRAL_LABELS.items():
        labels.setdefault(t, lab)

    candidates: List[dict] = []

    def add(tag, source, matched_text, cue_id, label=None):
        candidates.append({
            "tag": tag,
            "label": label or labels.get(tag) or tag.replace("_", " "),
            "source": source,
            "matched_text": matched_text,
            "cue_id": cue_id,
        })

    # 1. structured form fields
    kb_mapped: Set[tuple] = set()
    for c in cues:
        for fm in c.get("field_matches") or []:
            if not isinstance(fm, dict):
                continue
            fname = fm.get("field")
            values = [str(v) for v in fm.get("values") or []]
            for v in values:
                kb_mapped.add((fname, v))
            for val in _field_values(obs, fname):
                if val in values:
                    add(c["tag"], "form", val, c["id"])
    for fname, mapping in FALLBACK_FIELD_MAP.items():
        for val in _field_values(obs, fname):
            if (fname, val) in kb_mapped or val not in mapping:
                continue
            tag = mapping[val]
            cue = cue_by_tag.get(tag)
            add(tag, "form", val, cue["id"] if cue else None)

    # 2. free text
    texts = {
        "description": normalize(obs.get("description")),
        "local_advice": normalize(obs.get("local_advice")),
        "resources_text": normalize(obs.get("resources_text")),
    }
    for c in cues:
        fields = c.get("text_fields") or (["description"] if c.get("keywords") else [])
        for fname in fields:
            text = texts.get(fname, "")
            hit = match_cue_text(text, c.get("keywords") or [], c.get("negation_guard") or [])
            if hit:
                add(c["tag"], TEXT_SOURCE.get(fname, "description"), hit, c["id"])

    # 3. confirmed checks
    checks = {r["id"]: r for r in kb.records("diagnostic_checks")}
    for uc in obs.get("user_confirmed_checks") or []:
        cid, oid = uc.get("check_id"), uc.get("outcome_id")
        chk = checks.get(cid)
        if not chk:
            continue
        for oc in chk.get("possible_outcomes") or []:
            if oc.get("outcome_id") == oid:
                for t in oc.get("implies_tags") or []:
                    cue = cue_by_tag.get(t)
                    add(t, "check", str(oc.get("label") or oid), cue["id"] if cue else None,
                        label=labels.get(t) or str(oc.get("label") or t))

    # 3b. user-confirmed photo cues
    for t in obs.get("photo_confirmed_tags") or []:
        if isinstance(t, str) and t in VISIBLE_PHOTO_TAGS and t in cue_by_tag:
            add(t, "photo", PHOTO_CONFIRMED_TEXT, cue_by_tag[t]["id"])

    # dedupe: strongest source first, then longer matched phrase
    best: Dict[str, dict] = {}
    order: List[str] = []
    for cand in candidates:
        t = cand["tag"]
        if t not in best:
            best[t] = cand
            order.append(t)
        elif _strength(cand) > _strength(best[t]):
            best[t] = cand

    # 4. exclusive groups
    conflicts: List[dict] = []
    for group, members in EXCLUSIVE_GROUPS.items():
        present = [best[t] for t in members if t in best]
        if len(present) <= 1:
            continue
        keep = max(present, key=_strength)
        if group == "local_advice" and "local_advice_trees_only" in best:
            keep = best["local_advice_trees_only"]  # the specific claim is kept so it can be checked
        for p in present:
            if p is keep:
                continue
            if p["source"] != keep["source"] and group != "local_advice":
                conflicts.append({"group": group, "kept": keep, "dropped": p})
            del best[p["tag"]]
    order = [t for t in order if t in best]

    # 5. unknown / state tags
    def ensure(tag, source="form", matched=None):
        if tag not in best:
            cue = cue_by_tag.get(tag)
            best[tag] = {"tag": tag, "label": labels.get(tag, tag), "source": source,
                         "matched_text": matched, "cue_id": cue["id"] if cue else None}
            order.append(tag)

    def drop(tag):
        if tag in best:
            del best[tag]
            order.remove(tag)

    for group, (unknown_tag, determined) in UNKNOWN_RULES.items():
        if any(t in best for t in determined):
            drop(unknown_tag)
        else:
            ensure(unknown_tag)

    weeks = obs.get("wet_season_weeks_remaining")
    if weeks is None and "season_known" in best:
        weeks = _extract_weeks(texts["description"])
    if weeks is not None:
        try:
            weeks = float(weeks)
        except (TypeError, ValueError):
            weeks = None
    if weeks is not None:
        if "season_known" not in best:
            ensure("season_known", "form", _fmt_num(weeks))
        drop("season_unknown")
    else:
        drop("season_known")
        ensure("season_unknown")

    advice_text = (obs.get("local_advice") or "").strip()
    if advice_text:
        drop("local_advice_none")
        if not any(t in best for t in ("local_advice_trees_only", "local_advice_other")):
            ensure("local_advice_other", "local_advice", advice_text)
    elif not any(t in best for t in ("local_advice_trees_only", "local_advice_other")):
        ensure("local_advice_none")
    else:
        drop("local_advice_none")

    if obs.get("photo_id"):
        ensure("photo_attached", "photo", None)

    tags = [best[t] for t in order]
    resources_given = bool(obs.get("available_resources")) or bool(texts["resources_text"])
    return TagResult(tags=tags, tag_set={t["tag"] for t in tags}, labels=labels, conflicts=conflicts,
                     weeks_remaining=weeks, resources_given=resources_given)


def _rank(c: dict) -> int:
    return SOURCE_RANK.get(c["source"], 0)


def _strength(c: dict):
    return (_rank(c), len(c.get("matched_text") or ""))


def _fmt_num(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else str(x)


def _extract_weeks(text: str) -> Optional[float]:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:more\s+)?weeks?\b", text or "")
    return float(m.group(1)) if m else None


def is_state_tag(tag: str) -> bool:
    return tag in STATE_TAGS or tag.endswith("_unknown")


def observed_tags(result: TagResult) -> List[dict]:
    """Tags that describe something the user actually reported (not unknown/none states)."""
    return [t for t in result.tags if not is_state_tag(t["tag"])]


def as_dict(obj: Any) -> dict:
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return dict(obj)
