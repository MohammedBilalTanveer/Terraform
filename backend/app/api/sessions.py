"""Session endpoints and helpers (POST/GET/PUT /api/sessions)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request

from ..deps import store_of
from ..errors import AppError
from ..schemas import SessionState, SessionUpdate
from ..services.store import Store

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
DEFAULT_SCENARIO = "scenario_05_lateritic_hardpan"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_session(store: Store, scenario_id: str = DEFAULT_SCENARIO) -> dict:
    ts = now_iso()
    s = {
        "session_id": "sess_" + uuid.uuid4().hex[:16],
        "scenario_id": scenario_id,
        "created_at": ts,
        "updated_at": ts,
        "observation": None,
        "analysis_id": None,
        "plan_id": None,
        "selected_crop_id": None,
        "completed_tasks": [],
        "accepted_risks": [],
        "check_outcomes": [],
        "journal": [],
        "current_step": "observation_log",
        "gate_results": {},
    }
    store.put("sessions", s["session_id"], s)
    return s


def get_or_create(store: Store, session_id: Optional[str], scenario_id: str) -> dict:
    if session_id:
        s = store.get("sessions", session_id)
        if s:
            return s
    return new_session(store, scenario_id)


def save(store: Store, session: dict, **changes) -> dict:
    session.update({k: v for k, v in changes.items()})
    session["updated_at"] = now_iso()
    store.put("sessions", session["session_id"], session)
    return session


def _require(store: Store, session_id: str) -> dict:
    s = store.get("sessions", session_id)
    if not s:
        raise AppError(404, "SESSION_NOT_FOUND", f"Session '{session_id}' was not found.")
    return s


@router.post("", response_model=SessionState)
def create_session(request: Request):
    return new_session(store_of(request))


@router.get("/{session_id}", response_model=SessionState)
def read_session(session_id: str, request: Request):
    return _require(store_of(request), session_id)


@router.put("/{session_id}", response_model=SessionState)
def update_session(session_id: str, body: SessionUpdate, request: Request):
    store = store_of(request)
    s = _require(store, session_id)
    changes = {}
    for name in body.model_fields_set:
        value = getattr(body, name)
        if hasattr(value, "model_dump"):
            value = value.model_dump()
        elif isinstance(value, list):
            value = [v.model_dump() if hasattr(v, "model_dump") else v for v in value]
        if value is None and name in ("completed_tasks", "accepted_risks", "check_outcomes", "journal"):
            value = []
        if value is None and name == "gate_results":
            value = {}
        if value is None and name == "current_step":
            continue
        changes[name] = value
    return save(store, s, **changes)
