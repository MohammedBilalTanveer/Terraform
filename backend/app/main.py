"""TERRAFORM backend — FastAPI app factory.

Run: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000   (from backend/)
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import assistant, health, knowledge, observations, plans, sessions, uploads
from .config import Settings, get_settings
from .errors import AppError, error_body
from .services.kb_loader import load_kb
from .services.store import Store

log = logging.getLogger("terraform")

HTTP_CODES = {400: "BAD_REQUEST", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 413: "FILE_TOO_LARGE",
              415: "UNSUPPORTED_MEDIA_TYPE", 422: "VALIDATION_ERROR"}


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="TERRAFORM backend", version="1.0.0",
                  description="Answers only from the local JSON knowledge base.")
    app.state.settings = settings
    app.state.kb = load_kb(settings.kb_directory)
    app.state.store = Store(settings.data_directory, persist=settings.persist)
    if app.state.kb.errors:
        log.warning("KB loaded with %d problem(s); see /api/health", len(app.state.kb.errors))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def _app_error(_req: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.retryable))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_req: Request, exc: StarletteHTTPException):
        code = HTTP_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
        msg = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=exc.status_code, content=error_body(code, msg, exc.status_code >= 500))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_req: Request, exc: RequestValidationError):
        parts = []
        for e in exc.errors()[:5]:
            loc = ".".join(str(x) for x in e.get("loc", []) if x != "body")
            parts.append(f"{loc}: {e.get('msg')}" if loc else str(e.get("msg")))
        return JSONResponse(status_code=422, content=error_body("VALIDATION_ERROR", "Invalid request: " + "; ".join(parts)))

    @app.exception_handler(Exception)
    async def _unhandled(_req: Request, exc: Exception):
        log.exception("unhandled error")
        return JSONResponse(status_code=500, content=error_body(
            "INTERNAL_ERROR", f"Unexpected server error ({exc.__class__.__name__}).", True))

    for r in (health, knowledge, sessions, uploads, observations, plans, assistant):
        app.include_router(r.router)
    return app


app = create_app()
