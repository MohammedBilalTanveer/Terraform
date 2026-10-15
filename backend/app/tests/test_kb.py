import json
import shutil

from app.services.kb_loader import REQUIRED_COLLECTIONS, load_kb

from .conftest import FIXTURE_KB, SCENARIO


def test_every_kb_file_parses_with_envelope(kb_dir):
    files = sorted(kb_dir.glob("*.json"))
    assert files
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        if "$schema" in data:
            continue  # the JSON Schema describing the KB files
        assert isinstance(data.get("records"), list), f.name
        assert isinstance(data.get("collection"), str), f.name


def test_required_collections_present(kb):
    for c in REQUIRED_COLLECTIONS:
        assert kb.records(c), f"collection {c} is empty or missing"
    assert kb.scenario(SCENARIO) is not None


def test_ids_unique_across_kb(kb_dir):
    seen = {}
    for f in sorted(kb_dir.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        if "$schema" in data or data.get("collection") == "scenario_catalog":
            continue  # catalog entries reuse their scenario id by design
        for r in data["records"]:
            assert r["id"] not in seen, f"{r['id']} in {f.name} and {seen.get(r['id'])}"
            seen[r["id"]] = f.name


def test_references_resolve(kb):
    assert kb.errors == [], "KB problems:\n" + "\n".join(kb.errors)


def test_records_have_common_fields(kb):
    for coll in ("soil_treatments", "diagnostic_checks", "crop_profiles", "planting_methods"):
        for r in kb.records(coll):
            for f in ("title", "summary", "applies_when", "source_ids", "evidence_level"):
                assert f in r, f"{r['id']} missing {f}"


def test_case_h_malformed_reference_reported(tmp_path):
    bad = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, bad)
    p = bad / "crop_profiles.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    data["records"][0]["pest_ids"].append("pest_does_not_exist")
    data["records"][0]["source_ids"].append("src_missing_source")
    p.write_text(json.dumps(data), encoding="utf-8")
    s = bad / "scenario_05_lateritic_hardpan.json"
    sd = json.loads(s.read_text(encoding="utf-8"))
    sd["records"][0]["readiness_gate"][0]["satisfied_by_tasks"].append("task_never_defined")
    s.write_text(json.dumps(sd), encoding="utf-8")
    t = bad / "soil_treatments.json"
    td = json.loads(t.read_text(encoding="utf-8"))
    td["records"].append(dict(td["records"][0]))  # duplicate id
    t.write_text(json.dumps(td), encoding="utf-8")

    kb = load_kb(bad)
    joined = "\n".join(kb.errors)
    assert "'pest_ids' references unknown id 'pest_does_not_exist'" in joined
    assert "'source_ids' references unknown id 'src_missing_source'" in joined
    assert "'satisfied_by_tasks' references unknown id 'task_never_defined'" in joined
    assert "duplicate id" in joined
    # never invents replacements: the broken reference is kept as written
    crop = kb.get(data["records"][0]["id"])
    assert "pest_does_not_exist" in crop["pest_ids"]


def test_case_h_invalid_json_reported(tmp_path):
    bad = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, bad)
    (bad / "regeneration.json").write_text('{"collection": "regeneration", "records": [ {"id": }', encoding="utf-8")
    kb = load_kb(bad)
    assert any(e.startswith("regeneration.json: invalid JSON at line") for e in kb.errors)
    assert any("missing required KB collection 'regeneration'" in e for e in kb.errors)


def test_health_surfaces_kb_errors(tmp_path):
    from fastapi.testclient import TestClient
    from app.config import get_settings
    from app.main import create_app
    bad = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, bad)
    p = bad / "crop_profiles.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    data["records"][0]["harvest_profile_id"] = "harvest_ghost"
    p.write_text(json.dumps(data), encoding="utf-8")
    app = create_app(get_settings(kb_directory=bad, data_directory=tmp_path / "d", upload_directory=tmp_path / "u",
                                  enable_llm_rewrite=False))
    h = TestClient(app).get("/api/health").json()
    assert any("harvest_ghost" in e for e in h["kb_errors"])
