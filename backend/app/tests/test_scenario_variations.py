"""Behavioural tests for the standard scenario and its variations (run on fixture KB and real KB)."""
import io
import struct
import zlib

import pytest

from app.config import get_settings
from app.services import llm_rewriter
from app.services.kb_loader import load_kb

from .conftest import FIXTURE_KB, SCENARIO, all_kb_ids, all_source_ids, analyze, fix_ids, fix_records, plan

STANDARD = ("The ground is reddish and stony. When I dig, it stops at about a hand's depth. "
            "Rain runs off fast. There is dry grass in tufts and a few thorny shrubs.")
ROCK_SHEET = ("Reddish stony ground. A continuous sheet of rock blocks digging everywhere; "
              "I cannot get below a hand's depth anywhere. Rain runs off fast.")
FLAT_POOLING = ("Reddish stony ground, digging stops at about a hand's depth. The land is completely flat "
                "and after rain the water pools everywhere for days.")


def tags_of(resp):
    return {t["tag"] for t in resp["derived_tags"]}


def assert_ids_valid(kb, resp):
    ids = all_kb_ids(resp)
    bad = [i for i in ids if not kb.has(i)]
    assert not bad, f"unknown kb ids in response: {bad}"
    srcs = all_source_ids(resp)
    assert not [s for s in srcs if s not in kb.sources]


def unknown_tags(kb, contains):
    sc = kb.scenario(SCENARIO)
    return [u for u in sc["unknowns"] if set(u.get("resolved_by_tags") or []) & set(contains)]


def text_blob(rec):
    return " ".join([rec["id"], rec["title"], rec.get("task_id") or ""]).lower()


# ------------------------------------------------------------------ unknowns
def test_unknown_fields_stay_unknown(client):
    a = analyze(client, {"description": "The soil is red.", "slope": "unknown", "pooling": "unknown",
                         "rain_window": "unknown", "digging_resistance": "unknown"})
    tags = tags_of(a)
    for t in ("slope_unknown", "pooling_unknown", "rain_unknown", "hardpan_unknown", "season_unknown",
              "local_advice_none"):
        assert t in tags, t
    for t in ("slope_flat", "slope_slight", "slope_steep", "pooling_none", "pooling_some", "pooling_widespread",
              "hardpan_patchy", "hardpan_continuous", "season_known"):
        assert t not in tags, t
    fields = {n["field"] for n in a["input_echo"]["not_provided"]}
    assert {"slope", "pooling", "rain_window", "wet_season_weeks_remaining", "photo_id"} <= fields


def test_negation_guard(client):
    a = analyze(client, {"description": "The soil is not red at all."})
    assert "colour_reddish" not in tags_of(a)


