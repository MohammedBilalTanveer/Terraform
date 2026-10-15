"""v1.1 rubric additions: empirical gate tests, failure factors, dual timeline, irrigation, stress mitigation,
photo cue suggestions. Runs on the fixture KB and the real KB."""
import io

import pytest

from app.config import get_settings
from app.services import vision

from .conftest import SCENARIO, analyze, plan
from .test_scenario_variations import FLAT_POOLING, STANDARD, _png_bytes, assert_ids_valid


def _gate(p, gid):
    return next(g for g in p["readiness_gate"] if g["id"] == gid)


def _verified_gate(kb, p):
    gates = [g for g in p["workflow"]["next_action"]["readiness_gate"] if g["verification"] and g["required"]]
    if not gates:
        pytest.skip("KB has no readiness gate with a verification test yet")
    return gates[0]


def test_gate_verification_pass_fail(client, kb):
    p = plan(client, {"description": STANDARD})
    pid, sid = p["plan_id"], p["session_id"]
    g = _verified_gate(kb, p)
    assert set(g["verification"]) == {"test", "pass", "fail", "if_fail"}
    assert g["task_done"] is False and g["test_result"] is None and g["satisfied"] is False
    task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)

    r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": task}).json()
    gi = _gate(r, g["id"])
    assert gi["task_done"] is True and gi["satisfied"] is False, "task alone does not satisfy a tested gate"
    full = client.get(f"/api/plans/{pid}").json()
    assert any("Test pending" in w for w in full["workflow"]["next_action"]["warnings"])

    r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "fail"}}).json()
    gi = _gate(r, g["id"])
    assert gi["test_result"] == "fail" and gi["satisfied"] is False
    assert r["gate_results"] == {g["id"]: "fail"}
    full = client.get(f"/api/plans/{pid}").json()
    assert any(g["verification"]["if_fail"] in w for w in full["workflow"]["next_action"]["warnings"])
    assert g["label"] in full["workflow"]["next_action"]["blocked_until"]
    assert client.get(f"/api/sessions/{sid}").json()["gate_results"] == {g["id"]: "fail"}

    r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "pass"}}).json()
    assert _gate(r, g["id"])["satisfied"] is True and r["gate_results"][g["id"]] == "pass"

    r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": None}}).json()
    assert _gate(r, g["id"])["satisfied"] is False and g["id"] not in r["gate_results"]

    # a failed test can still be carried forward as an accepted risk
    client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "fail"}})
    r = client.patch(f"/api/plans/{pid}/progress", json={"accept_risk_gate_id": g["id"]}).json()
    assert _gate(r, g["id"])["accepted_risk"] is True
    assert client.patch(f"/api/plans/{pid}/progress",
                        json={"gate_result": {"gate_id": "gate_nope", "result": "pass"}}).status_code == 404


def test_generate_accepts_gate_results(client, kb):
    p = plan(client, {"description": STANDARD})
    g = _verified_gate(kb, p)
    task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)
    p2 = plan(client, {"description": STANDARD}, completed_tasks=[task], gate_results={g["id"]: "pass"})
    gi = next(x for x in p2["workflow"]["next_action"]["readiness_gate"] if x["id"] == g["id"])
    assert gi["satisfied"] is True and gi["test_result"] == "pass"
    unverified = [x for x in p2["workflow"]["next_action"]["readiness_gate"] if x["verification"] is None]
    for x in unverified:
        assert x["satisfied"] == x["task_done"]


def _expected_status(f, tags):
    direct = [t for t in f.get("triggered_by_tags") or [] if not t.endswith("_unknown")]
    indirect = [t for t in f.get("indirect_tags") or [] if not t.endswith("_unknown")]
    if set(direct) & tags:
        return "observed"
    if set(indirect) & tags or f.get("always_likely"):
        return "likely"
    return "not_indicated"


