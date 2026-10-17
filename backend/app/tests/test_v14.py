"""v1.4: one enforced workflow order  prepare -> readiness -> choose crop -> plant -> care -> harvest."""
import json
import shutil

import pytest

from app.services.kb_loader import load_kb
from app.services.planner import task_phase

from .conftest import FIXTURE_KB, plan
from .test_scenario_variations import FLAT_POOLING, ROCK_SHEET, STANDARD, assert_ids_valid

PHASES = {"prepare", "readiness", "plant"}
SOW = "task_sow_seeds"
CONFIRM = "task_confirm_reliable_rains"
LOCK_TEXT = {"choose_crop": "Choose a crop first.", "pass_gate": "Pass the readiness gate first.",
             "choose_crop_and_pass_gate": "Choose a crop and pass the readiness gate first."}


def walk_recs(node, out=None):
    """Every Recommendation-shaped dict (has task_id + why_this_matches) anywhere in a response."""
    if out is None:
        out = []
    if isinstance(node, dict):
        if "task_id" in node and "why_this_matches" in node and "possible_outcomes" not in node:  # not check cards
            out.append(node)
        for v in node.values():
            walk_recs(v, out)
    elif isinstance(node, list):
        for v in node:
            walk_recs(v, out)
    return out


def patch(client, pid, **body):
    return client.patch(f"/api/plans/{pid}/progress", json=body)


def pass_all_gates(client, kb, p):
    """Complete every required gate's task and pass its test; returns the last progress response."""
    r = None
    for g in p["workflow"]["next_action"]["readiness_gate"]:
        if not g["required"]:
            continue
        task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)
        r = patch(client, p["plan_id"], task_id=task)
        assert r.status_code == 200, (task, r.text)
        if g["verification"]:
            r = patch(client, p["plan_id"], gate_result={"gate_id": g["id"], "result": "pass"})
            assert r.status_code == 200
    return r.json()


def sow_card(client, pid):
    wf = client.get(f"/api/plans/{pid}").json()["workflow"]
    return next(c for c in wf["planting_method"]["sowing"] if c["task_id"] == SOW)


def top_crop(p):
    return p["workflow"]["crop_suggestions"]["field_crops"][0]["crop_id"]


# ------------------------------------------------------------------ phases on every task-bearing rec
@pytest.mark.parametrize("obs", [{"description": STANDARD}, {"description": ROCK_SHEET},
                                 {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}])
def test_phase_on_every_task_bearing_recommendation(client, kb, obs):
    p = plan(client, obs)
    recs = walk_recs(p["workflow"])
    with_task = [r for r in recs if r["task_id"]]
    assert with_task
    for r in with_task:
        assert r["phase"] in PHASES, r["id"]
        kb_phase = (kb.get(r["id"]).get("task") or {}).get("phase")
        if kb_phase:
            assert r["phase"] == kb_phase, "the KB phase wins"
        if r["phase"] != "plant":
            assert r["locked"] is False and r["locked_reason"] is None, r["id"]
        else:
            assert r["locked"] is True and r["locked_reason"] == "choose_crop_and_pass_gate", r["id"]
    for r in recs:
        if not r["task_id"]:
            assert r["phase"] is None and r["locked"] is False
    sections = {"fix_protocol", "planting_method", "next_action"}
    seen = {s for s in sections if [x for x in walk_recs(p["workflow"][s]) if x["task_id"]]}
    assert seen == sections, "phase/locked must be present in fix_protocol, planting_method and gate_tasks"
    assert_ids_valid(kb, p)


def test_kb_phase_rules_for_key_tasks(kb):
    assert task_phase(kb, SOW) == "plant"
    assert task_phase(kb, CONFIRM) == "readiness"
    assert task_phase(kb, "task_build_pits") == "prepare"
    assert task_phase(kb, None) is None


