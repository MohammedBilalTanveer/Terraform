"""Shared fixtures. Every behavioural test runs twice: against the small fixture KB in
tests/fixtures/kb and against the real ../knowledge_base (skipped if that KB is not complete yet).
Set KB_DIRECTORY to point the "real" run at another KB directory."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import REPO_DIR, get_settings
from app.main import create_app
from app.services.kb_loader import REQUIRED_COLLECTIONS, load_kb

FIXTURE_KB = Path(__file__).parent / "fixtures" / "kb"
REAL_KB = Path(os.environ.get("KB_DIRECTORY") or (REPO_DIR / "knowledge_base"))
if not REAL_KB.is_absolute():
    REAL_KB = (Path(__file__).resolve().parents[2] / REAL_KB).resolve()
SCENARIO = "scenario_05_lateritic_hardpan"


def _real_kb_ready() -> bool:
    if not REAL_KB.exists():
        return False
    kb = load_kb(REAL_KB)
    return all(c in kb.collections for c in REQUIRED_COLLECTIONS) and kb.scenario(SCENARIO) is not None


@pytest.fixture(params=["fixture", "real"], scope="session")
def kb_dir(request) -> Path:
    if request.param == "real":
        if not _real_kb_ready():
            pytest.skip(f"real KB at {REAL_KB} is not complete yet")
        return REAL_KB
    return FIXTURE_KB


@pytest.fixture(scope="session")
def kb(kb_dir):
    return load_kb(kb_dir)


@pytest.fixture
def client(kb_dir, tmp_path) -> TestClient:
    settings = get_settings(kb_directory=kb_dir, data_directory=tmp_path / "data",
                            upload_directory=tmp_path / "uploads", enable_llm_rewrite=False,
                            enable_vision=False, openai_api_key="")  # tests never call OpenAI, even if .env has a key
    return TestClient(create_app(settings))


def analyze(client, observation, **extra):
    r = client.post("/api/observations/analyze", json={"scenario_id": SCENARIO, "observation": observation, **extra})
    assert r.status_code == 200, r.text
    return r.json()


def plan(client, observation, **extra):
    r = client.post("/api/plans/generate", json={"scenario_id": SCENARIO, "observation": observation, **extra})
    assert r.status_code == 200, r.text
    return r.json()


def all_kb_ids(obj, out=None):
    """Every id listed in any evidence object or adaptation kb_ids, recursively."""
    if out is None:
        out = set()
    if isinstance(obj, dict):
        ev = obj.get("evidence")
        if isinstance(ev, dict):
            out.update(ev.get("kb_ids", []))
        if "kb_ids" in obj and isinstance(obj["kb_ids"], list):
            out.update(obj["kb_ids"])
        for v in obj.values():
            all_kb_ids(v, out)
    elif isinstance(obj, list):
        for v in obj:
            all_kb_ids(v, out)
    return out


def all_source_ids(obj, out=None):
    if out is None:
        out = set()
    if isinstance(obj, dict):
        ev = obj.get("evidence")
        if isinstance(ev, dict):
            out.update(ev.get("source_ids", []))
        for v in obj.values():
            all_source_ids(v, out)
    elif isinstance(obj, list):
        for v in obj:
            all_source_ids(v, out)
    return out


def fix_records(p):
    fp = p["workflow"]["fix_protocol"]
    return fp["do_first"] + fp["do_next"] + fp["avoid"] + fp["optional"]


def fix_ids(p):
    return {r["id"] for r in fix_records(p)}
