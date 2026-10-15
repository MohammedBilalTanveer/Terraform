"""Runtime settings, read from environment variables and an optional `.env` file.

Relative paths are resolved against the `backend/` directory so the server behaves the same
no matter which working directory it is started from.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # python-dotenv is optional at import time
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None  # type: ignore

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

if load_dotenv is not None:
    # backend/.env first, then repo-root .env (neither overrides real environment variables)
    load_dotenv(BACKEND_DIR / ".env", override=False)
    load_dotenv(REPO_DIR / ".env", override=False)


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _path(value: str | None, default: Path) -> Path:
    if not value:
        return default.resolve()
    p = Path(value)
    if not p.is_absolute():
        p = BACKEND_DIR / p
    return p.resolve()


@dataclass
class Settings:
    openai_api_key: str = ""
    openai_model: str = ""
    enable_llm_rewrite: bool = False
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    frontend_origin: str = "http://localhost:5173"  # may be a comma-separated list of origins
    cors_origin_regex: str = ""  # optional, e.g. ^https://terraform-web(-[a-z0-9]+)?\.onrender\.com$
    kb_directory: Path = field(default_factory=lambda: (REPO_DIR / "knowledge_base").resolve())
    upload_directory: Path = field(default_factory=lambda: (BACKEND_DIR / "uploads").resolve())
    data_directory: Path = field(default_factory=lambda: (BACKEND_DIR / "data").resolve())
    max_upload_bytes: int = 8 * 1024 * 1024
    llm_timeout_seconds: float = 8.0
    enable_vision: bool = False
    openai_vision_model: str = ""
    vision_timeout_seconds: float = 20.0
    persist: bool = True

    @property
    def llm_configured(self) -> bool:
        return bool(self.enable_llm_rewrite and self.openai_api_key and self.openai_model)

    @property
    def vision_configured(self) -> bool:
        return bool(self.enable_vision and self.openai_api_key and self.openai_vision_model)

    @property
    def cors_origins(self) -> list[str]:
        origins = [*(self.frontend_origin or "").split(","), "http://127.0.0.1:5173", "http://localhost:5173"]
        out: list[str] = []
        for o in origins:
            o = (o or "").strip().rstrip("/")
            if o and o not in out:
                out.append(o)
        return out


def get_settings(**overrides) -> Settings:
    env = os.environ
    try:
        port = int(env.get("BACKEND_PORT", "8000"))
    except ValueError:
        port = 8000
    s = Settings(
        openai_api_key=env.get("OPENAI_API_KEY", "").strip(),
        openai_model=env.get("OPENAI_MODEL", "").strip(),
        enable_llm_rewrite=_bool(env.get("ENABLE_LLM_REWRITE"), False),
        enable_vision=_bool(env.get("ENABLE_VISION"), False),
        openai_vision_model=env.get("OPENAI_VISION_MODEL", "").strip(),
        backend_host=env.get("BACKEND_HOST", "127.0.0.1"),
        backend_port=port,
        frontend_origin=env.get("FRONTEND_ORIGIN", "http://localhost:5173"),
        cors_origin_regex=env.get("CORS_ORIGIN_REGEX", "").strip(),
        kb_directory=_path(env.get("KB_DIRECTORY"), REPO_DIR / "knowledge_base"),
        upload_directory=_path(env.get("UPLOAD_DIRECTORY"), BACKEND_DIR / "uploads"),
        data_directory=_path(env.get("DATA_DIRECTORY"), BACKEND_DIR / "data"),
    )
    for k, v in overrides.items():
        if k in {"kb_directory", "upload_directory", "data_directory"} and v is not None:
            v = Path(v).resolve()
        setattr(s, k, v)
    return s
