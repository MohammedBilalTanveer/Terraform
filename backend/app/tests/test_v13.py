"""v1.3: accepting a risk waives only the test (never the task), gate tasks always completable,
"what should I do next" assistant intent."""
import pytest

from app.services.retrieval import applies

from .conftest import SCENARIO, plan
from .test_scenario_variations import FLAT_POOLING, ROCK_SHEET, STANDARD, assert_ids_valid


def _gate(body, gid):
    return next(g for g in body["readiness_gate"] if g["id"] == gid)


def _verified_required(p):
    gs = [g for g in p["workflow"]["next_action"]["readiness_gate"] if g["required"] and g["verification"]]
    if not gs:
        pytest.skip("no verified required gate")
    return gs[0]


def _task(kb, g):
    return next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)


def test_accept_risk_before_task_is_409(client, kb):
    p = plan(client, {"description": STANDARD})
    g = _verified_required(p)
    assert g["blocking_reason"] == "task_not_done" and g["can_accept_risk"] is False
    r = client.patch(f"/api/plans/{p['plan_id']}/progress", json={"accept_risk_gate_id": g["id"]})
    assert r.status_code == 409
    assert r.json() == {"error": {"code": "TASK_NOT_DONE",
                                  "message": "Complete the task first — accepting a risk only skips the test.",
                                  "retryable": False}}


def test_accept_risk_after_task_and_untick_drops_it(client, kb):
    p = plan(client, {"description": STANDARD})
    pid, g = p["plan_id"], _verified_required(p)
    r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": _task(kb, g)}).json()
    gi = _gate(r, g["id"])
    assert gi["task_done"] and not gi["satisfied"] and gi["blocking_reason"] == "test_not_run" and gi["can_accept_risk"]
    client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "fail"}})
    r = client.get(f"/api/plans/{pid}").json()["workflow"]["next_action"]
    assert _gate(r, g["id"])["blocking_reason"] == "test_failed"
    r = client.patch(f"/api/plans/{pid}/progress", json={"accept_risk_gate_id": g["id"]})
    assert r.status_code == 200
    gi = _gate(r.json(), g["id"])
    assert gi["satisfied"] and gi["accepted_risk"] and gi["blocking_reason"] is None and gi["can_accept_risk"] is False
    # un-tick every done task of that gate -> risk dropped, gate open again
    for t in g["satisfied_by_tasks"]:
        r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": t, "completed": False})
    body = r.json()
    gi = _gate(body, g["id"])
    assert not gi["satisfied"] and not gi["accepted_risk"] and gi["blocking_reason"] == "task_not_done"
    assert g["id"] not in body["accepted_risks"]
    # re-doing the task does NOT bring the old accepted risk back
    gi = _gate(client.patch(f"/api/plans/{pid}/progress", json={"task_id": _task(kb, g)}).json(), g["id"])
    assert gi["accepted_risk"] is False and gi["satisfied"] is False


def test_readiness_states(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    required = [g for g in p["workflow"]["next_action"]["readiness_gate"] if g["required"]]
    assert p["workflow"]["next_action"]["planting_readiness"] == "not_ready"
    verified = [g for g in required if g["verification"]]
    for g in required:
        r = client.patch(f"/api/plans/{pid}/progress", json={"task_id": _task(kb, g)})
    if verified:
        assert r.json()["planting_readiness"] == "not_ready", "tasks alone do not pass the tests"
        assert r.json()["steps_status"]["planting_method"] == "blocked"
        for g in verified:
            r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "pass"}})
    assert r.json()["planting_readiness"] == "ready"
    if verified:
        g = verified[0]
        client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "fail"}})
        r = client.patch(f"/api/plans/{pid}/progress", json={"accept_risk_gate_id": g["id"]}).json()
        assert r["planting_readiness"] == "ready_with_accepted_risk"
        assert r["steps_status"]["planting_method"] != "blocked"
        # a passed test makes the accepted risk irrelevant -> plain ready
        r = client.patch(f"/api/plans/{pid}/progress", json={"gate_result": {"gate_id": g["id"], "result": "pass"}}).json()
        assert r["planting_readiness"] == "ready"


@pytest.mark.parametrize("obs", [
    {"description": STANDARD},
    {"description": ROCK_SHEET},
    {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"},
    {"description": STANDARD + " We have no compost.", "available_resources": ["none_compost", "seeds"]},
])
def test_gate_tasks_cover_every_required_gate(client, kb, obs):
    p = plan(client, obs)
    na = p["workflow"]["next_action"]
    task_ids = {r["task_id"] for r in na["gate_tasks"] if r["task_id"]}
    assert len({r["id"] for r in na["gate_tasks"]}) == len(na["gate_tasks"]), "de-duplicated"
    tags = {t["tag"] for t in p["derived_tags"]}
    for g in na["readiness_gate"]:
        if not g["required"]:
            continue
        assert set(g["satisfied_by_tasks"]) & task_ids, f"no completable task shown for {g['id']}"
        for t in g["satisfied_by_tasks"]:
            for rid in kb.task_owner.get(t, []):
                rec = kb.get(rid)
                if kb.collection_of(rid) in ("soil_treatments", "planting_methods") and applies(rec, tags):
                    assert t in task_ids
    for r in na["gate_tasks"]:
        assert r["task_label"] and kb.has(r["id"])
    assert_ids_valid(kb, p)


def test_assistant_what_next_with_plan(client, kb):
    p = plan(client, {"description": STANDARD})
    for q in ("What should I do next?", "what's left?", "Where do I go now", "next step please"):
        r = client.post("/api/assistant/ask", json={"question": q, "plan_id": p["plan_id"]}).json()
        assert r["refused"] is False, q
        na = p["workflow"]["next_action"]
        assert r["answer"].startswith(na["next_best_action"])
        for label in na["blocked_until"]:
            assert label in r["answer"]
        gate_ids = {g["id"] for g in na["readiness_gate"]}
        assert {m["kb_id"] for m in r["matched"]} & gate_ids
        assert all(kb.has(i) for i in r["evidence"]["kb_ids"]) and SCENARIO in r["evidence"]["kb_ids"]
        for m in r["matched"]:
            assert client.get(f"/api/knowledge/records/{m['kb_id']}").status_code == 200
    # via session id too
    r = client.post("/api/assistant/ask", json={"question": "what should I do", "session_id": p["session_id"]}).json()
    assert r["refused"] is False and r["answer"].startswith(p["workflow"]["next_action"]["next_best_action"])


def test_assistant_what_next_without_plan_uses_search(client):
    r = client.post("/api/assistant/ask", json={"question": "what should I do next?"}).json()
    # no plan -> ordinary KB search (answer or refusal), never a plan-based next-step answer
    assert not [m for m in r["matched"] if m["collection"] == "scenarios.readiness_gate"]
