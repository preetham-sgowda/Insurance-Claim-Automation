"""
NexSettle — Admins App Views
Admin login, full claim management, agent management, policy holder data.
"""

import logging
import bcrypt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from db.mongo_client import get_collection, Collections
from utils.jwt_utils import generate_token, get_user_from_request
from utils.id_generators import generate_admin_id, generate_agent_id, now_utc

logger = logging.getLogger("nexsettle")


class AdminLoginView(APIView):
    """POST /api/admin-panel/login/"""

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response({"error": "Email and password required."}, status=status.HTTP_400_BAD_REQUEST)

        admins_col = get_collection(Collections.ADMINS)
        admin = admins_col.find_one({"email": email})

        if not admin or not bcrypt.checkpw(password.encode(), admin["password"].encode()):
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        token = generate_token({
            "admin_id": admin["admin_id"],
            "email": admin["email"],
            "role": "admin",
        })

        return Response({
            "message": "Admin logged in.",
            "token": token,
            "admin": {
                "admin_id": admin["admin_id"],
                "name": admin["name"],
                "email": admin["email"],
            },
        }, status=status.HTTP_200_OK)


class AdminDashboardView(APIView):
    """GET /api/admin-panel/dashboard/ — High-level stats."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col  = get_collection(Collections.CLAIMS)
        users_col   = get_collection(Collections.USERS)
        agents_col  = get_collection(Collections.AGENTS)

        stats = {
            "total_claims":    claims_col.count_documents({}),
            "pending_claims":  claims_col.count_documents({"claim_status": "verification_pending"}),
            "approved_claims": claims_col.count_documents({"claim_status": "approved"}),
            "fraud_claims":    claims_col.count_documents({"fraud_flag": True}),
            "settled_claims":  claims_col.count_documents({"claim_status": "settled"}),
            "total_users":     users_col.count_documents({}),
            "total_agents":    agents_col.count_documents({}),
        }
        return Response(stats, status=status.HTTP_200_OK)


class AdminClaimsView(APIView):
    """GET /api/admin-panel/claims/ — All claims with filters."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        query = {}

        # Optional filters
        claim_status = request.query_params.get("status")
        fraud = request.query_params.get("fraud")
        if claim_status:
            query["claim_status"] = claim_status
        if fraud is not None:
            query["fraud_flag"] = fraud.lower() == "true"

        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 20))
        skip = (page - 1) * limit

        total = claims_col.count_documents(query)
        claims = list(claims_col.find(query).skip(skip).limit(limit).sort("created_at", -1))

        serialized = []
        for c in claims:
            c["_id"] = str(c["_id"])
            for k, v in c.items():
                if hasattr(v, "isoformat"):
                    c[k] = v.isoformat()
            serialized.append(c)

        return Response({"total": total, "page": page, "claims": serialized}, status=status.HTTP_200_OK)


