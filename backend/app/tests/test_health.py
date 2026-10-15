from .conftest import FIXTURE_KB, SCENARIO


def test_health_reports_kb_state(client, kb):
    r = client.get("/api/health")
    assert r.status_code == 200
    h = r.json()
    assert h["status"] == "ok"
    assert h["kb_loaded"] is True
    assert h["kb_only_mode"] is True
    assert h["kb_record_count"] == kb.record_count > 0
    assert h["kb_version"] == kb.version
    assert h["llm_enabled"] is False
    assert h["generation_mode_default"] == "deterministic"
    assert isinstance(h["kb_errors"], list)


def test_fixture_kb_has_no_errors(tmp_path):
    from app.services.kb_loader import load_kb
    kb = load_kb(FIXTURE_KB)
    assert kb.errors == []


def test_knowledge_endpoints(client, kb):
    sc = client.get("/api/knowledge/scenarios").json()["scenarios"]
    assert any(s["id"] == SCENARIO and s["status"] == "available" for s in sc)
    assert client.get(f"/api/knowledge/scenarios/{SCENARIO}").json()["id"] == SCENARIO
    rec_id = kb.records("soil_treatments")[0]["id"]
    body = client.get(f"/api/knowledge/records/{rec_id}").json()
    assert body["record"]["id"] == rec_id and body["collection"] == "soil_treatments"
    assert {s["id"] for s in body["sources"]} <= set(kb.sources)
    stats = client.get("/api/knowledge/stats").json()
    assert stats["collections"]["soil_treatments"] == len(kb.records("soil_treatments"))
    assert len(client.get("/api/knowledge/sources").json()["sources"]) == len(kb.records("sources"))


def test_error_shape_for_missing_record(client):
    r = client.get("/api/knowledge/records/treat_does_not_exist")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "KB_RECORD_NOT_FOUND",
                                  "message": "No knowledge base record with id 'treat_does_not_exist'.",
                                  "retryable": False}}


def test_validation_error_shape(client):
    r = client.post("/api/observations/analyze", json={"scenario_id": SCENARIO})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_unknown_scenario(client):
    r = client.post("/api/observations/analyze", json={"scenario_id": "scenario_99_nope", "observation": {"description": "x"}})
    assert r.status_code == 404 and r.json()["error"]["code"] == "SCENARIO_NOT_FOUND"