def test_failure_factors(client, kb):
    sc = kb.scenario(SCENARIO)
    if not sc.get("failure_factors"):
        pytest.skip("KB has no failure_factors yet")
    for obs in ({"description": STANDARD}, {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}):
        a = analyze(client, obs)
        tags = {t["tag"] for t in a["derived_tags"]}
        ff = a["missing_analysis"]["failure_factors"]
        assert len(ff) == len(sc["failure_factors"])
        order = {"observed": 0, "likely": 1, "not_indicated": 2}
        assert [order[f["status"]] for f in ff] == sorted(order[f["status"]] for f in ff)
        labels = {t["label"] for t in a["derived_tags"]}
        kbf = {f["id"]: f for f in sc["failure_factors"]}
        for f in ff:
            assert f["status"] == _expected_status(kbf[f["id"]], tags), f["id"]
            assert set(f["triggered_by"]) <= labels and set(f["clues"]) <= labels
            assert (f["status"] == "observed") == bool(f["triggered_by"])
            assert not any(l.endswith("not reported") or "not yet known" in l or "not estimated" in l
                           for l in f["triggered_by"] + f["clues"]), "unknown tags never count as evidence"
            assert all(kb.has(x) for x in f["addressed_by"])
            assert f["evidence"]["kb_ids"][0] == SCENARIO
        assert_ids_valid(kb, a)


