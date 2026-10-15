"""Read-only knowledge base endpoints (/api/knowledge/...)."""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..deps import require_kb, require_scenario
from ..errors import AppError
from ..schemas import KbRecordResponse, ScenarioListResponse, SourcesResponse, StatsResponse
from ..services.kb_loader import SCENARIO_COLLECTION

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def _source_view(rec: dict) -> dict:
    out = dict(rec)
    for k in ("title", "organization", "url", "accessed_on", "notes", "verification"):
        v = out.get(k)
        out[k] = "" if v is None else str(v)
    return out


@router.get("/scenarios", response_model=ScenarioListResponse)
def list_scenarios(request: Request):
    kb = require_kb(request)
    items = kb.records("scenario_catalog") or kb.records(SCENARIO_COLLECTION)
    return {"scenarios": [{
        "id": r["id"], "title": str(r.get("title") or r["id"]),
        "tags": [t for t in r.get("tags") or [] if isinstance(t, str)],
        "status": str(r.get("status") or ("available" if kb.scenario(r["id"]) else "planned")),
    } for r in items]}


@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str, request: Request):
    kb = require_kb(request)
    return require_scenario(kb, scenario_id)


@router.get("/records/{kb_id}", response_model=KbRecordResponse)
def get_record(kb_id: str, request: Request):
    kb = require_kb(request)
    rec = kb.get(kb_id)
    collection = kb.collection_of(kb_id)
    if rec is None:
        # nested scenario items (readiness gates, unknowns) are addressable too
        for sc in kb.scenarios.values():
            for key in ("readiness_gate", "unknowns"):
                for item in sc.get(key) or []:
                    if isinstance(item, dict) and item.get("id") == kb_id:
                        rec, collection = dict(item, scenario_id=sc["id"]), f"{SCENARIO_COLLECTION}.{key}"
                        if not rec.get("source_ids"):
                            rec["source_ids"] = list(sc.get("source_ids") or [])
    if rec is None:
        raise AppError(404, "KB_RECORD_NOT_FOUND", f"No knowledge base record with id '{kb_id}'.")
    srcs = kb.sources
    ids = [kb_id] if collection == "sources" else [s for s in rec.get("source_ids") or [] if s in srcs]
    return {"record": rec, "collection": collection or "", "sources": [_source_view(srcs[s]) for s in ids if s in srcs]}


@router.get("/sources", response_model=SourcesResponse)
def list_sources(request: Request):
    kb = require_kb(request)
    return {"sources": [_source_view(r) for r in kb.records("sources")]}


@router.get("/stats", response_model=StatsResponse)
def stats(request: Request):
    kb = require_kb(request)
    return {"collections": kb.stats(), "kb_version": kb.version}