# ------------------------------------------------------------------ Case A
def test_case_a_standard_scenario(client, kb):
    a = analyze(client, {"description": STANDARD})
    tags = tags_of(a)
    echo = a["input_echo"]
    assert echo["user_text"] == STANDARD
    observed = [t for t in a["derived_tags"] if not t["tag"].endswith("_unknown") and t["tag"] != "local_advice_none"]
    expected = "You reported: " + ", ".join(dict.fromkeys(t["label"] for t in observed)) + "."
    assert echo["faithful_summary"] == expected
    assert {"colour_reddish", "digging_shallow", "runoff_fast"} <= tags
    # nothing the user did not say
    for t in ("slope_flat", "slope_steep", "pooling_widespread", "hardpan_continuous", "low_water", "no_compost"):
        assert t not in tags
    assert {"slope_unknown", "season_unknown", "pooling_unknown", "rain_unknown"} <= tags
    assert {f["fact"] for f in echo["observed_facts"]} <= {t["label"] for t in a["derived_tags"]}
    assert echo["photo_status"] == "not_provided"
    assert echo["local_advice"]["provided"] is False

    arch = a["missing_analysis"]["archetype"]
    assert arch["match_strength"] in ("strong", "partial")
    assert arch["statement"].startswith("Likely candidate:") and "not a laboratory diagnosis" in arch["statement"]
    open_ids = {u["id"] for u in a["missing_analysis"]["unknowns"]}
    for u in unknown_tags(kb, ["hardpan_continuous"]) + unknown_tags(kb, ["slope_flat"]) + unknown_tags(kb, ["season_known"]):
        assert u["id"] in open_ids
    check_ids = {c["id"] for c in a["missing_analysis"]["checks"]}
    probe = {c for u in unknown_tags(kb, ["hardpan_continuous"]) for c in u["check_ids"]}
    rain = {c for u in unknown_tags(kb, ["pooling_widespread", "slope_slight"]) for c in u["check_ids"]}
    assert check_ids & probe, "a probing check must be suggested"
    assert check_ids & rain, "a watch-the-rain check must be suggested"
    fizz = [c for c in a["missing_analysis"]["checks"] if c["weak_evidence"]]
    assert all(not c["gate_relevant"] for c in fizz)
    assert_ids_valid(kb, a)
    assert a["meta"]["generation_mode"] == "deterministic" and a["meta"]["llm_used"] is False

    p = plan(client, {"description": STANDARD})
    cats = {r["category"] for r in fix_records(p)}
    assert cats & {"soil_depth", "fertility"}, "soil-building records expected"
    pm = p["workflow"]["planting_method"]
    assert "water_capture" in cats or pm["water_capture"], "water-capture records expected"
    tf = p["workflow"]["timeframe"]
    assert tf["wet_season_weeks_remaining"] is None
    assert tf["rows"] and all(r["season_fit"] == "unknown" for r in tf["rows"])
    unk = kb.get("time_rule_unknown_season")
    assert tf["comparison"] in (unk.get("explanation"), unk.get("summary"))
    assert all(c["season_fit"] == "unknown" for c in p["workflow"]["crop_suggestions"]["field_crops"])
    assert p["workflow"]["next_action"]["planting_readiness"] == "not_ready"
    assert p["steps_status"]["planting_method"] == "blocked"
    assert p["steps_status"]["harvest"] == "blocked"
    assert set(p["steps_status"]) == {"observation_log", "input_echo", "missing_analysis", "fix_protocol",
                                      "next_action", "crop_suggestions", "timeframe", "planting_method",
                                      "ongoing_care", "harvest"}
    assert p["situation_summary"].startswith("Based on what you reported:")
    for rec in fix_records(p):
        assert rec["why_this_matches"], rec["id"]
        assert rec["evidence"]["kb_ids"][0] == rec["id"]
    # every crop card carries a transparent score breakdown that sums to the score
    for c in p["workflow"]["crop_suggestions"]["field_crops"] + p["workflow"]["crop_suggestions"]["tree_options"]:
        assert sum(e["points"] for e in c["score_breakdown"]) == c["score"]
    assert all(c["category"] in ("tree", "soil_builder") for c in p["workflow"]["crop_suggestions"]["tree_options"])
    assert all(c["category"] == "field_crop" for c in p["workflow"]["crop_suggestions"]["field_crops"])
    scores = [c["score"] for c in p["workflow"]["crop_suggestions"]["field_crops"]]
    assert scores == sorted(scores, reverse=True)
    assert_ids_valid(kb, p)
    assert p["meta"]["generation_mode"] == "deterministic"


def test_season_known_changes_fit(client):
    p = plan(client, {"description": STANDARD, "wet_season_weeks_remaining": 14})
    tf = p["workflow"]["timeframe"]
    assert tf["wet_season_weeks_remaining"] == 14
    for r in tf["rows"]:
        tot = r["total_weeks"]
        exp = "fits" if tot["max"] <= 14 else "tight" if tot["min"] <= 14 < tot["max"] else "high_risk"
        assert r["season_fit"] == exp
        assert tot["min"] == r["maturity_weeks"]["min"] + r["buffer_weeks"]["min"]