class AdminApproveClaim(APIView):
    """PATCH /api/admin-panel/claims/<claim_id>/approve/"""

    def patch(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        result = claims_col.update_one(
            {"claim_id": claim_id},
            {"$set": {"claim_status": "approved", "approved_by": user_data.get("admin_id"), "approved_at": now_utc()}},
        )
        if result.matched_count == 0:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": f"Claim {claim_id} approved."}, status=status.HTTP_200_OK)


class AdminRejectClaim(APIView):
    """PATCH /api/admin-panel/claims/<claim_id>/reject/"""

    def patch(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        reason = request.data.get("reason", "")
        claims_col = get_collection(Collections.CLAIMS)
        result = claims_col.update_one(
            {"claim_id": claim_id},
            {"$set": {
                "claim_status": "rejected",
                "rejection_reason": reason,
                "rejected_by": user_data.get("admin_id"),
                "rejected_at": now_utc(),
            }},
        )
        if result.matched_count == 0:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": f"Claim {claim_id} rejected."}, status=status.HTTP_200_OK)


class AdminCreateAgent(APIView):
    """POST /api/admin-panel/agents/create/ — Create a new agent account."""

    def post(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        agent_name = data.get("agent_name", "").strip()
        agent_email = data.get("agent_email", "").strip().lower()
        agent_password = data.get("agent_password", "")

        if not all([agent_name, agent_email, agent_password]):
            return Response({"error": "agent_name, agent_email, and agent_password are required."}, status=status.HTTP_400_BAD_REQUEST)

        agents_col = get_collection(Collections.AGENTS)
        if agents_col.find_one({"agent_email": agent_email}):
            return Response({"error": "Agent with this email already exists."}, status=status.HTTP_409_CONFLICT)

        count = agents_col.count_documents({})
        agent_id = generate_agent_id(count + 1)
        hashed = bcrypt.hashpw(agent_password.encode(), bcrypt.gensalt()).decode()

        agents_col.insert_one({
            "agent_id": agent_id,
            "agent_name": agent_name,
            "agent_email": agent_email,
            "agent_password": hashed,
            "created_at": now_utc(),
        })

        return Response({
            "message": "Agent account created.",
            "agent_id": agent_id,
            "agent_email": agent_email,
        }, status=status.HTTP_201_CREATED)


class AdminListAgents(APIView):
    """GET /api/admin-panel/agents/ — List all agents."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        agents_col = get_collection(Collections.AGENTS)
        agents = list(agents_col.find({}, {"agent_password": 0, "_id": 0}))
        for a in agents:
            for k, v in a.items():
                if hasattr(v, "isoformat"):
                    a[k] = v.isoformat()

        return Response({"total": len(agents), "agents": agents}, status=status.HTTP_200_OK)


class AdminSettleClaim(APIView):
    """PATCH /api/admin-panel/claims/<claim_id>/settle/ — Mark claim as settled."""

    def patch(self, request, claim_id):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        claims_col = get_collection(Collections.CLAIMS)
        result = claims_col.update_one(
            {"claim_id": claim_id},
            {"$set": {"claim_status": "settled", "settled_by": user_data.get("admin_id"), "settled_at": now_utc()}},
        )
        if result.matched_count == 0:
            return Response({"error": "Claim not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"message": f"Claim {claim_id} marked as settled."}, status=status.HTTP_200_OK)


class AdminPolicyHolderView(APIView):
    """GET/POST /api/admin-panel/policy-holders/ — View or add policy holder records."""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        policy_col = get_collection(Collections.POLICY_HOLDER_DATA)
        user_id = request.query_params.get("user_id")
        query = {"user_unique_id": user_id} if user_id else {}
        records = list(policy_col.find(query, {"_id": 0}))
        for r in records:
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()

        return Response({"total": len(records), "records": records}, status=status.HTTP_200_OK)

    def post(self, request):
        user_data = get_user_from_request(request)
        if not user_data or user_data.get("role") != "admin":
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        user_unique_id = data.get("user_unique_id", "").strip()
        policy_number = data.get("policy_number", "").strip()

        if not user_unique_id or not policy_number:
            return Response({"error": "user_unique_id and policy_number are required."}, status=status.HTTP_400_BAD_REQUEST)

        policy_col = get_collection(Collections.POLICY_HOLDER_DATA)
        existing = policy_col.find_one({"user_unique_id": user_unique_id})

        record = {
            "user_unique_id": user_unique_id,
            "policy_number": policy_number,
            "aadhaar_id": data.get("aadhaar_id", ""),
            "pan_id": data.get("pan_id", ""),
            "passport_id": data.get("passport_id", ""),
            "voter_id": data.get("voter_id", ""),
            "driving_license": data.get("driving_license", ""),
            "medical_history": data.get("medical_history", ""),
            "lifestyle_habits": data.get("lifestyle_habits", ""),
            "sum_assured": data.get("sum_assured", 1000000),
            "updated_at": now_utc(),
        }

        if existing:
            policy_col.update_one({"user_unique_id": user_unique_id}, {"$set": record})
            return Response({"message": "Policy holder record updated.", "user_unique_id": user_unique_id}, status=status.HTTP_200_OK)
        else:
            record["created_at"] = now_utc()
            policy_col.insert_one(record)
            return Response({"message": "Policy holder record created.", "user_unique_id": user_unique_id}, status=status.HTTP_201_CREATED)
