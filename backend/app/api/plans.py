"""Plan endpoints: POST /api/plans/generate, GET /api/plans/{id}, PATCH /api/plans/{id}/progress."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, Request

from ..deps import require_kb, require_scenario, settings_of, store_of
from ..errors import AppError
from ..schemas import ObservationInput, PlanRequest, PlanResponse, ProgressRequest, ProgressResponse
from ..services import llm_rewriter
from ..services.planner import LOCK_MESSAGES, build_plan, gate_task_done, lock_state, task_phase
from ..services.tagging import derive_tags
from .observations import prepare_observation
from .sessions import get_or_create, now_iso, save

router = APIRouter(prefix="/api/plans", tags=["plans"])


def _assemble(request: Request, *, plan_id: str, created_at: str, session: dict, scenario: dict,
              observation: dict, selected_crop_id: Optional[str], completed: List[str], accepted: List[str],
              gate_results: Optional[Dict[str, str]] = None, previous: Optional[dict] = None) -> dict:
    kb = require_kb(request)
    settings = settings_of(request)
    obs = prepare_observation(request, session, ObservationInput(**observation))
    tr = derive_tags(kb, obs)
    body = build_plan(kb, scenario, tr, obs, selected_crop_id, completed, accepted, gate_results or {})
    if previous is not None:
        # progress updates do not change the observation: keep the earlier (possibly re-worded) summary
        used = bool(previous.get("meta", {}).get("llm_used"))
        body["situation_summary"] = previous.get("situation_summary") or body["situation_summary"]
    else:
        facts = [t["label"] for t in tr.tags]
        new_summary, used = llm_rewriter.rewrite(settings, kb, body["situation_summary"], facts)
        body["situation_summary"] = new_summary
    plan = {
        "plan_id": plan_id,
        "session_id": session["session_id"],
        "scenario_id": scenario["id"],
        "status": "draft",
        "meta": {"plan_id": plan_id, "session_id": session["session_id"],
                 "generation_mode": "llm_rewrite" if used else "deterministic", "llm_used": used,
                 "created_at": created_at, "kb_version": kb.version},
        **body,
        "_inputs": {"observation": observation, "selected_crop_id": selected_crop_id,
                    "completed_tasks": completed, "accepted_risks": accepted,
                    "gate_results": dict(gate_results or {})},
    }
    return plan


def _dedupe(items) -> List[str]:
    return [x for x in dict.fromkeys(i for i in items or [] if isinstance(i, str) and i)]


@router.post("/generate", response_model=PlanResponse)
def generate_plan(body: PlanRequest, request: Request):
    kb = require_kb(request)
    scenario = require_scenario(kb, body.scenario_id)
    store = store_of(request)
    session = get_or_create(store, body.session_id, body.scenario_id)
    completed = _dedupe(body.completed_tasks or session.get("completed_tasks"))
    accepted = _dedupe(body.accepted_risks or session.get("accepted_risks"))
    gate_results = dict(body.gate_results if body.gate_results is not None else (session.get("gate_results") or {}))
    selected = body.selected_crop_id if "selected_crop_id" in body.model_fields_set else session.get("selected_crop_id")
    plan_id = "plan_" + uuid.uuid4().hex[:16]
    observation = body.observation.model_dump()
    plan = _assemble(request, plan_id=plan_id, created_at=now_iso(), session=session, scenario=scenario,
                     observation=observation, selected_crop_id=selected, completed=completed, accepted=accepted,
                     gate_results=gate_results)
    store.put("plans", plan_id, plan)
    save(store, session, plan_id=plan_id, observation=observation, completed_tasks=completed,
         accepted_risks=accepted, selected_crop_id=selected, scenario_id=scenario["id"], gate_results=gate_results)
    return plan


def _load(request: Request, plan_id: str) -> dict:
    plan = store_of(request).get("plans", plan_id)
    if not plan:
        raise AppError(404, "PLAN_NOT_FOUND", f"Plan '{plan_id}' was not found.")
    return plan


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: str, request: Request):
    return _load(request, plan_id)


@router.patch("/{plan_id}/progress", response_model=ProgressResponse)
def update_progress(plan_id: str, body: ProgressRequest, request: Request):
    kb = require_kb(request)
    store = store_of(request)
    plan = _load(request, plan_id)
    scenario = require_scenario(kb, plan["scenario_id"])
    inputs = plan.get("_inputs") or {}
    completed = list(inputs.get("completed_tasks") or [])
    accepted = list(inputs.get("accepted_risks") or [])
    gate_results = dict(inputs.get("gate_results") or {})
    selected = inputs.get("selected_crop_id")

    complete_task = None
    if body.task_id:
        if body.task_id not in kb.task_ids:
            raise AppError(404, "TASK_NOT_FOUND", f"Task '{body.task_id}' is not defined in the knowledge base.")
        if body.completed is False:
            completed = [t for t in completed if t != body.task_id]
            # un-ticking a gate's last done task drops any accepted risk on that gate
            for g in scenario.get("readiness_gate") or []:
                if isinstance(g, dict) and g.get("id") in accepted and not gate_task_done(g, completed):
                    accepted = [a for a in accepted if a != g.get("id")]
        elif body.task_id not in completed:
            complete_task = body.task_id
    gate_ids = {g.get("id") for g in scenario.get("readiness_gate") or [] if isinstance(g, dict)}
    if body.gate_result is not None:
        gid = body.gate_result.gate_id
        if gid not in gate_ids:
            raise AppError(404, "GATE_NOT_FOUND", f"Readiness item '{gid}' does not exist.")
        if body.gate_result.result is None:
            gate_results.pop(gid, None)
        else:
            gate_results[gid] = body.gate_result.result
    if "selected_crop_id" in body.model_fields_set:
        if body.selected_crop_id is not None and kb.collection_of(body.selected_crop_id) != "crop_profiles":
            raise AppError(404, "CROP_NOT_FOUND", f"Crop '{body.selected_crop_id}' is not in the knowledge base.")
        selected = body.selected_crop_id
    session = get_or_create(store, plan["session_id"], plan["scenario_id"])
    if complete_task:
        # v1.4: plant-phase tasks are locked until a crop is chosen and the readiness gate has passed
        trial = _assemble(request, plan_id=plan_id, created_at=plan["meta"]["created_at"], session=session,
                          scenario=scenario, observation=inputs.get("observation") or {"description": ""},
                          selected_crop_id=selected, completed=completed, accepted=accepted,
                          gate_results=gate_results, previous=plan)
        sel_ok = bool(selected) and kb.collection_of(selected) == "crop_profiles"
        locked, reason = lock_state(task_phase(kb, complete_task), trial["workflow"]["next_action"]["planting_readiness"],
                                    sel_ok)
        if locked:
            raise AppError(409, "TASK_LOCKED", LOCK_MESSAGES[reason])
        completed.append(complete_task)
    if body.accept_risk_gate_id:
        if body.accept_risk_gate_id not in gate_ids:
            raise AppError(404, "GATE_NOT_FOUND", f"Readiness item '{body.accept_risk_gate_id}' does not exist.")
        gate = next(g for g in scenario.get("readiness_gate") or []
                    if isinstance(g, dict) and g.get("id") == body.accept_risk_gate_id)
        if not gate_task_done(gate, completed):
            raise AppError(409, "TASK_NOT_DONE", "Complete the task first — accepting a risk only skips the test.")
        if body.accept_risk_gate_id not in accepted:
            accepted.append(body.accept_risk_gate_id)

    new_plan = _assemble(request, plan_id=plan_id, created_at=plan["meta"]["created_at"], session=session,
                         scenario=scenario, observation=inputs.get("observation") or {"description": ""},
                         selected_crop_id=selected, completed=completed, accepted=accepted,
                         gate_results=gate_results, previous=plan)
    store.put("plans", plan_id, new_plan)
    save(store, session, plan_id=plan_id, completed_tasks=completed, accepted_risks=accepted,
         selected_crop_id=selected, gate_results=gate_results)
    na = new_plan["workflow"]["next_action"]
    return {
        "plan_id": plan_id,
        "completed_tasks": completed,
        "accepted_risks": accepted,
        "readiness_gate": na["readiness_gate"],
        "planting_readiness": na["planting_readiness"],
        "steps_status": new_plan["steps_status"],
        "gate_results": gate_results,
    }
