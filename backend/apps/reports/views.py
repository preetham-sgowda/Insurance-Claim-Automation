"""
NexSettle — Reports App Views
GET /api/reports/<claim_id>/download/ — Download claim PDF report
"""

import logging
import os
from django.conf import settings
from django.http import HttpResponse, Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from db.mongo_client import get_collection, Collections
from utils.jwt_utils import get_user_from_request
from .report_generator import generate_claim_report

logger = logging.getLogger("nexsettle")


class ClaimReportDownloadView(APIView):
    """GET /api/reports/<claim_id>/download/"""

    def get(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        # Allow user to download their own claim, agents and admins can download any
        claims_col = get_collection(Collections.CLAIMS)

        if user_data.get("role") in ["agent", "admin"]:
            claim = claims_col.find_one({"claim_id": claim_id})
        else:
            claim = claims_col.find_one({"claim_id": claim_id, "user_unique_id": user_data["user_id"]})

        if not claim:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        # Convert datetime objects for report
        for k, v in claim.items():
            if hasattr(v, "isoformat"):
                claim[k] = v.isoformat()
        claim["_id"] = str(claim["_id"])

        # Check if cached PDF exists
        report_dir = os.path.join(str(settings.MEDIA_ROOT), "reports")
        report_path = os.path.join(report_dir, f"{claim_id}_report.pdf")

        if os.path.exists(report_path):
            with open(report_path, "rb") as f:
                pdf_bytes = f.read()
        else:
            pdf_bytes = generate_claim_report(claim, output_path=report_path)

            # Save path in claim_documents
            docs_col = get_collection(Collections.CLAIM_DOCUMENTS)
            docs_col.update_one(
                {"claim_id": claim_id},
                {"$set": {"final_claim_pdf": f"reports/{claim_id}_report.pdf"}},
                upsert=True,
            )

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{claim_id}_NexSettle_Report.pdf"'
        return response