# ------------------------------------------------------------------ Case B
def test_case_b_continuous_rock_sheet(client, kb):
    a = analyze(client, {"description": ROCK_SHEET})
    assert "hardpan_continuous" in tags_of(a)
    assert "hardpan_unknown" not in tags_of(a)
    p = plan(client, {"description": ROCK_SHEET})
    do_first = p["workflow"]["fix_protocol"]["do_first"]
    assert not [r for r in do_first if r["task_id"] == "task_build_pits"], "no pit building on a rock sheet"
    all_recs = fix_records(p) + [m for k in ("methods", "sowing", "water_capture") for m in p["workflow"]["planting_method"][k]]
    types = {kb.get(r["id"]).get("method_type") for r in p["workflow"]["planting_method"]["methods"]}
    assert {"raised_bed", "container"} & types or any("raised" in text_blob(r) or "container" in text_blob(r) for r in all_recs)
    assert "planting_pit" not in {kb.get(r["id"]).get("method_type") for r in p["workflow"]["planting_method"]["methods"]
                                  if (kb.get(r["id"]).get("task") or {}).get("task_id") == "task_build_pits"}
    assert p["workflow"]["crop_suggestions"]["trial_advice"] is not None
    cs = p["workflow"]["crop_suggestions"]
    excluded = {c["crop_id"] for c in cs["excluded"]}
    for tree in [c for c in kb.records("crop_profiles") if c["category"] == "tree"]:
        suit = set(tree.get("suitability_tags") or [])
        hard_caution = any(x.get("when_tag") == "hardpan_continuous" for x in tree.get("cautions") or [])
        if tree["id"] in excluded or ("shallow_rooting_ok" in suit and "needs_deep_soil" not in suit and not hard_caution):
            continue  # a shallow-rooting tree with no hard-layer caution in the KB is legitimately not penalised
        card = next(c for c in cs["tree_options"] if c["crop_id"] == tree["id"])
        assert any(e["points"] < 0 and "hardpan" in e["factor"] for e in card["score_breakdown"]), tree["id"]
    adapt = {x["trigger_tag"]: x for x in p["adaptations"]}
    assert "hardpan_continuous" in adapt and adapt["hardpan_continuous"]["kb_ids"]
    assert_ids_valid(kb, p)


# ------------------------------------------------------------------ Case C
def test_case_c_flat_with_pooling(client, kb):
    obs = {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}
    p = plan(client, obs)
    tags = tags_of(p)
    assert {"slope_flat", "pooling_widespread"} <= tags
    for r in p["workflow"]["fix_protocol"]["do_first"]:
        blob = text_blob(r)
        assert not any(w in blob for w in ("stone_line", "stone line", "contour", "bund")), r["id"]
    recs = fix_records(p) + p["workflow"]["planting_method"]["methods"]
    assert any("overflow" in text_blob(r) or "raised" in text_blob(r) for r in recs)
    avoid = p["workflow"]["fix_protocol"]["avoid"]
    assert any(set(kb.get(r["id"])["applies_when"].get("any_tags") or []) & {"pooling_some", "pooling_widespread"}
               or "trap" in text_blob(r) for r in avoid)
    gates = {g["id"] for g in p["workflow"]["next_action"]["readiness_gate"]}
    sc = kb.scenario(SCENARIO)
    for g in sc["readiness_gate"]:
        if "pooling_widespread" in (g.get("applies_when") or {}).get("none_tags", []):
            assert g["id"] not in gates
    assert_ids_valid(kb, p)


def test_variations_produce_different_fix_protocols(client):
    a = fix_ids(plan(client, {"description": STANDARD}))
    b = fix_ids(plan(client, {"description": ROCK_SHEET}))
    c = fix_ids(plan(client, {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}))
    assert a != b and a != c and b != c


