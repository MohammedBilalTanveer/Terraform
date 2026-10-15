"""POST /api/observations/analyze"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from ..deps import require_kb, require_scenario, settings_of, store_of
from ..schemas import AnalysisResponse, AnalyzeRequest
from ..services import llm_rewriter
from ..services.evidence import collect_all, merge_evidence
from ..services.reasoning import analyze
from ..services.tagging import derive_tags
from .sessions import get_or_create, now_iso, save
from .uploads import find_photo

router = APIRouter(prefix="/api/observations", tags=["observations"])


def prepare_observation(request: Request, session: dict, observation) -> dict:
    """Observation dict with session check outcomes merged in and unknown photo ids dropped."""
    obs = observation.model_dump() if hasattr(observation, "model_dump") else dict(observation or {})
    confirmed = {c["check_id"]: c for c in obs.get("user_confirmed_checks") or []}
    for c in session.get("check_outcomes") or []:
        if c.get("check_id") and c["check_id"] not in confirmed:
            confirmed[c["check_id"]] = {"check_id": c["check_id"], "outcome_id": c.get("outcome_id")}
    obs["user_confirmed_checks"] = list(confirmed.values())
    if obs.get("photo_id") and find_photo(settings_of(request).upload_directory, obs["photo_id"]) is None:
        obs["photo_id"] = None
    return obs


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_observation(body: AnalyzeRequest, request: Request):
    kb = require_kb(request)
    scenario = require_scenario(kb, body.scenario_id)
    store = store_of(request)
    settings = settings_of(request)
    session = get_or_create(store, body.session_id, body.scenario_id)
    obs = prepare_observation(request, session, body.observation)

    tr = derive_tags(kb, obs)
    result = analyze(kb, scenario, tr, obs)

    summary = result["steps"]["input_echo"]["summary"]
    facts = [t["label"] for t in tr.tags]
    new_summary, used = llm_rewriter.rewrite(settings, kb, summary, facts)
    result["steps"]["input_echo"]["summary"] = new_summary

    analysis_id = "ana_" + uuid.uuid4().hex[:16]
    response = {
        "analysis_id": analysis_id,
        "session_id": session["session_id"],
        "scenario_id": scenario["id"],
        "meta": {"generation_mode": "llm_rewrite" if used else "deterministic", "llm_used": used,
                 "kb_version": kb.version, "created_at": now_iso()},
        **result,
    }
    response["evidence"] = merge_evidence(collect_all(result))
    store.put("analyses", analysis_id, response)
    save(store, session, observation=body.observation.model_dump(), analysis_id=analysis_id,
         scenario_id=scenario["id"])
    return response
