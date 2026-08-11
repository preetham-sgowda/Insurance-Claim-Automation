from django.urls import path
from .views import ClaimListView, ClaimDetailView, ClaimStatusUpdateView, AllClaimsView

urlpatterns = [
    path("list/",                ClaimListView.as_view(),         name="claims-list"),
    path("all/",                 AllClaimsView.as_view(),          name="claims-all"),
    path("<str:claim_id>/",      ClaimDetailView.as_view(),        name="claims-detail"),
    path("<str:claim_id>/status/", ClaimStatusUpdateView.as_view(), name="claims-status"),
]