# ------------------------------------------------------------------ Case D
def test_case_d_no_compost_little_water(client, kb):
    obs = {"description": STANDARD + " We have no compost and very little water.",
           "available_resources": ["none_compost", "little_water", "seeds", "hand_tools"]}
    p = plan(client, obs)
    tags = tags_of(p)
    assert {"no_compost", "low_water"} <= tags
    assert "res_compost" not in tags
    recs = fix_records(p)
    via_tag = [r for r in recs if "no_compost" in (kb.get(r["id"])["applies_when"].get("any_tags") or [])]
    via_alt = [r for r in recs if any(a in r["actions"] for a in kb.get(r["id"]).get("alternatives_if_missing") or [])
               and set(kb.get(r["id"]).get("requires_resources") or []) & {"res_compost", "res_manure"}]
    assert via_tag or via_alt, "compost alternatives expected"
    assert not [r for r in recs if "no_compost" in (kb.get(r["id"])["applies_when"].get("none_tags") or [])]
    assert p["workflow"]["crop_suggestions"]["trial_advice"] is not None
    cs = p["workflow"]["crop_suggestions"]
    cards = {c["crop_id"]: c for c in cs["field_crops"] + cs["tree_options"] + cs["excluded"]}
    penalised = 0
    for crop in kb.records("crop_profiles"):
        card = cards.get(crop["id"])
        if card is None:
            continue
        if "high_water_demand" in crop.get("suitability_tags", []):
            assert any(e["points"] == -4 for e in card["score_breakdown"]), crop["id"]
            penalised += 1
        if any(c["when_tag"] == "low_water" for c in crop.get("cautions", [])):
            assert card["fit_label"] == "excluded" or any("low_water" in e["factor"] and e["points"] < 0
                                                          for e in card["score_breakdown"]), crop["id"]
            penalised += 1
    assert penalised > 0
    assert any(x["trigger_tag"] in ("no_compost", "low_water") for x in p["adaptations"])
    assert_ids_valid(kb, p)


# ------------------------------------------------------------------ Case E
def test_case_e_local_advice_trees_only(client, kb):
    advice = "Only tree crops grow here, nothing else."
    a = analyze(client, {"description": STANDARD, "local_advice": advice})
    assert "local_advice_trees_only" in tags_of(a)
    la = a["input_echo"]["local_advice"]
    assert la["provided"] is True and la["text"] == advice
    assert "claim" in la["handling"] and "not as verified fact" in la["handling"]
    p = plan(client, {"description": STANDARD, "local_advice": advice})
    cs = p["workflow"]["crop_suggestions"]
    assert cs["local_advice_note"] and advice in cs["local_advice_note"]
    assert a["missing_analysis"]["conflicts"] or cs["local_advice_note"]
    assert cs["trial_advice"] is not None
    assert cs["field_crops"], "field crops are still evaluated; the claim is not taken as fact"
    assert_ids_valid(kb, a)
    assert_ids_valid(kb, p)