def test_phase_fallback_for_kb_without_phase(tmp_path):
    kbdir = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, kbdir)
    for f in ("soil_treatments.json", "planting_methods.json"):
        d = json.loads((kbdir / f).read_text(encoding="utf-8"))
        for r in d["records"]:
            if r.get("task"):
                r["task"].pop("phase", None)
        (kbdir / f).write_text(json.dumps(d), encoding="utf-8")
    kb = load_kb(kbdir)
    assert kb.errors == []
    assert task_phase(kb, "task_sow_seeds") == "plant"
    assert task_phase(kb, "task_mulch_after_sowing") == "plant"
    assert task_phase(kb, "task_plant_tree_seedlings") == "plant"
    assert task_phase(kb, "task_confirm_reliable_rains") == "readiness"
    assert task_phase(kb, "task_recheck_fizz_optional") == "readiness"
    assert task_phase(kb, "task_build_pits") == "prepare"
    assert task_phase(kb, "task_gather_mulch") == "prepare"


def test_loader_rejects_invalid_phase(tmp_path):
    kbdir = tmp_path / "kb"
    shutil.copytree(FIXTURE_KB, kbdir)
    d = json.loads((kbdir / "soil_treatments.json").read_text(encoding="utf-8"))
    next(r for r in d["records"] if r.get("task"))["task"]["phase"] = "whenever"
    (kbdir / "soil_treatments.json").write_text(json.dumps(d), encoding="utf-8")
    assert any("invalid phase 'whenever'" in e for e in load_kb(kbdir).errors)


# ------------------------------------------------------------------ confirm_reliable_rains at the gate
@pytest.mark.parametrize("obs", [{"description": STANDARD}, {"description": ROCK_SHEET},
                                 {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}])
def test_confirm_reliable_rains_is_completable_at_gate(client, kb, obs):
    p = plan(client, obs)
    na = p["workflow"]["next_action"]
    gate = next((g for g in na["readiness_gate"] if CONFIRM in g["satisfied_by_tasks"]), None)
    if gate is None:
        pytest.skip("KB has no gate for task_confirm_reliable_rains")
    card = next((c for c in na["gate_tasks"] if c["task_id"] == CONFIRM), None)
    assert card is not None, "gate_tasks must include task_confirm_reliable_rains"
    assert card["phase"] == "readiness" and card["locked"] is False and card["locked_reason"] is None
    r = patch(client, p["plan_id"], task_id=CONFIRM)
    assert r.status_code == 200, "must be completable before any crop is chosen or gate passed"
    assert _gate(r.json(), gate["id"])["task_done"] is True


def _gate(body, gid):
    return next(g for g in body["readiness_gate"] if g["id"] == gid)


