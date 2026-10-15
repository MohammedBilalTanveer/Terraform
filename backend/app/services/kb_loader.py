"""Load and validate the local JSON knowledge base (KB).

The KB is the ONLY source of agricultural content. This module:
  * parses every `*.json` file in KB_DIRECTORY (envelope `{collection, version, records}`);
    a JSON Schema file (`schema.json` / top-level `$schema`) is skipped, not treated as a collection,
  * checks that ids are present, globally unique and use a known prefix,
  * checks cross references (source_ids, care_stage_ids, pest_ids, harvest_profile_id,
    planting_method_ids, scenario unknown check_ids, readiness gate satisfied_by_tasks -> task ids,
    sources.supports_kb_ids, crop_ids, scenario catalog `file`),
  * reports every problem as a readable string in `KnowledgeBase.errors` (surfaced by /api/health).

It never invents replacement ids and never edits the KB: broken references are reported, and the
record is still served as written.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Collection names defined by CONTRACT.md section 3 (file stem == collection name), except the
# scenario record files which are named after their scenario id.
COLLECTIONS = [
    "scenario_catalog",
    "observation_cues",
    "diagnostic_checks",
    "soil_treatments",
    "crop_profiles",
    "planting_methods",
    "care_stages",
    "pest_management",
    "harvest_profiles",
    "regeneration",
    "timeframe_rules",
    "sources",
    "stress_mitigation",  # v1.1
    "troubleshooting",  # v1.2
    "field_faq",  # v1.2
]
OPTIONAL_COLLECTIONS = {"stress_mitigation", "troubleshooting", "field_faq"}
CROP_CATEGORIES = ("field_crop", "tree", "soil_builder")
REQUIRED_COLLECTIONS = [c for c in COLLECTIONS if c not in OPTIONAL_COLLECTIONS]
SCENARIO_COLLECTION = "scenarios"

ID_PREFIXES = (
    "scenario_", "cue_", "check_", "treat_", "crop_", "plant_", "care_", "pest_",
    "harvest_", "regen_", "time_", "gate_", "src_", "stress_", "trouble_", "faq_",
)

# collection -> prefix expected for its records (used only for a readable warning)
EXPECTED_PREFIX = {
    "scenario_catalog": "scenario_",
    "observation_cues": "cue_",
    "diagnostic_checks": "check_",
    "soil_treatments": "treat_",
    "crop_profiles": "crop_",
    "planting_methods": "plant_",
    "care_stages": "care_",
    "pest_management": "pest_",
    "harvest_profiles": "harvest_",
    "regeneration": "regen_",
    "timeframe_rules": "time_",
    "sources": "src_",
    "stress_mitigation": "stress_",
    "troubleshooting": "trouble_",
    "field_faq": "faq_",
    SCENARIO_COLLECTION: "scenario_",
}


@dataclass
class KnowledgeBase:
    directory: Path
    collections: Dict[str, List[dict]] = field(default_factory=dict)
    by_id: Dict[str, Tuple[dict, str]] = field(default_factory=dict)  # id -> (record, collection)
    file_versions: Dict[str, str] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    skipped_files: List[str] = field(default_factory=list)
    task_ids: Dict[str, str] = field(default_factory=dict)  # task_id -> label
    task_owner: Dict[str, List[str]] = field(default_factory=dict)  # task_id -> record ids
    version: str = "unknown"
    loaded: bool = False

    # ------------------------------------------------------------- access helpers
    def records(self, collection: str) -> List[dict]:
        return self.collections.get(collection, [])

    def get(self, kb_id: str) -> Optional[dict]:
        hit = self.by_id.get(kb_id)
        return hit[0] if hit else None

    def collection_of(self, kb_id: str) -> Optional[str]:
        hit = self.by_id.get(kb_id)
        return hit[1] if hit else None

    def has(self, kb_id: str) -> bool:
        return kb_id in self.by_id

    @property
    def record_count(self) -> int:
        return sum(len(v) for v in self.collections.values())

    @property
    def scenarios(self) -> Dict[str, dict]:
        return {r["id"]: r for r in self.records(SCENARIO_COLLECTION) if isinstance(r.get("id"), str)}

    def scenario(self, scenario_id: str) -> Optional[dict]:
        return self.scenarios.get(scenario_id)

    @property
    def sources(self) -> Dict[str, dict]:
        return {r["id"]: r for r in self.records("sources") if isinstance(r.get("id"), str)}

    def stats(self) -> Dict[str, int]:
        return {name: len(recs) for name, recs in sorted(self.collections.items())}


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _classify(stem: str, collection: Any, catalog_files: Iterable[str]) -> str:
    name = collection if isinstance(collection, str) and collection else stem
    if name in COLLECTIONS:
        return name
    if stem in COLLECTIONS:
        return stem
    if f"{stem}.json" in set(catalog_files) or stem.startswith("scenario_") or str(name).startswith("scenario_"):
        return SCENARIO_COLLECTION
    return name


def load_kb(directory: Path | str) -> KnowledgeBase:
    directory = Path(directory)
    kb = KnowledgeBase(directory=directory)
    if not directory.exists() or not directory.is_dir():
        kb.errors.append(f"KB directory not found: {directory}")
        return kb

    files = sorted(p for p in directory.glob("*.json") if p.is_file())
    if not files:
        kb.errors.append(f"KB directory contains no .json files: {directory}")
        return kb

    parsed: List[Tuple[Path, dict]] = []
    for path in files:
        try:
            with path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
        except json.JSONDecodeError as exc:
            kb.errors.append(f"{path.name}: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")
            continue
        except (OSError, UnicodeDecodeError) as exc:
            kb.errors.append(f"{path.name}: could not be read ({exc})")
            continue
        if isinstance(data, dict) and ("$schema" in data or path.stem == "schema"):
            kb.skipped_files.append(path.name)  # JSON Schema describing the KB, not a collection
            continue
        if not isinstance(data, dict):
            kb.errors.append(f"{path.name}: top level must be an object with 'collection', 'version' and 'records'")
            continue
        if not isinstance(data.get("records"), list):
            kb.errors.append(f"{path.name}: missing 'records' list in the file envelope")
            continue
        parsed.append((path, data))

    catalog_files: List[str] = []
    for path, data in parsed:
        if data.get("collection") == "scenario_catalog" or path.stem == "scenario_catalog":
            catalog_files = [r.get("file") for r in data["records"] if isinstance(r, dict) and r.get("file")]

    for path, data in parsed:
        cname = _classify(path.stem, data.get("collection"), catalog_files)
        kb.file_versions[path.name] = str(data.get("version", ""))
        bucket = kb.collections.setdefault(cname, [])
        for idx, rec in enumerate(data["records"]):
            where = f"{path.name} record #{idx + 1}"
            if not isinstance(rec, dict):
                kb.errors.append(f"{where}: record must be an object")
                continue
            rid = rec.get("id")
            if not isinstance(rid, str) or not rid.strip():
                kb.errors.append(f"{where}: missing 'id'")
                continue
            where = f"{path.name} record '{rid}'"
            if cname == "scenario_catalog":
                # catalog entries intentionally reuse their scenario's id: own namespace
                if any(r.get("id") == rid for r in bucket):
                    kb.errors.append(f"{where}: duplicate id inside the scenario catalog")
                    continue
                if not rid.startswith("scenario_"):
                    kb.errors.append(f"{where}: id does not use the 'scenario_' prefix")
                bucket.append(rec)
                if rid not in kb.by_id:
                    kb.by_id[rid] = (rec, cname)
                continue
            if rid in kb.by_id and kb.by_id[rid][1] == "scenario_catalog" and cname == SCENARIO_COLLECTION:
                kb.by_id[rid] = (rec, cname)  # the full scenario record wins over its catalog entry
                bucket.append(rec)
                continue
            if rid in kb.by_id:
                other = kb.by_id[rid][1]
                kb.errors.append(f"{where}: duplicate id (already defined in collection '{other}')")
                continue
            if not rid.startswith(ID_PREFIXES):
                kb.errors.append(f"{where}: id does not use a known prefix ({', '.join(ID_PREFIXES)})")
            exp = EXPECTED_PREFIX.get(cname)
            if exp and not rid.startswith(exp) and rid.startswith(ID_PREFIXES):
                kb.errors.append(f"{where}: id prefix does not match collection '{cname}' (expected '{exp}')")
            aw = rec.get("applies_when")
            if aw is not None and not isinstance(aw, dict):
                kb.errors.append(f"{where}: 'applies_when' must be an object with any_tags/all_tags/none_tags")
            bucket.append(rec)
            kb.by_id[rid] = (rec, cname)

    for cname in REQUIRED_COLLECTIONS:
        if cname not in kb.collections:
            kb.errors.append(f"missing required KB collection '{cname}' (expected file {cname}.json)")
    if not kb.records(SCENARIO_COLLECTION):
        kb.errors.append("no scenario record file found (e.g. scenario_05_lateritic_hardpan.json)")

    _collect_tasks(kb)
    _check_references(kb)

    catalog_version = kb.file_versions.get("scenario_catalog.json")
    versions = [v for v in kb.file_versions.values() if v]
    kb.version = catalog_version or (max(set(versions), key=versions.count) if versions else "unknown")
    kb.loaded = bool(kb.records(SCENARIO_COLLECTION)) and bool(kb.collections)
    return kb


def _collect_tasks(kb: KnowledgeBase) -> None:
    for rid, (rec, _c) in kb.by_id.items():
        task = rec.get("task")
        if isinstance(task, dict) and isinstance(task.get("task_id"), str):
            tid = task["task_id"]
            kb.task_ids.setdefault(tid, str(task.get("label") or tid))
            kb.task_owner.setdefault(tid, []).append(rid)


def _ref(kb: KnowledgeBase, where: str, field_name: str, ref_id: Any, allowed: Optional[Iterable[str]] = None) -> None:
    if not isinstance(ref_id, str):
        kb.errors.append(f"{where}: '{field_name}' contains a non-string value {ref_id!r}")
        return
    if allowed is not None:
        if ref_id not in set(allowed):
            kb.errors.append(f"{where}: '{field_name}' references unknown id '{ref_id}'")
    elif not kb.has(ref_id):
        kb.errors.append(f"{where}: '{field_name}' references unknown id '{ref_id}'")


def _check_references(kb: KnowledgeBase) -> None:
    source_ids = set(kb.sources)
    ids_in = lambda c: {r.get("id") for r in kb.records(c)}  # noqa: E731
    care_ids, pest_ids = ids_in("care_stages"), ids_in("pest_management")
    harvest_ids, method_ids = ids_in("harvest_profiles"), ids_in("planting_methods")
    check_ids, crop_ids = ids_in("diagnostic_checks"), ids_in("crop_profiles")

    pairs = [(rec.get("id"), rec, cname) for cname, recs in kb.collections.items() for rec in recs]
    for rid, rec, cname in pairs:
        where = f"{cname} record '{rid}'"
        if cname != "sources":
            for sid in _as_list(rec.get("source_ids")):
                _ref(kb, where, "source_ids", sid, source_ids)
        if cname == "crop_profiles":
            for x in _as_list(rec.get("care_stage_ids")):
                _ref(kb, where, "care_stage_ids", x, care_ids)
            for x in _as_list(rec.get("pest_ids")):
                _ref(kb, where, "pest_ids", x, pest_ids)
            if rec.get("harvest_profile_id") is not None:
                _ref(kb, where, "harvest_profile_id", rec.get("harvest_profile_id"), harvest_ids)
            for x in _as_list(rec.get("planting_method_ids")):
                _ref(kb, where, "planting_method_ids", x, method_ids)
            if rec.get("category") not in CROP_CATEGORIES:
                kb.errors.append(f"{where}: 'category' must be one of {', '.join(CROP_CATEGORIES)} "
                                 f"(got {rec.get('category')!r})")
        if cname in ("care_stages", "pest_management"):
            for x in _as_list(rec.get("crop_ids")):
                if x != "*":
                    _ref(kb, where, "crop_ids", x, crop_ids)
        if cname == "harvest_profiles" and rec.get("crop_id") is not None:
            _ref(kb, where, "crop_id", rec.get("crop_id"), crop_ids)
        if cname == "sources":
            for x in _as_list(rec.get("supports_kb_ids")):
                _ref(kb, where, "supports_kb_ids", x)
        if cname == SCENARIO_COLLECTION:
            for u in _as_list(rec.get("unknowns")):
                if not isinstance(u, dict):
                    continue
                for x in _as_list(u.get("check_ids")):
                    _ref(kb, f"{where} unknown '{u.get('id')}'", "check_ids", x, check_ids)
            for g in _as_list(rec.get("readiness_gate")):
                if not isinstance(g, dict):
                    continue
                gw = f"{where} gate '{g.get('id')}'"
                for t in _as_list(g.get("satisfied_by_tasks")):
                    _ref(kb, gw, "satisfied_by_tasks", t, kb.task_ids)
                for sid in _as_list(g.get("source_ids")):
                    _ref(kb, gw, "source_ids", sid, source_ids)
                v = g.get("verification")
                if v is not None:
                    if not isinstance(v, dict):
                        kb.errors.append(f"{gw}: 'verification' must be an object with test/pass/fail/if_fail or null")
                    else:
                        missing = [k for k in ("test", "pass", "fail", "if_fail")
                                   if not isinstance(v.get(k), str) or not v.get(k).strip()]
                        if missing:
                            kb.errors.append(f"{gw}: 'verification' is missing text for {', '.join(missing)}")
            seen_factors = set()
            for f in _as_list(rec.get("failure_factors")):
                if not isinstance(f, dict) or not isinstance(f.get("id"), str):
                    kb.errors.append(f"{where}: each failure_factors item needs an 'id'")
                    continue
                fw = f"{where} failure factor '{f['id']}'"
                if f["id"] in seen_factors:
                    kb.errors.append(f"{fw}: duplicate failure factor id")
                seen_factors.add(f["id"])
                for x in _as_list(f.get("addressed_by")):
                    _ref(kb, fw, "addressed_by", x)
                for key in ("triggered_by_tags", "indirect_tags"):
                    if not isinstance(f.get(key, []) or [], list):
                        kb.errors.append(f"{fw}: '{key}' must be a list")
        if cname in ("troubleshooting", "field_faq"):
            for x in _as_list(rec.get("related_kb_ids")):
                _ref(kb, where, "related_kb_ids", x)
        if cname == "timeframe_rules" and rec.get("phases") is not None:
            ph = rec.get("phases")
            if not isinstance(ph, list) or not all(isinstance(p, dict) and isinstance(p.get("when"), str) for p in ph):
                kb.errors.append(f"{where}: 'phases' must be a list of {{when, actions}} objects")
        if cname == "timeframe_rules" and rec.get("prep_weeks") is not None:
            pw = rec.get("prep_weeks")
            if not (isinstance(pw, dict) and isinstance(pw.get("min"), (int, float)) and isinstance(pw.get("max"), (int, float))):
                kb.errors.append(f"{where}: 'prep_weeks' must be {{min, max}} numbers")
        if cname == "scenario_catalog" and rec.get("status") == "available":
            f = rec.get("file")
            if not f or not (kb.directory / str(f)).exists():
                kb.errors.append(f"{where}: available scenario points to missing file {f!r}")
