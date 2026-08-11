from django.urls import path
from .views import (
    AdminLoginView, AdminDashboardView, AdminClaimsView,
    AdminApproveClaim, AdminRejectClaim, AdminCreateAgent,
    AdminListAgents, AdminSettleClaim, AdminPolicyHolderView,
)

urlpatterns = [
    path("login/",                              AdminLoginView.as_view(),        name="admin-login"),
    path("dashboard/",                          AdminDashboardView.as_view(),    name="admin-dashboard"),
    path("claims/",                             AdminClaimsView.as_view(),       name="admin-claims"),
    path("claims/<str:claim_id>/approve/",      AdminApproveClaim.as_view(),     name="admin-approve"),
    path("claims/<str:claim_id>/reject/",       AdminRejectClaim.as_view(),      name="admin-reject"),
    path("claims/<str:claim_id>/settle/",       AdminSettleClaim.as_view(),      name="admin-settle"),
    path("agents/",                             AdminListAgents.as_view(),       name="admin-list-agents"),
    path("agents/create/",                      AdminCreateAgent.as_view(),      name="admin-create-agent"),
    path("policy-holders/",                     AdminPolicyHolderView.as_view(), name="admin-policy-holders"),
]
