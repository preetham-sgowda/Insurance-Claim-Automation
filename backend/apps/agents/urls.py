from django.urls import path
from .views import AgentLoginView, AgentClaimsView, AgentReviewClaimView

urlpatterns = [
    path("login/",                      AgentLoginView.as_view(),         name="agent-login"),
    path("claims/",                     AgentClaimsView.as_view(),        name="agent-claims"),
    path("claims/<str:claim_id>/review/", AgentReviewClaimView.as_view(), name="agent-review"),
]
