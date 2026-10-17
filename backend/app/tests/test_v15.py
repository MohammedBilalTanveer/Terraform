"""v1.5: diagnostic checks as real steps (phase / where), plan.workflow.checks, outcomes feed tags only."""
import json
import shutil

import pytest

from app.services.kb_loader import load_kb
from app.services.retrieval import applies

from .conftest import FIXTURE_KB, analyze, plan
from .test_scenario_variations import FLAT_POOLING, STANDARD, assert_ids_valid

PHASE_ORDER = {"diagnose": 0, "pre_plant": 1, "post_sow": 2}
WHERE = {"ground", "water_hole", "runoff_path", "vegetation", "neighbours", "supplies", "seeds", "trial_plot"}
LAYERS = ("do_first", "do_next", "avoid", "optional")


def _by_id(cards):
    return {c["id"]: c for c in cards}


def _fix_ids(p):
    return {r["id"] for k in LAYERS for r in p["workflow"]["fix_protocol"][k]}


def _gates(p):
    return [(g["id"], g["required"], g["satisfied"]) for g in p["workflow"]["next_action"]["readiness_gate"]]


def _scores(p):
    cs = p["workflow"]["crop_suggestions"]
    return [(c["crop_id"], c["score"], c["fit_label"]) for k in ("field_crops", "tree_options", "excluded") for c in cs[k]]


def test_every_applicable_check_in_plan_ordered_by_phase(client, kb):
    for obs in ({"description": STANDARD}, {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}):
        p = plan(client, obs)  # generated WITHOUT a prior analysis
        checks = p["workflow"]["checks"]
        tags = {t["tag"] for t in p["derived_tags"]}
        expected = [r["id"] for r in kb.records("diagnostic_checks") if applies(r, tags)]
        assert sorted(c["id"] for c in checks) == sorted(expected)
        assert len({c["id"] for c in checks}) == len(checks), "deduped"
        order = [PHASE_ORDER.get(c["phase"], 3) for c in checks]
        assert order == sorted(order), "diagnose -> pre_plant -> post_sow"
        for phase in PHASE_ORDER:  # KB order kept within a phase
            kb_order = [i for i in expected if kb.get(i).get("phase") == phase]
            assert [c["id"] for c in checks if c["phase"] == phase] == kb_order
        for c in checks:
            rec = kb.get(c["id"])
            assert c["phase"] == rec.get("phase") and c["where"] == rec.get("where")
            if c["where"]:
                assert c["where"] in WHERE
            assert c["purpose"] and c["possible_outcomes"] and c["user_outcome"] is None
            assert c["weak_evidence"] == bool(rec.get("weak_evidence"))
            assert c["gate_relevant"] == bool(rec.get("gate_relevant"))
            assert c["evidence"]["kb_ids"][0] == c["id"]
        assert_ids_valid(kb, p)


def test_kb_checks_carry_valid_where(kb):
    for r in kb.records("diagnostic_checks"):
        if r.get("where") is not None:
            assert r["where"] in WHERE, r["id"]
        if r.get("phase") is not None:
            assert r["phase"] in PHASE_ORDER, r["id"]


def test_analysis_checks_carry_phase_and_where(client, kb):
    a = analyze(client, {"description": STANDARD})
    assert a["missing_analysis"]["checks"]
    for c in a["missing_analysis"]["checks"]:
        rec = kb.get(c["id"])
        assert c["phase"] == rec.get("phase") and c["where"] == rec.get("where")


def test_user_outcome_merged_into_plan_checks(client, kb):
    chk = next(c for c in kb.records("diagnostic_checks") if len(c.get("possible_outcomes") or []) >= 2)
    out = chk["possible_outcomes"][0]["outcome_id"]
    p = plan(client, {"description": STANDARD, "user_confirmed_checks": [{"check_id": chk["id"], "outcome_id": out}]})
    cards = _by_id(p["workflow"]["checks"])
    assert cards[chk["id"]]["user_outcome"] == out
    assert all(c["user_outcome"] is None for i, c in cards.items() if i != chk["id"])


