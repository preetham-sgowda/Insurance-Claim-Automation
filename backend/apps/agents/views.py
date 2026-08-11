"""
NexSettle — Agents App Views
Agent login, claim review, and assignment.
"""

import logging
import bcrypt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from db.mongo_client import get_collection, Collections
from utils.jwt_utils import generate_token, get_user_from_request
from utils.id_generators import generate_agent_id, now_utc

logger = logging.getLogger("nexsettle")


class AgentLoginView(APIView):
    """POST /api/agent/login/"""

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response({"error": "Email and password required."}, status=status.HTTP_400_BAD_REQUEST)

        agents_col = get_collection(Collections.AGENTS)
        agent = agents_col.find_one({"agent_email": email})

        if not agent or not bcrypt.checkpw(password.encode(), agent["agent_password"].encode()):
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        token = generate_token({
            "agent_id": agent["agent_id"],
            "email": agent["agent_email"],
            "role": "agent",
        })

        return Response({
            "message": "Agent logged in successfully.",
            "token": token,
            "agent": {
                "agent_id": agent["agent_id"],
                "agent_name": agent["agent_name"],
                "agent_email": agent["agent_email"],
            },
        }, status=status.HTTP_200_OK)


class AgentClaimsView(APIView):
    """GET /api/agent/claims/ — Claims assigned to agent or all pending claims."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "agent":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 20))
        skip = (page - 1) * limit

        query = {"claim_status": {"$in": ["verification_pending", "under_review"]}}
        total = claims_col.count_documents(query)
        claims = list(claims_col.find(query).skip(skip).limit(limit).sort("created_at", -1))

        serialized = []
        for c in claims:
            c["_id"] = str(c["_id"])
            for k, v in c.items():
                if hasattr(v, "isoformat"):
                    c[k] = v.isoformat()
            serialized.append(c)

        return Response({"total": total, "claims": serialized}, status=status.HTTP_200_OK)


class AgentReviewClaimView(APIView):
    """POST /api/agent/claims/<claim_id>/review/ — Agent adds review note."""

    def post(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "agent":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        note = request.data.get("note", "").strip()
        new_status = request.data.get("claim_status", "under_review")

        claims_col = get_collection(Collections.CLAIMS)
        result = claims_col.update_one(
            {"claim_id": claim_id},
            {
                "$set": {
                    "claim_status": new_status,
                    "agent_review_note": note,
                    "reviewed_by_agent": user_data.get("agent_id"),
                    "reviewed_at": now_utc(),
                }
            },
        )

        if result.matched_count == 0:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": "Claim reviewed.", "claim_id": claim_id, "new_status": new_status}, status=status.HTTP_200_OK)