# ------------------------------------------------------------------ Case F
def _png_bytes():
    raw = b"\x00\xff\x00\x00"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def test_case_f_photo_upload(client, kb):
    png = _png_bytes()
    r = client.post("/api/uploads/land-photo", files={"file": ("field.png", io.BytesIO(png), "image/png")})
    assert r.status_code == 200, r.text
    up = r.json()
    assert up["analysis_status"] == "attached_not_analyzed" and up["media_type"] == "image/png"
    assert up["size_bytes"] == len(png) and up["url"] == f"/api/uploads/{up['photo_id']}"
    assert up["filename"] != "field.png"
    got = client.get(up["url"])
    assert got.status_code == 200 and got.content == png and got.headers["content-type"] == "image/png"

    bad = client.post("/api/uploads/land-photo", files={"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")})
    assert bad.status_code == 415 and bad.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"
    fake = client.post("/api/uploads/land-photo", files={"file": ("x.png", io.BytesIO(b"GIF89a....."), "image/png")})
    assert fake.status_code == 415
    big = client.post("/api/uploads/land-photo",
                      files={"file": ("big.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * (8 * 1024 * 1024)), "image/png")})
    assert big.status_code == 413 and big.json()["error"]["code"] == "FILE_TOO_LARGE"
    assert client.get("/api/uploads/" + "0" * 32).status_code == 404

    a = analyze(client, {"description": STANDARD, "photo_id": up["photo_id"]})
    assert a["input_echo"]["photo_status"] == "attached_not_analyzed"
    assert "visual analysis is not enabled" in a["input_echo"]["photo_message"]
    assert "photo_attached" in tags_of(a)
    # the photo never adds soil facts
    assert tags_of(a) - {"photo_attached"} == tags_of(analyze(client, {"description": STANDARD}))


# ------------------------------------------------------------------ Case G
def test_case_g_llm_unavailable_is_deterministic(kb_dir, tmp_path):
    from fastapi.testclient import TestClient
    from app.main import create_app
    s = get_settings(kb_directory=kb_dir, data_directory=tmp_path / "d", upload_directory=tmp_path / "u",
                     enable_llm_rewrite=True, openai_api_key="", openai_model="")
    c = TestClient(create_app(s))
    assert c.get("/api/health").json()["llm_enabled"] is False
    p = plan(c, {"description": STANDARD})
    assert p["meta"]["generation_mode"] == "deterministic" and p["meta"]["llm_used"] is False
    ans = c.post("/api/assistant/ask", json={"question": "how do I build raised beds"}).json()
    assert ans["generation_mode"] == "deterministic"


def test_llm_output_validation(kb):
    orig = "Based on what you reported: reddish surface. Still unknown: slope."
    assert llm_rewriter.validate(orig, "You told us the surface looks reddish; slope is still unknown.", [], kb)
    assert not llm_rewriter.validate(orig, "Reddish surface; plant within 3 weeks.", [], kb)
    crop = kb.records("crop_profiles")[0]["name"]
    assert not llm_rewriter.validate(orig, f"Reddish surface, so grow {crop}.", [], kb)
    assert not llm_rewriter.validate(orig, "", [], kb)
    text, used = llm_rewriter.rewrite(get_settings(enable_llm_rewrite=False), kb, orig, [])
    assert text == orig and used is False


# ------------------------------------------------------------------ progress / gates
def test_progress_gate_flow(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    gates = p["workflow"]["next_action"]["readiness_gate"]
    assert all(not g["required"] for g in gates if "fizz" in g["id"])
    required = [g for g in gates if g["required"]]
    assert required
    last = None
    for g in required:
        task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)
        r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": task, "completed": True})
        assert r.status_code == 200, r.text
        if g.get("verification"):
            r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "pass"}})
            assert r.status_code == 200, r.text
        last = r.json()
    assert last["planting_readiness"] == "ready"
    assert last["steps_status"]["next_action"] == "complete"
    assert last["steps_status"]["planting_method"] != "blocked"
    full = client.get(f"/api/plans/{pid}").json()
    assert full["workflow"]["next_action"]["blocked_until"] == []
    sess = client.get(f"/api/sessions/{full['session_id']}").json()
    assert set(sess["completed_tasks"]) == set(last["completed_tasks"])

    # un-complete one task -> not ready again
    first_task = last["completed_tasks"][0]
    r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": first_task, "completed": False}).json()
    assert r["planting_readiness"] == "not_ready"


def test_progress_accept_risk_and_select_crop(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    required = [g for g in p["workflow"]["next_action"]["readiness_gate"] if g["required"]]
    for g in required:
        task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)
        r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": task})
        assert r.status_code == 200
        if g["verification"]:  # skip the test as an accepted risk (allowed only after the task)
            r = client.patch(f"/api/plans/{pid}/progress", json={"accept_risk_gate_id": g["id"]})
            assert r.status_code == 200
    expected = "ready_with_accepted_risk" if any(g["verification"] for g in required) else "ready"
    assert r.json()["planting_readiness"] == expected
    crop = p["workflow"]["crop_suggestions"]["field_crops"][-1]["crop_id"]
    r = client.patch(f"/api/plans/{pid}/progress", json={"selected_crop_id": crop})
    assert r.status_code == 200 and r.json()["steps_status"]["crop_suggestions"] == "complete"
    full = client.get(f"/api/plans/{pid}").json()
    assert full["workflow"]["ongoing_care"]["crop_id"] == crop
    assert full["workflow"]["ongoing_care"]["crop_basis"] == "selected"
    assert client.patch(f"/api/plans/{pid}/progress", json={"task_id": "task_nope"}).status_code == 404
    assert client.patch(f"/api/plans/{pid}/progress", json={"accept_risk_gate_id": "gate_nope"}).status_code == 404
    assert client.get("/api/plans/plan_missing").json()["error"]["code"] == "PLAN_NOT_FOUND"


