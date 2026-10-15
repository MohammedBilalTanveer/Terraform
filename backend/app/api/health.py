"""GET /api/health"""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..deps import kb_of, settings_of
from ..schemas import HealthResponse
from ..services.llm_rewriter import llm_available
from ..services.vision import vision_available

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(request: Request):
    kb = kb_of(request)
    llm = llm_available(settings_of(request))
    return {
        "status": "ok",
        "kb_loaded": kb.loaded,
        "kb_version": kb.version,
        "kb_record_count": kb.record_count,
        "kb_errors": list(kb.errors),
        "llm_enabled": llm,
        "generation_mode_default": "llm_rewrite" if llm else "deterministic",
        "kb_only_mode": True,
        "vision_enabled": vision_available(settings_of(request)),
    }