def test_failure_factor_honesty_cases(client, kb):
    sc = kb.scenario(SCENARIO)
    ids = {f["id"] for f in sc.get("failure_factors") or []}
    if not {"factor_waterlogging", "factor_likely_acidity"} <= ids:
        pytest.skip("KB lacks factor_waterlogging / factor_likely_acidity")
    std = {f["id"]: f for f in analyze(client, {"description": STANDARD})["missing_analysis"]["failure_factors"]}
    assert std["factor_waterlogging"]["status"] == "not_indicated"
    assert std["factor_likely_acidity"]["status"] == "likely", "reddish colour only suggests acidity"
    assert std["factor_likely_acidity"]["triggered_by"] == [] and std["factor_likely_acidity"]["clues"]
    pool = analyze(client, {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"})
    pf = {f["id"]: f for f in pool["missing_analysis"]["failure_factors"]}
    assert pf["factor_waterlogging"]["status"] == "observed" and pf["factor_waterlogging"]["triggered_by"]


def test_failed_gate_test_keeps_not_ready(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    gates = [g for g in p["workflow"]["next_action"]["readiness_gate"] if g["required"]]
    target = next((g for g in gates if g["verification"]), None)
    if target is None:
        pytest.skip("no verified gate")
    # complete every required gate (and pass every test) except the target, whose test fails
    for g in gates:
        task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)
        client.patch(f"/api/plans/{pid}/progress", json={"task_id": task})
        if g["verification"]:
            res = "fail" if g["id"] == target["id"] else "pass"
            r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": res}})
    body = r.json()
    assert body["planting_readiness"] == "not_ready"
    assert body["steps_status"]["planting_method"] == "blocked"
    na = client.get(f"/api/plans/{pid}").json()["workflow"]["next_action"]
    assert na["blocked_until"] == [target["label"]]
    assert any(target["verification"]["if_fail"] in w for w in na["warnings"])
    assert target["verification"]["if_fail"] in na["next_best_action"]
    r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": target["id"], "result": "pass"}})
    assert r.json()["planting_readiness"] == "ready"


def test_dual_timeline(client, kb):
    if not kb.get("time_remediation_prep"):
        pytest.skip("KB has no time_remediation_prep yet")
    p = plan(client, {"description": STANDARD, "wet_season_weeks_remaining": 14})
    tf = p["workflow"]["timeframe"]
    rem = tf["remediation"]
    assert rem and rem["kb_id"] == "time_remediation_prep" and rem["explanation"]
    assert rem["weeks"] == {k: float(v) for k, v in kb.get("time_remediation_prep")["prep_weeks"].items()}
    if kb.get("time_soil_recovery"):
        assert tf["soil_recovery_note"]["kb_id"] == "time_soil_recovery" and tf["soil_recovery_note"]["text"]
    assert tf["rows"]
    for r in tf["rows"]:
        assert r["remediation_weeks"] == rem["weeks"]
        for k in ("min", "max"):
            assert r["full_timeline_weeks"][k] == r["maturity_weeks"][k] + r["buffer_weeks"][k] + rem["weeks"][k]
        # season fit still compares only maturity + buffer with the wet window
        tot = r["total_weeks"]
        exp = "fits" if tot["max"] <= 14 else "tight" if tot["min"] <= 14 < tot["max"] else "high_risk"
        assert r["season_fit"] == exp
    assert_ids_valid(kb, p)


def test_irrigation_and_stress(client, kb):
    p = plan(client, {"description": STANDARD})
    irr_kb = [r for r in kb.records("planting_methods") if r.get("method_type") == "irrigation"]
    if not irr_kb or not kb.records("stress_mitigation"):
        pytest.skip("KB has no irrigation methods / stress_mitigation yet")
    irr = p["workflow"]["planting_method"]["irrigation"]
    assert irr and all(kb.get(r["id"])["method_type"] == "irrigation" for r in irr)
    assert not [r for k in ("methods", "sowing", "water_capture") for r in p["workflow"]["planting_method"][k]
                if kb.get(r["id"]).get("method_type") == "irrigation"]
    stress = p["workflow"]["ongoing_care"]["stress_mitigation"]
    assert stress
    for s in stress:
        rec = kb.get(s["id"])
        assert kb.collection_of(s["id"]) == "stress_mitigation"
        assert s["stressor"] == rec["stressor"] and s["signs"] == rec.get("signs", [])
        assert s["actions"][: len(rec.get("actions", []))] == rec.get("actions", [])
    assert_ids_valid(kb, p)


def test_photo_analyze_not_enabled(client):
    r = client.post("/api/uploads/land-photo", files={"file": ("f.png", io.BytesIO(_png_bytes()), "image/png")}).json()
    res = client.post(f"/api/uploads/{r['photo_id']}/analyze")
    assert res.status_code == 200
    body = res.json()
    assert body == {"photo_id": r["photo_id"], "vision_enabled": False, "analysis_status": "not_enabled",
                    "message": "Photo attached; visual analysis is not enabled. The text description was used.",
                    "suggested": []}
    assert client.get("/api/health").json()["vision_enabled"] is False
    assert client.post("/api/uploads/" + "0" * 32 + "/analyze").status_code == 404


def test_vision_enabled_without_key_stays_off(kb):
    s = get_settings(enable_vision=True, openai_api_key="", openai_vision_model="")
    assert vision.vision_available(s) is False


def test_vision_output_filtered_to_visible_allow_list(kb):
    raw = ["colour_reddish", "hardpan_continuous", "digging_shallow", "season_known", "made_up", "slope_flat",
           "colour_reddish", 7]
    out = vision.filter_suggestions(kb, raw)
    tags = [o["tag"] for o in out]
    assert "hardpan_continuous" not in tags and "digging_shallow" not in tags and "season_known" not in tags
    assert "made_up" not in tags and tags.count("colour_reddish") == 1
    vocab = {c["tag"]: c for c in kb.records("observation_cues")}
    for o in out:
        assert o["tag"] in vision.VISIBLE_PHOTO_TAGS and o["cue_id"] == vocab[o["tag"]]["id"]


def test_photo_confirmed_tags(client, kb):
    a = analyze(client, {"description": "A patch of ground near the village.",
                         "photo_confirmed_tags": ["colour_reddish", "hardpan_continuous", "made_up_tag"]})
    by_tag = {t["tag"]: t for t in a["derived_tags"]}
    assert by_tag["colour_reddish"]["source"] == "photo"
    assert "hardpan_continuous" not in by_tag, "a photo can never establish hardpan continuity"
    assert "made_up_tag" not in by_tag
    assert "hardpan_unknown" in by_tag
    echo = a["input_echo"]
    assert echo["photo_status"] == "analyzed_tentative_confirmed"
    assert by_tag["colour_reddish"]["label"] in echo["photo_message"]
    assert "cannot show soil chemistry" in echo["photo_message"]
    plain = analyze(client, {"description": "A patch of ground near the village."})
    assert plain["input_echo"]["photo_status"] == "not_provided"
    assert_ids_valid(kb, a)
