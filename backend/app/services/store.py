"""JSON-file persistence for sessions, analyses and plans (DATA_DIRECTORY/<kind>/<id>.json).

Writes are atomic (temp file in the same directory + os.replace). If the directory cannot be
written, the store keeps working in memory only.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
from pathlib import Path
from typing import Dict, Optional

KINDS = ("sessions", "plans", "analyses")
_SAFE_ID = re.compile(r"^[A-Za-z0-9_\-]{1,80}$")


class Store:
    def __init__(self, data_dir: Optional[Path], persist: bool = True):
        self._mem: Dict[str, Dict[str, dict]] = {k: {} for k in KINDS}
        self._lock = threading.Lock()
        self.data_dir = Path(data_dir) if data_dir else None
        self.persist = bool(persist and data_dir)
        if self.persist:
            try:
                for k in KINDS:
                    (self.data_dir / k).mkdir(parents=True, exist_ok=True)
            except OSError:
                self.persist = False

    def _path(self, kind: str, item_id: str) -> Optional[Path]:
        if not self.persist or not _SAFE_ID.match(item_id or ""):
            return None
        return self.data_dir / kind / f"{item_id}.json"

    def put(self, kind: str, item_id: str, data: dict) -> None:
        with self._lock:
            self._mem[kind][item_id] = data
            path = self._path(kind, item_id)
            if path is None:
                return
            try:
                fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp_", suffix=".json")
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=1, default=_default)
                os.replace(tmp, path)
            except OSError:
                try:
                    os.unlink(tmp)  # type: ignore[possibly-undefined]
                except Exception:
                    pass

    def get(self, kind: str, item_id: str) -> Optional[dict]:
        with self._lock:
            if item_id in self._mem[kind]:
                return self._mem[kind][item_id]
            path = self._path(kind, item_id)
            if path is None or not path.exists():
                return None
            try:
                with path.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
            except (OSError, json.JSONDecodeError):
                return None
            self._mem[kind][item_id] = data
            return data


def _default(o):
    if isinstance(o, set):
        return sorted(o)
    if isinstance(o, Path):
        return str(o)
    raise TypeError(f"not serialisable: {type(o)}")
