from django.urls import path
from .views import DocumentUploadView, DocumentRetrieveView

urlpatterns = [
    path("upload/",           DocumentUploadView.as_view(),   name="documents-upload"),
    path("<str:claim_id>/",   DocumentRetrieveView.as_view(), name="documents-retrieve"),
]