def test_probe_outcome_flips_hardpan_and_reshapes_plan(client, kb):
    base = plan(client, {"description": STANDARD})
    assert "hardpan_continuous" not in {t["tag"] for t in base["derived_tags"]}
    probe = "check_probe_multiple_spots"
    outcome = [{"check_id": probe, "outcome_id": "resistance_everywhere"}]
    p = plan(client, {"description": STANDARD, "user_confirmed_checks": outcome})
    tags = {t["tag"]: t for t in p["derived_tags"]}
    assert tags["hardpan_continuous"]["source"] == "check" and "hardpan_unknown" not in tags
    assert _fix_ids(p) != _fix_ids(base)
    assert not [r for r in p["workflow"]["fix_protocol"]["do_first"] if r["task_id"] == "task_build_pits"]
    assert _by_id(p["workflow"]["checks"])[probe]["user_outcome"] == "resistance_everywhere"
    a = analyze(client, {"description": STANDARD, "user_confirmed_checks": outcome})
    assert "hardpan_continuous" in {t["tag"] for t in a["derived_tags"]}


def test_fizz_outcomes_are_tags_only(client, kb):
    if not kb.get("check_baking_soda_fizz"):
        pytest.skip("no fizz check")
    base = plan(client, {"description": STANDARD})
    for outcome in ("fizz_seen", "fizz_none"):
        p = plan(client, {"description": STANDARD,
                          "user_confirmed_checks": [{"check_id": "check_baking_soda_fizz", "outcome_id": outcome}]})
        tags = {t["tag"]: t for t in p["derived_tags"]}
        assert outcome in tags and tags[outcome]["source"] == "check"
        assert _gates(p) == _gates(base), "fizz never changes gates"
        assert _scores(p) == _scores(base), "fizz never changes crop scores"
        assert p["workflow"]["next_action"]["planting_readiness"] == base["workflow"]["next_action"]["planting_readiness"]
    chk = _by_id(p["workflow"]["checks"])["check_baking_soda_fizz"]
    assert chk["weak_evidence"] is True and chk["gate_relevant"] is False


def test_drainage_outcome_becomes_tag(client, kb):
    if not kb.get("check_water_hole_drainage"):
        pytest.skip("no drainage check")
    p = plan(client, {"description": STANDARD,
                      "user_confirmed_checks": [{"check_id": "check_water_hole_drainage", "outcome_id": "drains_slow"}]})
    assert "drains_slow" in {t["tag"] for t in p["derived_tags"]}


@pytest.mark.parametrize("question,check_id", [
    ("how do I do the baking soda test", "check_baking_soda_fizz"),
    ("what does it mean if the soil fizzes", "check_baking_soda_fizz"),
    ("water hole drainage test", "check_water_hole_drainage"),
])
def test_assistant_finds_checks(client, kb, question, check_id):
    if not kb.get(check_id):
        pytest.skip(f"{check_id} not in KB")
    r = client.post("/api/assistant/ask", json={"question": question}).json()
    assert r["refused"] is False
    assert check_id in [m["kb_id"] for m in r["matched"]], [m["kb_id"] for m in r["matched"]]


def test_assistant_sodium_question(client, kb):
    rec = kb.get("check_baking_soda_fizz")
    if not rec or "sodium" not in json.dumps(rec).lower():
        pytest.skip("KB fizz check does not mention sodium")
    r = client.post("/api/assistant/ask", json={"question": "sodium bicarbonate test"}).json()
    assert not r["refused"] and "check_baking_soda_fizz" in [m["kb_id"] for m in r["matched"]]


def test_loader_validates_check_phase_and_where(tmp_path):
    kbdir = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, kbdir)
    d = json.loads((kbdir / "diagnostic_checks.json").read_text(encoding="utf-8"))
    d["records"][0]["phase"] = "someday"
    d["records"][1]["where"] = "the moon"
    (kbdir / "diagnostic_checks.json").write_text(json.dumps(d), encoding="utf-8")
    errs = "\n".join(load_kb(kbdir).errors)
    assert "invalid check phase 'someday'" in errs and "invalid check 'where' 'the moon'" in errs


def test_old_kb_without_phase_where_leaves_null(tmp_path):
    from fastapi.testclient import TestClient
    from app.config import get_settings
    from app.main import create_app
    kbdir = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, kbdir)
    d = json.loads((kbdir / "diagnostic_checks.json").read_text(encoding="utf-8"))
    for r in d["records"]:
        r.pop("phase", None)
        r.pop("where", None)
    (kbdir / "diagnostic_checks.json").write_text(json.dumps(d), encoding="utf-8")
    assert load_kb(kbdir).errors == []
    c = TestClient(create_app(get_settings(kb_directory=kbdir, data_directory=tmp_path / "d",
                                           upload_directory=tmp_path / "u", enable_llm_rewrite=False,
                                           enable_vision=False, openai_api_key="")))
    p = plan(c, {"description": STANDARD})
    assert p["workflow"]["checks"] and all(x["phase"] is None and x["where"] is None for x in p["workflow"]["checks"])
