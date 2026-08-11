"""
NexSettle — AI Pipeline Views
POST /api/pipeline/process/
"""

import logging
import os

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from utils.jwt_utils import get_user_from_request
from utils.id_generators import generate_claim_id, now_utc
from db.mongo_client import get_collection, Collections
from .pipeline import run_pipeline
from .crew_pipeline import run_pipeline_with_crew

logger = logging.getLogger("nexsettle")

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "text/plain",
}


class ProcessDocumentsView(APIView):
    """
    POST /api/pipeline/process/
    Accepts multipart/form-data with:
      - files: one or more uploaded files
      (JWT authentication required)
    """

    def post(self, request):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        user_unique_id = user_data["user_id"]
        uploaded_files = request.FILES.getlist("files")

        if not uploaded_files:
            return Response({"error": "No files uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        # Build file list for pipeline
        files = []
        for f in uploaded_files:
            mime = f.content_type
            if mime not in ALLOWED_MIME_TYPES:
                return Response(
                    {"error": f"Unsupported file type: {mime}. Allowed: PDF, PNG, JPG, JPEG, TXT."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            files.append({
                "bytes": f.read(),
                "mime_type": mime,
                "original_name": f.name,
            })

        # Generate claim ID
        claims_col = get_collection(Collections.CLAIMS)
        count = claims_col.count_documents({})
        claim_id = generate_claim_id(count + 1)

        orchestrator = request.query_params.get("orchestrator", "").strip().lower()
        if not orchestrator:
            orchestrator = settings.AI_ORCHESTRATOR

        try:
            # Run pipeline using selected orchestrator
            if orchestrator == "crewai" and settings.USE_CREW_AI:
                result = run_pipeline_with_crew(
                    files=files,
                    user_unique_id=user_unique_id,
                    claim_id=claim_id,
                )
            else:
                result = run_pipeline(
                    files=files,
                    user_unique_id=user_unique_id,
                    claim_id=claim_id,
                )
        except Exception as e:
            logger.error(f"Pipeline error for {user_unique_id}: {e}")
            return Response(
                {"error": f"Pipeline processing failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Build final JSON response (matches spec)
        fraud_result = result.get("fraud_result", {})
        policy_result = result.get("policy_result", {})
        estimate_result = result.get("estimate_result", {})

        response_payload = {
            "status": result.get("status", "partial"),
            "claim_id": claim_id,
            "documents": [
                {
                    "document_type": d["document_type"],
                    "file_format": d.get("file_format", "unknown"),
                    "extracted_data": d.get("extracted_data", {}),
                    "confidence_score": d.get("confidence_score", 0.0),
                    "doc_status": d.get("status", "unknown"),
                }
                for d in result.get("documents", [])
            ],
            "fraud_flag": fraud_result.get("fraud_flag", False),
            "fraud_reasons": fraud_result.get("fraud_reasons", []),
            "policy_verification": {
                "verified": policy_result.get("verified", False),
                "policy_number": policy_result.get("policy_number"),
                "claim_type": policy_result.get("claim_type", "unknown"),
                "notes": policy_result.get("verification_notes", []),
            },
            "claim_estimation": {
                "estimated_claim_amount": estimate_result.get("estimated_claim_amount", 0.0),
                "basis": estimate_result.get("basis", ""),
                "sum_assured": estimate_result.get("sum_assured"),
            },
            "overall_confidence": result.get("overall_confidence", 0.0),
            "errors": result.get("errors", []),
            "agentic_orchestrator": result.get("agentic_orchestrator", "langgraph"),
            "agentic_trace": result.get("agentic_trace", {}),
        }

        # Persist claim to MongoDB
        claim_doc = {
            "claim_id": claim_id,
            "user_unique_id": user_unique_id,
            "policy_number": policy_result.get("policy_number"),
            "claim_type": policy_result.get("claim_type", "unknown"),
            "extracted_documents": response_payload["documents"],
            "fraud_flag": fraud_result.get("fraud_flag", False),
            "fraud_reasons": fraud_result.get("fraud_reasons", []),
            "estimated_claim_amount": estimate_result.get("estimated_claim_amount", 0.0),
            "claim_status": "fraud_detected" if fraud_result.get("fraud_flag") else "verification_pending",
            "overall_confidence": result.get("overall_confidence", 0.0),
            "created_at": now_utc(),
        }
        claims_col.insert_one(claim_doc)
        logger.info(f"Claim {claim_id} stored in MongoDB.")

        # Persist uploaded file paths to claim_documents collection
        docs_col = get_collection(Collections.CLAIM_DOCUMENTS)
        claim_dir = os.path.join(str(settings.MEDIA_ROOT), "claims", claim_id)
        os.makedirs(claim_dir, exist_ok=True)
        saved_files = {}

        for idx, file_info in enumerate(files, start=1):
            original_name = file_info.get("original_name", f"document_{idx}")
            safe_name = original_name.replace(" ", "_").replace("/", "_").replace("\\", "_")
            output_path = os.path.join(claim_dir, safe_name)
            with open(output_path, "wb") as out:
                out.write(file_info["bytes"])
            saved_files[f"document_{idx}"] = os.path.join("claims", claim_id, safe_name)

        docs_col.update_one(
            {"claim_id": claim_id},
            {
                "$set": {
                    "claim_id": claim_id,
                    "uploaded_at": now_utc(),
                    **saved_files,
                }
            },
            upsert=True,
        )

        return Response(response_payload, status=status.HTTP_200_OK)
