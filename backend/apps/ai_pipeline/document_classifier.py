"""
NexSettle — Document Classifier Agent
Detects document type using keyword analysis.
"""

import re
import logging

logger = logging.getLogger("nexsettle")

DOCUMENT_KEYWORDS = {
    "death_certificate": [
        "death certificate", "certificate of death", "date of death",
        "cause of death", "registrar of births and deaths", "deceased",
        "died", "registration of death",
    ],
    "aadhaar": [
        "aadhaar", "uidai", "unique identification authority",
        "government of india", "आधार", "enrollment no",
    ],
    "pan": [
        "income tax department", "permanent account number",
        "pan card", "income tax",
    ],
    "bank": [
        "account number", "ifsc", "cancelled cheque", "bank",
        "savings account", "current account", "micr",
        "bank statement", "passbook",
    ],
    "policy": [
        "policy number", "policy document", "life insurance",
        "insurance policy", "sum assured", "policyholder",
        "premium", "insured",
    ],
    "fir": [
        "first information report", "fir", "police station",
        "fir number", "case number", "complainant",
        "investigating officer",
    ],
    "hospital_record": [
        "hospital", "medical report", "diagnosis", "treatment",
        "patient", "doctor", "physician", "discharge summary",
        "prescription", "clinical notes",
    ],
    "newspaper_clipping": [
        "news", "article", "reported", "incident",
        "correspondent", "published", "dated", "edition",
    ],
}


def classify_document(text: str) -> str:
    """
    Classify document type based on keyword frequency in extracted text.

    Returns:
        str: document type key or "unknown"
    """
    text_lower = text.lower()
    scores = {}

    for doc_type, keywords in DOCUMENT_KEYWORDS.items():
        score = 0
        for kw in keywords:
            occurrences = len(re.findall(re.escape(kw), text_lower))
            score += occurrences
        scores[doc_type] = score

    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    logger.debug(f"Document classification scores: {scores}")

    if best_score == 0:
        return "unknown"

    return best_type
