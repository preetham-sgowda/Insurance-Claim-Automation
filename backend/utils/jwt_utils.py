"""
NexSettle — JWT Authentication Utilities
"""

import jwt
import logging
from datetime import datetime, timedelta, timezone
from django.conf import settings

logger = logging.getLogger("nexsettle")


def generate_token(payload: dict, expiry_hours: int = None) -> str:
    """Generate a JWT token with expiry."""
    expiry = expiry_hours or settings.JWT_EXPIRY_HOURS
    payload = {
        **payload,
        "exp": datetime.now(tz=timezone.utc) + timedelta(hours=expiry),
        "iat": datetime.now(tz=timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token. Returns None if invalid/expired."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None


def get_user_from_request(request) -> dict | None:
    """Extract and validate user from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    return decode_token(token)
