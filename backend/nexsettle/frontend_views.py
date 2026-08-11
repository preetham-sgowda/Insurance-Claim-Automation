"""
Serve frontend static pages directly from Django for local full-stack usage.
"""

import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404


def _resolve_frontend_path(relative_path: str) -> Path:
    frontend_root = Path(settings.FRONTEND_DIR).resolve()
    candidate = (frontend_root / relative_path).resolve()
    if not str(candidate).startswith(str(frontend_root)):
        raise Http404("Invalid path")
    if not candidate.exists() or not candidate.is_file():
        raise Http404("File not found")
    return candidate


def serve_frontend(request, path: str = "index.html"):
    if not path:
        path = "index.html"

    file_path = _resolve_frontend_path(path)
    content_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(open(file_path, "rb"), content_type=content_type or "application/octet-stream")

