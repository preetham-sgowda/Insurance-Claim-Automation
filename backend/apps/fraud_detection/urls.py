from django.urls import path
from .views import FraudLogsView

urlpatterns = [
    path("logs/", FraudLogsView.as_view(), name="fraud-logs"),
]
