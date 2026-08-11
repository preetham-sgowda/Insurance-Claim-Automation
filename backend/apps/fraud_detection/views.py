"""
NexSettle — Fraud Detection App Views
GET /api/fraud/ — retrieve fraud logs (admin only)
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from db.mongo_client import get_collection, Collections
from utils.jwt_utils import get_user_from_request

logger = logging.getLogger("nexsettle")


class FraudLogsView(APIView):
    """GET /api/fraud/logs/ — View all fraud-flagged claims."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") not in ["admin", "agent"]:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        fraud_claims = list(claims_col.find({"fraud_flag": True}))

        serialized = []
        for c in fraud_claims:
            c["_id"] = str(c["_id"])
            for k, v in c.items():
                if hasattr(v, "isoformat"):
                    c[k] = v.isoformat()
            serialized.append({
                "claim_id": c.get("claim_id"),
                "user_unique_id": c.get("user_unique_id"),
                "fraud_reasons": c.get("fraud_reasons", []),
                "claim_status": c.get("claim_status"),
                "created_at": c.get("created_at"),
            })

        return Response({"total_fraud_claims": len(serialized), "fraud_claims": serialized}, status=status.HTTP_200_OK)
