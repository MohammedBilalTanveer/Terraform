"""POST /api/assistant/ask — answers only with verbatim KB text, or refuses."""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..deps import require_kb, settings_of, store_of
from ..schemas import AskRequest, AskResponse
from ..services import llm_rewriter
from ..services.assistant_search import answer, record_answer_text
from ..services.evidence import make_evidence

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/ask", response_model=AskResponse)
def ask(body: AskRequest, request: Request):
    kb = require_kb(request)
    store = store_of(request)
    prefer = set()
    plan_id = body.plan_id
    if not plan_id and body.session_id:
        sess = store.get("sessions", body.session_id)
        plan_id = sess.get("plan_id") if sess else None
    if plan_id:
        plan = store.get("plans", plan_id)
        if plan:
            prefer = set((plan.get("evidence") or {}).get("kb_ids") or [])
    res = answer(kb, body.question or "", prefer, body.step_id)
    text, used = res["answer"], False
    if not res["refused"]:
        facts = []
        for m in res["matched"]:
            rec = kb.get(m["kb_id"]) or {}
            facts.append(record_answer_text(rec) if rec else m["snippet"])
            for rid in rec.get("related_kb_ids") or []:  # FAQ / troubleshooting: related record text
                rel = kb.get(rid)
                if rel:
                    facts.append(record_answer_text(rel))
        text, used = llm_rewriter.rewrite(settings_of(request), kb, res["answer"], facts)
    return {
        "answer": text,
        "refused": res["refused"],
        "matched": res["matched"],
        "generation_mode": "llm_rewrite" if used else "deterministic",
        "llm_used": used,
        "evidence": make_evidence(kb, res["kb_ids"]),
    }
