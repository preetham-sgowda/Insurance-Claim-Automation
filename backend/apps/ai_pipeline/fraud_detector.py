"""
NexSettle — Fraud Detection Agent
Rule-based + AI fraud signal analysis.
"""

import re
import logging
from typing import List

logger = logging.getLogger("nexsettle")


def _normalize_name(name: str) -> str:
    """Lowercase, strip, remove extra spaces."""
    if not name:
        return ""
    return re.sub(r"\s+", " ", name.strip().lower())


def _names_match(name1: str, name2: str, threshold: float = 0.8) -> bool:
    """Fuzzy name comparison using simple token overlap."""
    tokens1 = set(_normalize_name(name1).split())
    tokens2 = set(_normalize_name(name2).split())
    if not tokens1 or not tokens2:
        return True  # If one is missing, don't flag
    overlap = len(tokens1 & tokens2)
    return overlap / max(len(tokens1), len(tokens2)) >= threshold


def detect_fraud(documents: List[dict]) -> dict:
    """
    Analyze a list of extracted document dicts for fraud signals.

    Each document dict:
        {
            "document_type": "...",
            "extracted_data": {...},
            "confidence_score": 0.x
        }

    Returns:
        {
            "fraud_flag": bool,
            "fraud_reasons": List[str]
        }
    """
    fraud_reasons = []

    # Collect all names across documents for cross-checking
    all_names = {}

    for doc in documents:
        doc_type = doc.get("document_type", "")
        data = doc.get("extracted_data", {})
        confidence = doc.get("confidence_score", 1.0)

        # 1. Extremely low OCR confidence
        if confidence < 0.5:
            fraud_reasons.append(
                f"Extremely low OCR confidence ({confidence:.2f}) for {doc_type}."
            )

        # 2. Aadhaar format validation
        if doc_type == "aadhaar":
            aadhaar = data.get("aadhaar_number")
            if aadhaar:
                clean = re.sub(r"\s", "", aadhaar)
                if not re.fullmatch(r"\d{12}", clean):
                    fraud_reasons.append(f"Invalid Aadhaar format: {aadhaar}")

        # 3. PAN format validation
        if doc_type == "pan":
            pan = data.get("pan_number")
            if pan:
                if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", pan.upper()):
                    fraud_reasons.append(f"Invalid PAN format: {pan}")

        # 4. IFSC format validation
        if doc_type == "bank":
            ifsc = data.get("ifsc_code")
            if ifsc:
                if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc.upper()):
                    fraud_reasons.append(f"Invalid IFSC format: {ifsc}")

        # 5. Death certificate date consistency
        if doc_type == "death_certificate":
            dod = data.get("date_of_death")
            reg = data.get("registration_date")
            if dod and reg:
                # Registration date should be after or equal to death date
                try:
                    from datetime import datetime
                    d_dod = datetime.strptime(dod, "%Y-%m-%d")
                    d_reg = datetime.strptime(reg, "%Y-%m-%d")
                    if d_reg < d_dod:
                        fraud_reasons.append(
                            f"Date inconsistency: Registration date ({reg}) is before date of death ({dod})."
                        )
                except ValueError:
                    pass

        # Collect names
        name_fields = ["full_name", "patient_name", "policyholder_name", "account_holder_name"]
        for field in name_fields:
            name = data.get(field)
            if name:
                all_names[f"{doc_type}.{field}"] = name

    # 6. Cross-document name mismatch check
    name_list = list(all_names.items())
    for i in range(len(name_list)):
        for j in range(i + 1, len(name_list)):
            key1, name1 = name_list[i]
            key2, name2 = name_list[j]
            if not _names_match(name1, name2):
                fraud_reasons.append(
                    f"Name mismatch detected: '{name1}' ({key1}) vs '{name2}' ({key2})."
                )

    fraud_flag = len(fraud_reasons) > 0

    return {
        "fraud_flag": fraud_flag,
        "fraud_reasons": fraud_reasons,
    }
