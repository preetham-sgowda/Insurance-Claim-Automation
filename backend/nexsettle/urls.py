"""
NexSettle URL Configuration — Root Router
"""

from django.urls import path, include
from django.urls import re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from .frontend_views import serve_frontend


def health_check(request):
    return JsonResponse({"status": "ok", "service": "NexSettle API", "version": "1.0.0"})


urlpatterns = [
    path("api/health/",    health_check,                         name="health-check-api"),
    path("api/auth/",      include("apps.authentication.urls")),
    path("api/claims/",    include("apps.claims.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/pipeline/",  include("apps.ai_pipeline.urls")),
    path("api/reports/",   include("apps.reports.urls")),
    path("api/agent/",     include("apps.agents.urls")),
    path("api/admin-panel/", include("apps.admins.urls")),
    path("api/fraud/",     include("apps.fraud_detection.urls")),
    # Frontend routes
    path("", serve_frontend, {"path": "index.html"}, name="frontend-index"),
    re_path(
        r"^(?P<path>(?:css/.*|js/.*|pages/.*|index\.html|favicon\.ico))$",
        serve_frontend,
        name="frontend-assets",
    ),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
