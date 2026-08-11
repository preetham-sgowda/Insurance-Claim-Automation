"""
NexSettle — Claims App Views
"""

import logging
from bson import ObjectId
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from db.mongo_client import get_collection, Collections
from utils.jwt_utils import get_user_from_request
from utils.id_generators import now_utc

logger = logging.getLogger("nexsettle")


def _serialize_claim(claim: dict) -> dict:
    """Convert MongoDB document to JSON-safe dict."""
    claim["_id"] = str(claim["_id"])
    for k, v in claim.items():
        if hasattr(v, "isoformat"):
            claim[k] = v.isoformat()
    return claim


class ClaimListView(APIView):
    """GET /api/claims/list/ — List claims for the authenticated user."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        claims = list(claims_col.find({"user_unique_id": user_data["user_id"]}))
        return Response(
            {"claims": [_serialize_claim(c) for c in claims]},
            status=status.HTTP_200_OK,
        )


class ClaimDetailView(APIView):
    """GET /api/claims/<claim_id>/ — Get a specific claim."""

    def get(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        claim = claims_col.find_one({"claim_id": claim_id, "user_unique_id": user_data["user_id"]})

        if not claim:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(_serialize_claim(claim), status=status.HTTP_200_OK)


class ClaimStatusUpdateView(APIView):
    """PATCH /api/claims/<claim_id>/status/ — Update claim status (agent/admin)."""

    def patch(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        if user_data.get("role") not in ["agent", "admin"]:
            return Response({"error": "Insufficient permissions."}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get("claim_status")
        valid_statuses = [
            "verification_pending", "under_review", "approved",
            "rejected", "fraud_detected", "settled",
        ]

        if new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status. Choose from: {', '.join(valid_statuses)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        claims_col = get_collection(Collections.CLAIMS)
        result = claims_col.update_one(
            {"claim_id": claim_id},
            {
                "$set": {
                    "claim_status": new_status,
                    "updated_at": now_utc(),
                    "updated_by": user_data.get("user_id") or user_data.get("agent_id") or user_data.get("admin_id"),
                }
            },
        )

        if result.matched_count == 0:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": f"Claim status updated to '{new_status}'."}, status=status.HTTP_200_OK)


class AllClaimsView(APIView):
    """GET /api/claims/all/ — All claims (admin only)."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 20))
        skip = (page - 1) * limit

        total = claims_col.count_documents({})
        claims = list(claims_col.find({}).skip(skip).limit(limit).sort("created_at", -1))

        return Response(
            {
                "total": total,
                "page": page,
                "limit": limit,
                "claims": [_serialize_claim(c) for c in claims],
            },
            status=status.HTTP_200_OK,
        )
