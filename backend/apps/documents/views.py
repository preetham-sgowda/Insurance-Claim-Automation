"""
NexSettle — Documents App Views
Handles document upload tracking and retrieval.
"""

import logging
import os
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from db.mongo_client import get_collection, Collections
from utils.jwt_utils import get_user_from_request
from utils.id_generators import now_utc

logger = logging.getLogger("nexsettle")


class DocumentUploadView(APIView):
    """
    POST /api/documents/upload/
    Saves uploaded files to disk and records path in claim_documents collection.
    Note: Actual AI processing is done via /api/pipeline/process/ endpoint.
    """

    def post(self, request):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claim_id = request.data.get("claim_id", "").strip()
        if not claim_id:
            return Response({"error": "claim_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_files = request.FILES
        if not uploaded_files:
            return Response({"error": "No files provided."}, status=status.HTTP_400_BAD_REQUEST)

        ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}

        saved_paths = {}
        upload_dir = os.path.join(str(settings.MEDIA_ROOT), "claims", claim_id)
        os.makedirs(upload_dir, exist_ok=True)

        for field_name, f in uploaded_files.items():
            if f.content_type not in ALLOWED_MIME:
                return Response(
                    {"error": f"File '{f.name}' has unsupported type: {f.content_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            safe_name = f.name.replace(" ", "_")
            file_path = os.path.join(upload_dir, safe_name)
            with open(file_path, "wb") as out:
                for chunk in f.chunks():
                    out.write(chunk)

            relative_path = os.path.join("claims", claim_id, safe_name)
            saved_paths[field_name] = relative_path

        # Upsert into claim_documents collection
        docs_col = get_collection(Collections.CLAIM_DOCUMENTS)
        docs_col.update_one(
            {"claim_id": claim_id},
            {
                "$set": {
                    "claim_id": claim_id,
                    "uploaded_at": now_utc(),
                    **saved_paths,
                }
            },
            upsert=True,
        )

        return Response(
            {"message": "Documents saved.", "claim_id": claim_id, "saved_files": saved_paths},
            status=status.HTTP_200_OK,
        )


class DocumentRetrieveView(APIView):
    """GET /api/documents/<claim_id>/ — Get document paths for a claim."""

    def get(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        docs_col = get_collection(Collections.CLAIM_DOCUMENTS)
        doc = docs_col.find_one({"claim_id": claim_id}, {"_id": 0})

        if not doc:
            return Response({"error": "No documents found for this claim."}, status=status.HTTP_404_NOT_FOUND)

        for k, v in doc.items():
            if hasattr(v, "isoformat"):
                doc[k] = v.isoformat()

        return Response(doc, status=status.HTTP_200_OK)
