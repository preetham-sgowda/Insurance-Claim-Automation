from django.urls import path
from .views import ClaimReportDownloadView

urlpatterns = [
    path("<str:claim_id>/download/", ClaimReportDownloadView.as_view(), name="report-download"),
]
