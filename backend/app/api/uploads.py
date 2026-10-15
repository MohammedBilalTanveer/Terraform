"""Land photo upload (stored only; visual analysis is not enabled)."""
from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import FileResponse

from ..deps import settings_of
from ..errors import AppError
from ..deps import kb_of
from ..schemas import PhotoAnalyzeResponse, PhotoUploadResponse
from ..services import vision

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
EXT_TO_TYPE = {v: k for k, v in ALLOWED.items()}
PHOTO_MESSAGE = "Photo attached; visual analysis is not enabled. The text description was used."
_ID = re.compile(r"^[a-f0-9]{32}$")


def sniff(head: bytes) -> Optional[str]:
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def find_photo(upload_dir: Path, photo_id: str) -> Optional[Path]:
    if not photo_id or not _ID.match(photo_id):
        return None
    for ext in EXT_TO_TYPE:
        p = upload_dir / f"{photo_id}.{ext}"
        if p.exists():
            return p
    return None


@router.post("/land-photo", response_model=PhotoUploadResponse)
async def upload_land_photo(request: Request, file: UploadFile = File(...)):
    settings = settings_of(request)
    declared = (file.content_type or "").split(";")[0].strip().lower()
    if declared == "image/jpg":
        declared = "image/jpeg"
    if declared not in ALLOWED:
        raise AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG or WEBP photos can be attached.")
    limit = settings.max_upload_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise AppError(413, "FILE_TOO_LARGE", f"The photo is larger than {limit // (1024 * 1024)} MB.")
    if not data:
        raise AppError(415, "UNSUPPORTED_MEDIA_TYPE", "The uploaded file is empty.")
    actual = sniff(data[:16])
    if actual is None or actual != declared:
        raise AppError(415, "UNSUPPORTED_MEDIA_TYPE",
                       "The file content is not a valid JPEG, PNG or WEBP image matching its declared type.")
    photo_id = uuid.uuid4().hex
    filename = f"{photo_id}.{ALLOWED[actual]}"
    try:
        settings.upload_directory.mkdir(parents=True, exist_ok=True)
        (settings.upload_directory / filename).write_bytes(data)
    except OSError as exc:
        raise AppError(500, "UPLOAD_SAVE_FAILED", f"The photo could not be saved ({exc.__class__.__name__}).", True)
    return {
        "photo_id": photo_id,
        "filename": filename,
        "media_type": actual,
        "size_bytes": len(data),
        "url": f"/api/uploads/{photo_id}",
        "analysis_status": "attached_not_analyzed",
        "message": PHOTO_MESSAGE,
    }


@router.post("/{photo_id}/analyze", response_model=PhotoAnalyzeResponse)
def analyze_photo(photo_id: str, request: Request):
    settings = settings_of(request)
    p = find_photo(settings.upload_directory, photo_id)
    if p is None:
        raise AppError(404, "PHOTO_NOT_FOUND", f"No photo with id '{photo_id}'.")
    result = vision.suggest_tags(settings, kb_of(request), p, EXT_TO_TYPE[p.suffix.lstrip(".")])
    return {"photo_id": photo_id, **result}


@router.get("/{photo_id}")
def get_photo(photo_id: str, request: Request):
    p = find_photo(settings_of(request).upload_directory, photo_id)
    if p is None:
        raise AppError(404, "PHOTO_NOT_FOUND", f"No photo with id '{photo_id}'.")
    return FileResponse(p, media_type=EXT_TO_TYPE[p.suffix.lstrip(".")])
