from django.urls import path
from .views import ProcessDocumentsView

urlpatterns = [
    path("process/", ProcessDocumentsView.as_view(), name="pipeline-process"),
]
