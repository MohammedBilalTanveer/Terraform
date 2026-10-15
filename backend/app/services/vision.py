"""Optional tentative photo cue suggestions (POST /api/uploads/{photo_id}/analyze). OFF by default.

Enabled only if ENABLE_VISION=true AND OPENAI_API_KEY AND OPENAI_VISION_MODEL are set AND `openai` imports.
The model is asked ONLY which tags of an allow-list of visible cues (colour, texture, rock lumps, crust,
pooling, erosion marks, vegetation, slope) are visibly present, as JSON. Its output is filtered to that
allow-list and to tags that exist in the KB cue vocabulary; labels come from the KB cues. Suggestions are
never used until the user confirms them (ObservationInput.photo_confirmed_tags). Never soil chemistry,
depth or hard-layer continuity. Any error or the timeout (20 s) -> "failed" with an honest message.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import List

from ..config import Settings
from .kb_loader import KnowledgeBase
from .tagging import VISIBLE_PHOTO_TAGS

MSG_TENTATIVE = ("Tentative visual cues — confirm each one; a photo cannot show soil chemistry, depth or "
                 "hardpan continuity.")
MSG_NOT_ENABLED = "Photo attached; visual analysis is not enabled. The text description was used."
MSG_FAILED = "Visual analysis could not be completed for this photo. The text description was used."

PROMPT = (
    "You look at a photo of farmland. From this allow-list of VISIBLE cue tags, return only those clearly "
    "visible in the photo: {tags}. Do not guess soil chemistry, soil depth or whether a hard layer is continuous. "
    'Reply as JSON: {{"tags": ["..."]}}. Return an empty list if unsure.'
)


def vision_available(settings: Settings) -> bool:
    if not settings.vision_configured:
        return False
    try:
        import openai  # noqa: F401
    except Exception:
        return False
    return True


def allowed_tags(kb: KnowledgeBase) -> List[str]:
    vocab = {c.get("tag") for c in kb.records("observation_cues")}
    return [t for t in VISIBLE_PHOTO_TAGS if t in vocab]


def filter_suggestions(kb: KnowledgeBase, raw_tags) -> List[dict]:
    allow = allowed_tags(kb)
    cue_by_tag = {}
    for c in kb.records("observation_cues"):
        cue_by_tag.setdefault(c.get("tag"), c)
    out = []
    for t in raw_tags if isinstance(raw_tags, list) else []:
        if isinstance(t, str) and t in allow and t not in [o["tag"] for o in out]:
            cue = cue_by_tag[t]
            out.append({"tag": t, "label": str(cue.get("label") or t), "cue_id": cue.get("id")})
    return out


def suggest_tags(settings: Settings, kb: KnowledgeBase, path: Path, media_type: str) -> dict:
    enabled = vision_available(settings)
    if not enabled:
        return {"vision_enabled": False, "analysis_status": "not_enabled", "message": MSG_NOT_ENABLED, "suggested": []}
    try:
        from openai import OpenAI

        data_url = f"data:{media_type};base64," + base64.b64encode(path.read_bytes()).decode("ascii")
        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.vision_timeout_seconds, max_retries=0)
        resp = client.chat.completions.create(
            model=settings.openai_vision_model,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": PROMPT.format(tags=", ".join(allowed_tags(kb)))},
                {"type": "image_url", "image_url": {"url": data_url}},
            ]}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        parsed = json.loads(resp.choices[0].message.content or "{}")
        suggested = filter_suggestions(kb, parsed.get("tags") if isinstance(parsed, dict) else [])
        return {"vision_enabled": True, "analysis_status": "analyzed_tentative", "message": MSG_TENTATIVE,
                "suggested": suggested}
    except Exception:
        return {"vision_enabled": True, "analysis_status": "failed", "message": MSG_FAILED, "suggested": []}