def test_ongoing_care_and_harvest_from_kb(client, kb):
    p = plan(client, {"description": STANDARD})
    oc = p["workflow"]["ongoing_care"]
    assert oc["crop_basis"] == "top_ranked_default"
    assert oc["crop_id"] == p["workflow"]["crop_suggestions"]["field_crops"][0]["crop_id"]
    orders = [s["order"] for s in oc["stages"]]
    assert orders == sorted(orders) and len({s["stage"] for s in oc["stages"]}) == len(oc["stages"])
    crop = kb.get(oc["crop_id"])
    for pid in crop.get("pest_ids") or []:
        if kb.has(pid):
            assert pid in {x["id"] for x in oc["pest_watch"]}
    hv = p["workflow"]["harvest"]
    hp = kb.get(crop.get("harvest_profile_id") or "")
    if hp:
        assert hv["method"] == hp["method"]


# ------------------------------------------------------------------ sessions & assistant
def test_sessions_roundtrip(client):
    s = client.post("/api/sessions", json={}).json()
    assert s["current_step"] == "observation_log" and s["observation"] is None
    upd = client.put(f"/api/sessions/{s['session_id']}", json={"current_step": "fix_protocol",
                                                               "journal": [{"at": "2026-10-15", "text": "dug 5 holes"}]}).json()
    assert upd["current_step"] == "fix_protocol" and upd["journal"][0]["text"] == "dug 5 holes"
    a = analyze(client, {"description": STANDARD}, session_id=s["session_id"])
    assert a["session_id"] == s["session_id"]
    got = client.get(f"/api/sessions/{s['session_id']}").json()
    assert got["analysis_id"] == a["analysis_id"] and got["observation"]["description"] == STANDARD
    assert client.get("/api/sessions/sess_missing").status_code == 404


def test_session_check_outcomes_feed_tags(client, kb):
    probe = next(c for c in kb.records("diagnostic_checks")
                 if any("hardpan_continuous" in o.get("implies_tags", []) for o in c.get("possible_outcomes", [])))
    outcome = next(o for o in probe["possible_outcomes"] if "hardpan_continuous" in o["implies_tags"])
    a = analyze(client, {"description": STANDARD,
                         "user_confirmed_checks": [{"check_id": probe["id"], "outcome_id": outcome["outcome_id"]}]})
    t = next(x for x in a["derived_tags"] if x["tag"] == "hardpan_continuous")
    assert t["source"] == "check"
    assert any(c["check_id"] == probe["id"] for c in a["input_echo"]["checks_already_done"])


def test_assistant_answers_from_kb_or_refuses(client, kb):
    r = client.post("/api/assistant/ask", json={"question": "How do I build raised beds?"}).json()
    assert r["refused"] is False and r["matched"]
    for m in r["matched"]:
        rec = kb.get(m["kb_id"])
        assert rec and ((rec.get("answer") or rec.get("summary") or "") in r["answer"])
    assert set(r["evidence"]["kb_ids"]) == {m["kb_id"] for m in r["matched"]}
    no = client.post("/api/assistant/ask", json={"question": "What is the bitcoin price on the stock exchange?"}).json()
    assert no["refused"] is True and no["matched"] == []
    assert no["answer"].startswith("The knowledge base does not contain enough information to answer this safely.")
    assert all(kb.has(i) for i in no["evidence"]["kb_ids"])


def test_case_e_local_advice_in_description(client, kb):
    desc = STANDARD + " Locals say only tree crops grow here."
    a = analyze(client, {"description": desc})
    t = next(x for x in a["derived_tags"] if x["tag"] == "local_advice_trees_only")
    assert t["source"] == "description"
    la = a["input_echo"]["local_advice"]
    assert la["provided"] is True and la["text"] == "Locals say only tree crops grow here."
    assert "not as verified fact" in la["handling"]
    assert "local_advice" not in {n["field"] for n in a["input_echo"]["not_provided"]}
    assert any(c["id"] == "conflict_local_advice_trees_only" for c in a["missing_analysis"]["conflicts"])
    p = plan(client, {"description": desc})
    cs = p["workflow"]["crop_suggestions"]
    assert cs["local_advice_note"] and "Locals say only tree crops grow here." in cs["local_advice_note"]
    assert cs["trial_advice"] is not None and cs["field_crops"]
    adapt = {x["trigger_tag"]: x for x in p["adaptations"]}
    assert "local_advice_trees_only" in adapt
    assert adapt["local_advice_trees_only"]["kb_ids"] and all(kb.has(i) for i in adapt["local_advice_trees_only"]["kb_ids"])
    assert_ids_valid(kb, p)
