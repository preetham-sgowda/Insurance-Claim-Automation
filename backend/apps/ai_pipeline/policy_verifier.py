"""
NexSettle — Policy Verifier Agent
Cross-checks extracted claim data against MongoDB policy_holder_data.
"""

import logging
from db.mongo_client import get_collection, Collections

logger = logging.getLogger("nexsettle")


def verify_policy(user_unique_id: str, documents: list) -> dict:
    """
    Verify extracted document data against pre-existing policy holder data in MongoDB.

    Args:
        user_unique_id: The USR_xxxx ID of the claimant.
        documents: List of extracted document dicts from the AI pipeline.

    Returns:
        {
            "verified": bool,
            "policy_number": str or None,
            "verification_notes": List[str],
            "claim_type": "natural_death" | "accidental_death" | "unknown"
        }
    """
    notes = []

    # Fetch policy holder data
    policy_col = get_collection(Collections.POLICY_HOLDER_DATA)
    policy_data = policy_col.find_one({"user_unique_id": user_unique_id})

    if not policy_data:
        return {
            "verified": False,
            "policy_number": None,
            "verification_notes": ["No policy holder data found for this user."],
            "claim_type": "unknown",
        }

    policy_number = policy_data.get("policy_number")

    # Extract relevant data from pipeline documents
    doc_by_type = {d["document_type"]: d.get("extracted_data", {}) for d in documents}

    # Verify Aadhaar
    extracted_aadhaar = doc_by_type.get("aadhaar", {}).get("aadhaar_number")
    stored_aadhaar_masked = policy_data.get("aadhaar_id", "")
    if extracted_aadhaar and stored_aadhaar_masked:
        # Compare last 4 digits only (since stored is masked)
        if extracted_aadhaar[-4:] != stored_aadhaar_masked[-4:]:
            notes.append("Aadhaar mismatch with policy records.")
        else:
            notes.append("Aadhaar verified against policy records.")

    # Verify PAN
    extracted_pan = doc_by_type.get("pan", {}).get("pan_number")
    stored_pan_masked = policy_data.get("pan_id", "")
    if extracted_pan and stored_pan_masked:
        if extracted_pan[-5:].upper() != stored_pan_masked[-5:].upper():
            notes.append("PAN mismatch with policy records.")
        else:
            notes.append("PAN verified against policy records.")

    # Determine claim type
    claim_type = "unknown"
    if "fir" in doc_by_type or "hospital_record" in doc_by_type:
        if "fir" in doc_by_type:
            claim_type = "accidental_death"
        else:
            claim_type = "natural_death"
    elif "death_certificate" in doc_by_type:
        cause = doc_by_type["death_certificate"].get("cause_of_death", "").lower()
        if any(kw in cause for kw in ["accident", "murder", "homicide", "drowning", "fire"]):
            claim_type = "accidental_death"
        else:
            claim_type = "natural_death"

    verified = len([n for n in notes if "mismatch" in n]) == 0

    return {
        "verified": verified,
        "policy_number": policy_number,
        "verification_notes": notes,
        "claim_type": claim_type,
    }