# ------------------------------------------------------------------ locking
def test_sow_before_crop_is_409(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    pass_all_gates(client, kb, p)
    card = sow_card(client, pid)
    assert card["locked"] is True and card["locked_reason"] == "choose_crop"
    r = patch(client, pid, task_id=SOW, completed=True)
    assert r.status_code == 409
    assert r.json() == {"error": {"code": "TASK_LOCKED", "message": LOCK_TEXT["choose_crop"], "retryable": False}}
    assert SOW not in client.get(f"/api/plans/{pid}").json()["completed_tasks"]


def test_sow_before_gate_is_409(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    assert patch(client, pid, selected_crop_id=top_crop(p)).status_code == 200
    card = sow_card(client, pid)
    assert card["locked"] is True and card["locked_reason"] == "pass_gate"
    r = patch(client, pid, task_id=SOW)
    assert r.status_code == 409 and r.json()["error"]["code"] == "TASK_LOCKED"
    assert r.json()["error"]["message"] == LOCK_TEXT["pass_gate"]


def test_sow_with_neither_has_combined_message(client, kb):
    p = plan(client, {"description": STANDARD})
    r = patch(client, p["plan_id"], task_id=SOW)
    assert r.status_code == 409 and r.json()["error"]["message"] == LOCK_TEXT["choose_crop_and_pass_gate"]
    assert sow_card(client, p["plan_id"])["locked_reason"] == "choose_crop_and_pass_gate"


def test_sow_after_crop_and_gate_ok_and_unlocks_steps(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    last = pass_all_gates(client, kb, p)
    assert last["planting_readiness"] == "ready"
    assert last["steps_status"]["planting_method"] == "ready", "not in progress until a crop is chosen"
    assert last["steps_status"]["ongoing_care"] == last["steps_status"]["harvest"] == "blocked"
    r = patch(client, pid, selected_crop_id=top_crop(p)).json()
    assert sow_card(client, pid)["locked"] is False and sow_card(client, pid)["locked_reason"] is None
    assert r["steps_status"]["ongoing_care"] == "blocked", "care needs a sow task first"
    r = patch(client, pid, task_id=SOW)
    assert r.status_code == 200, r.text
    st = r.json()["steps_status"]
    assert st["planting_method"] in ("in_progress", "complete")
    assert st["ongoing_care"] == st["harvest"] == "ready"
    assert SOW in r.json()["completed_tasks"]


def test_locks_recompute_when_crop_or_gate_change(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    pass_all_gates(client, kb, p)
    patch(client, pid, selected_crop_id=top_crop(p))
    assert patch(client, pid, task_id=SOW).status_code == 200
    # deselect the crop -> locked again, care/harvest blocked again, but un-ticking is always allowed
    r = patch(client, pid, selected_crop_id=None).json()
    assert sow_card(client, pid)["locked_reason"] == "choose_crop"
    assert r["steps_status"]["ongoing_care"] == "blocked" and r["steps_status"]["planting_method"] == "ready"
    assert patch(client, pid, task_id=SOW, completed=False).status_code == 200
    patch(client, pid, selected_crop_id=top_crop(p))
    # a gate reverting to not_ready locks the plant tasks again
    g = next(g for g in p["workflow"]["next_action"]["readiness_gate"] if g["required"])
    for t in g["satisfied_by_tasks"]:
        patch(client, pid, task_id=t, completed=False)
    full = client.get(f"/api/plans/{pid}").json()
    assert full["workflow"]["next_action"]["planting_readiness"] == "not_ready"
    assert sow_card(client, pid)["locked_reason"] == "pass_gate"
    assert full["steps_status"]["planting_method"] == "blocked"


def test_prepare_and_readiness_tasks_are_never_locked(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    for r in walk_recs(p["workflow"]):
        if r["task_id"] and r["phase"] in ("prepare", "readiness"):
            resp = patch(client, pid, task_id=r["task_id"])
            assert resp.status_code == 200, (r["task_id"], resp.text)


# ------------------------------------------------------------------ steps_status ordering
def test_steps_status_order(client, kb):
    p = plan(client, {"description": STANDARD})
    st = p["steps_status"]
    assert st["next_action"] == "in_progress"
    assert st["planting_method"] == st["ongoing_care"] == st["harvest"] == "blocked"
    assert st["crop_suggestions"] == "ready"


# ------------------------------------------------------------------ assistant follows the same order
def _ask(client, p):
    return client.post("/api/assistant/ask", json={"question": "what should I do next?",
                                                   "plan_id": p["plan_id"]}).json()


def test_assistant_next_step_follows_workflow_order(client, kb):
    p = plan(client, {"description": STANDARD})
    pid = p["plan_id"]
    a = _ask(client, p)
    assert a["refused"] is False and a["answer"].startswith(p["workflow"]["next_action"]["next_best_action"])
    # open gate lines: prepare-phase tasks are listed before readiness ones
    gates = {g["label"]: g for g in p["workflow"]["next_action"]["readiness_gate"]}
    order = []
    for line in a["answer"].splitlines():
        if line.startswith("- "):
            label = line[2:].split(":")[0]
            g = gates[label]
            task = next(t for t in g["satisfied_by_tasks"] if t in kb.task_ids)
            order.append({"prepare": 0, "readiness": 1, "plant": 2}[task_phase(kb, task)])
    assert order and order == sorted(order)
    assert "choose a crop" not in a["answer"].lower()

    pass_all_gates(client, kb, p)
    a = _ask(client, p)
    assert "choose a crop" in a["answer"].lower() and a["refused"] is False
    assert any(m["kb_id"] == top_crop(p) for m in a["matched"])

    patch(client, pid, selected_crop_id=top_crop(p))
    a = _ask(client, p)
    assert a["answer"].splitlines()[-1].startswith("Next, plant:")
    assert any(m["kb_id"].startswith("plant_") for m in a["matched"])
    assert all(kb.has(i) for i in a["evidence"]["kb_ids"])
