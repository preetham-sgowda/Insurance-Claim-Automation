"""
NexSettle - Claim Estimator
"""

import logging

from db.mongo_client import Collections, get_collection

logger = logging.getLogger("nexsettle")

NATURAL_DEATH_PAYOUT_RATIO = 1.0
ACCIDENTAL_DEATH_PAYOUT_RATIO = 2.0


def estimate_claim(
    user_unique_id: str,
    claim_type: str,
    fraud_flag: bool,
    documents: list,
) -> dict:
    if fraud_flag:
        return {
            "estimated_claim_amount": 0.0,
            "basis": "Claim rejected due to fraud detection.",
            "sum_assured": None,
        }

    policy_col = get_collection(Collections.POLICY_HOLDER_DATA)
    policy_data = policy_col.find_one({"user_unique_id": user_unique_id}) or {}

    sum_assured = None
    doc_by_type = {d["document_type"]: d.get("extracted_data", {}) for d in documents}

    if "policy" in doc_by_type:
        sa = doc_by_type["policy"].get("sum_assured")
        if isinstance(sa, (int, float)):
            sum_assured = float(sa)

    if sum_assured is None:
        policy_sa = policy_data.get("sum_assured")
        if isinstance(policy_sa, (int, float)):
            sum_assured = float(policy_sa)

    if sum_assured is None:
        sum_assured = 1_000_000.0

    if claim_type == "accidental_death":
        payout = sum_assured * ACCIDENTAL_DEATH_PAYOUT_RATIO
        basis = f"Accidental death - double indemnity applied (2x sum assured of INR {sum_assured:,.2f})"
    else:
        payout = sum_assured * NATURAL_DEATH_PAYOUT_RATIO
        basis = f"Natural death - full sum assured of INR {sum_assured:,.2f}"

    return {
        "estimated_claim_amount": round(payout, 2),
        "basis": basis,
        "sum_assured": sum_assured,
    }

