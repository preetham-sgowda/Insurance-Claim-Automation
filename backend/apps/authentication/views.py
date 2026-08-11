"""
NexSettle Authentication App views.
Handles registration, OTP verification, login, logout, and profile.
"""

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from db.mongo_client import Collections, get_collection
from utils.id_generators import generate_otp, generate_user_id, now_utc
from utils.jwt_utils import generate_token, get_user_from_request
from utils.validators import validate_email, validate_password

logger = logging.getLogger("nexsettle")


def _next_user_counter() -> int:
    col = get_collection(Collections.USERS)
    count = col.count_documents({})
    return count + 1


def _send_otp_email(email: str, otp: str) -> tuple[bool, str | None]:
    """Send OTP email and return (sent, error_message)."""
    try:
        from django.core.mail import send_mail

        send_mail(
            subject="NexSettle - OTP Verification",
            message=f"Your OTP is: {otp}\n\nThis OTP will expire in {settings.OTP_EXPIRY_MINUTES} minutes.",
            from_email=settings.EMAIL_HOST_USER or "no-reply@nexsettle.local",
            recipient_list=[email],
            fail_silently=False,
        )
        return True, None
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", email, e)
        return False, str(e)


class RegisterView(APIView):
    """POST /api/auth/register/"""

    def post(self, request):
        data = request.data
        username = data.get("username", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not username or not email or not password:
            return Response(
                {"error": "username, email, and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not validate_email(email):
            return Response({"error": "Invalid email format."}, status=status.HTTP_400_BAD_REQUEST)

        valid, msg = validate_password(password)
        if not valid:
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        users = get_collection(Collections.USERS)
        if users.find_one({"email": email}):
            return Response(
                {"error": "An account with this email already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user_id = generate_user_id(_next_user_counter())

        users.insert_one(
            {
                "user_id": user_id,
                "username": username,
                "email": email,
                "password": hashed,
                "is_active": False,
                "created_at": now_utc(),
            }
        )

        otp_code = generate_otp()
        otp_col = get_collection(Collections.OTP_VERIFICATION)
        otp_col.delete_many({"user_id": user_id})
        otp_col.insert_one(
            {
                "user_id": user_id,
                "otp_code": otp_code,
                "created_at": now_utc(),
                "expires_at": datetime.now(tz=timezone.utc)
                + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
                "is_used": False,
            }
        )

        sent, err = _send_otp_email(email, otp_code)

        logger.info("User registered: %s (%s)", user_id, email)
        payload = {
            "message": "Registration successful. Please verify your email with the OTP sent.",
            "user_id": user_id,
            "otp_delivery": "email_sent" if sent else "email_failed",
        }
        if settings.DEBUG:
            payload["debug_otp"] = otp_code
        if not sent and err:
            payload["otp_error"] = err

        return Response(payload, status=status.HTTP_201_CREATED)


class VerifyOTPView(APIView):
    """POST /api/auth/verify-otp/"""

    def post(self, request):
        data = request.data
        user_id = data.get("user_id", "").strip()
        otp_code = data.get("otp_code", "").strip()

        if not user_id or not otp_code:
            return Response(
                {"error": "user_id and otp_code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_col = get_collection(Collections.OTP_VERIFICATION)
        otp_record = otp_col.find_one({"user_id": user_id, "is_used": False})
        if not otp_record:
            return Response(
                {"error": "No valid OTP found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )

        expires_at = otp_record["expires_at"]
        if hasattr(expires_at, "replace"):
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(tz=timezone.utc) > expires_at:
            return Response(
                {"error": "OTP has expired. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record["otp_code"] != otp_code:
            return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

        otp_col.update_one({"_id": otp_record["_id"]}, {"$set": {"is_used": True}})
        users = get_collection(Collections.USERS)
        users.update_one({"user_id": user_id}, {"$set": {"is_active": True}})

        logger.info("OTP verified for user: %s", user_id)
        return Response(
            {"message": "Email verified successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )


class ResendOTPView(APIView):
    """POST /api/auth/resend-otp/"""

    def post(self, request):
        user_id = request.data.get("user_id", "").strip()
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        users = get_collection(Collections.USERS)
        user = users.find_one({"user_id": user_id})
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        otp_code = generate_otp()
        otp_col = get_collection(Collections.OTP_VERIFICATION)
        otp_col.delete_many({"user_id": user_id})
        otp_col.insert_one(
            {
                "user_id": user_id,
                "otp_code": otp_code,
                "created_at": now_utc(),
                "expires_at": datetime.now(tz=timezone.utc)
                + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
                "is_used": False,
            }
        )

        sent, err = _send_otp_email(user["email"], otp_code)
        payload = {
            "message": "A new OTP has been sent to your email."
            if sent
            else "OTP regenerated. Email delivery failed.",
            "otp_delivery": "email_sent" if sent else "email_failed",
        }
        if settings.DEBUG:
            payload["debug_otp"] = otp_code
        if not sent and err:
            payload["otp_error"] = err
        return Response(payload, status=status.HTTP_200_OK)


class LoginView(APIView):
    """POST /api/auth/login/"""

    def post(self, request):
        data = request.data
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return Response({"error": "email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        users = get_collection(Collections.USERS)
        user = users.find_one({"email": email})

        if not user:
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.get("user_id"):
            return Response(
                {"error": "Account data is incomplete. Please contact support to repair account record."},
                status=status.HTTP_409_CONFLICT,
            )

        if not user.get("is_active"):
            return Response(
                {"error": "Account not verified. Please verify your email first.", "user_id": user["user_id"]},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not bcrypt.checkpw(password.encode(), user["password"].encode()):
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        token = generate_token({"user_id": user["user_id"], "email": user["email"], "role": "user"})
        logger.info("User logged in: %s", user["user_id"])
        return Response(
            {
                "message": "Login successful.",
                "token": token,
                "user": {
                    "user_id": user["user_id"],
                    "username": user["username"],
                    "email": user["email"],
                },
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """POST /api/auth/logout/"""

    def post(self, request):
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class ProfileView(APIView):
    """GET /api/auth/profile/"""

    def get(self, request):
        user_data = get_user_from_request(request)
        if not user_data:
            return Response({"error": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        users = get_collection(Collections.USERS)
        user = users.find_one({"user_id": user_data["user_id"]}, {"_id": 0, "password": 0})
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        for k, v in user.items():
            if hasattr(v, "isoformat"):
                user[k] = v.isoformat()
        return Response(user, status=status.HTTP_200_OK)

