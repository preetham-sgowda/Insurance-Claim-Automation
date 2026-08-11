"""
NexSettle — Input Validators
"""

import re


def validate_aadhaar(aadhaar: str) -> bool:
    """Validate 12-digit Aadhaar number."""
    clean = re.sub(r"\s", "", aadhaar or "")
    return bool(re.fullmatch(r"\d{12}", clean))


def validate_pan(pan: str) -> bool:
    """Validate PAN format: ABCDE1234F"""
    return bool(re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", (pan or "").upper()))


def validate_ifsc(ifsc: str) -> bool:
    """Validate IFSC code format."""
    return bool(re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", (ifsc or "").upper()))


def validate_email(email: str) -> bool:
    """Basic email format validation."""
    return bool(re.fullmatch(r"[^@]+@[^@]+\.[^@]+", (email or "")))


def validate_password(password: str) -> tuple[bool, str]:
    """
    Password must be at least 8 chars, contain uppercase, lowercase,
    digit, and special character.
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        return False, "Password must contain at least one special character."
    return True, "OK"


def normalize_date(date_str: str) -> str | None:
    """
    Attempt to normalize various date formats to YYYY-MM-DD.
    Returns None if parsing fails.
    """
    from dateutil import parser as dateutil_parser
    try:
        dt = dateutil_parser.parse(date_str, dayfirst=True)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None
