"""
NexSettle — ID Generator Utilities
"""

import random
import string
from datetime import datetime, timezone


def generate_user_id(counter: int) -> str:
    """USR_0001 format"""
    return f"USR_{counter:04d}"


def generate_claim_id(counter: int) -> str:
    """CLM_1001 format"""
    return f"CLM_{1000 + counter}"


def generate_agent_id(counter: int) -> str:
    """AGT_001 format"""
    return f"AGT_{counter:03d}"


def generate_admin_id(counter: int) -> str:
    """ADM_001 format"""
    return f"ADM_{counter:03d}"


def generate_otp() -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=6))


def now_utc():
    """Return current UTC datetime."""
    return datetime.now(tz=timezone.utc)
