"""Shared request helpers: access to app state (KB, store, settings) and common lookups."""
from __future__ import annotations

from fastapi import Request

from .config import Settings
from .errors import AppError
from .services.kb_loader import KnowledgeBase
from .services.store import Store


def kb_of(request: Request) -> KnowledgeBase:
    return request.app.state.kb


def store_of(request: Request) -> Store:
    return request.app.state.store


def settings_of(request: Request) -> Settings:
    return request.app.state.settings


def require_kb(request: Request) -> KnowledgeBase:
    kb = kb_of(request)
    if not kb.loaded:
        detail = "; ".join(kb.errors[:3]) or "no records"
        raise AppError(503, "KB_NOT_LOADED", f"The knowledge base could not be loaded: {detail}", retryable=True)
    return kb


def require_scenario(kb: KnowledgeBase, scenario_id: str) -> dict:
    sc = kb.scenario(scenario_id)
    if sc is None:
        for rec in kb.records("scenario_catalog"):
            if rec.get("id") == scenario_id and rec.get("status") != "available":
                raise AppError(404, "SCENARIO_NOT_AVAILABLE",
                               f"Scenario '{scenario_id}' is planned but not available yet.")
        raise AppError(404, "SCENARIO_NOT_FOUND", f"Scenario '{scenario_id}' was not found in the knowledge base.")
    return sc
