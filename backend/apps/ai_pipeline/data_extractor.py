"""
NexSettle - Structured Data Extractor
Gemini-first extraction with deterministic regex normalization fallback.
"""

import json
import logging
import re

from dateutil import parser as date_parser
from django.conf import settings

logger = logging.getLogger("nexsettle")

SUPPORTED_DOC_TYPES = {
    "death_certificate",
    "aadhaar",
    "pan",
    "bank",
    "policy",
    "fir",
    "hospital_record",
    "newspaper_clipping",
}

REQUIRED_FIELDS = {
    "death_certificate": [
        "full_name",
        "date_of_death",
        "certificate_number",
        "place_of_death",
        "cause_of_death",
        "issuing_authority",
        "registration_date",
        "registrar_signature_present",
    ],
    "aadhaar": ["aadhaar_number"],
    "pan": ["pan_number"],
    "bank": ["account_number", "ifsc_code", "bank_name", "account_holder_name"],
    "policy": [
        "policy_number",
        "policyholder_name",
        "sum_assured",
        "premium_amount",
        "policy_start_date",
        "policy_end_date",
        "insurer_name",
        "nominee_name",
    ],
    "fir": [
        "fir_number",
        "police_station",
        "date_of_incident",
        "date_of_report",
        "complainant_name",
        "incident_description",
        "charges_section",
    ],
    "hospital_record": [
        "patient_name",
        "hospital_name",
        "admission_date",
        "discharge_date",
        "diagnosis",
        "treatment_summary",
        "attending_doctor",
        "cause_of_death",
    ],
    "newspaper_clipping": [
        "headline",
        "publication_name",
        "publication_date",
        "incident_description",
        "persons_mentioned",
        "location",
    ],
}


def _get_gemini_llm():
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0,
    )


def _normalize_date(value):
    if value in (None, "", "null"):
        return None
    try:
        parsed = date_parser.parse(str(value), dayfirst=True, fuzzy=True)
        return parsed.strftime("%Y-%m-%d")
    except Exception:
        return None


def _normalize_number(value):
    if value in (None, "", "null"):
        return None
    try:
        cleaned = str(value).replace(",", "").strip()
        return float(cleaned)
    except ValueError:
        return None


def _normalize_doc_payload(doc_type: str, data: dict) -> dict:
    normalized = {k: None for k in REQUIRED_FIELDS.get(doc_type, [])}

    for key in normalized:
        if key in data:
            normalized[key] = data.get(key)

    if doc_type == "aadhaar":
        raw = normalized.get("aadhaar_number")
        if raw:
            match = re.search(r"\b(\d{4})\s?(\d{4})\s?(\d{4})\b", str(raw))
            normalized["aadhaar_number"] = "".join(match.groups()) if match else None

    if doc_type == "pan":
        raw = normalized.get("pan_number")
        if raw:
            match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", str(raw).upper())
            normalized["pan_number"] = match.group(1) if match else None

    if doc_type == "bank":
        acc = normalized.get("account_number")
        if acc:
            acc_match = re.search(r"\b(\d{9,18})\b", str(acc))
            normalized["account_number"] = acc_match.group(1) if acc_match else None
        ifsc = normalized.get("ifsc_code")
        if ifsc:
            ifsc_match = re.search(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", str(ifsc).upper())
            normalized["ifsc_code"] = ifsc_match.group(1) if ifsc_match else None

    for date_field in [
        "date_of_death",
        "registration_date",
        "policy_start_date",
        "policy_end_date",
        "date_of_incident",
        "date_of_report",
        "admission_date",
        "discharge_date",
        "publication_date",
    ]:
        if date_field in normalized:
            normalized[date_field] = _normalize_date(normalized.get(date_field))

    for num_field in ["sum_assured", "premium_amount"]:
        if num_field in normalized:
            normalized[num_field] = _normalize_number(normalized.get(num_field))

    if doc_type == "death_certificate":
        sig_value = normalized.get("registrar_signature_present")
        if isinstance(sig_value, bool):
            pass
        elif isinstance(sig_value, str):
            normalized["registrar_signature_present"] = sig_value.strip().lower() in {
                "true",
                "yes",
                "present",
                "1",
            }
        else:
            normalized["registrar_signature_present"] = False

    if doc_type == "newspaper_clipping":
        people = normalized.get("persons_mentioned")
        if people is None:
            normalized["persons_mentioned"] = []
        elif not isinstance(people, list):
            normalized["persons_mentioned"] = [str(people)]

    return normalized


def _build_extraction_prompt(doc_type: str, text: str) -> str:
    schema = REQUIRED_FIELDS.get(doc_type, [])
    schema_json = {field: None for field in schema}
    schema_json_text = json.dumps(schema_json, ensure_ascii=True)

    return (
        "You extract document fields into strict JSON.\n"
        "Rules:\n"
        "1) Return ONLY valid JSON object, no markdown.\n"
        "2) Use only fields from the target schema.\n"
        "3) Missing values must be null.\n"
        "4) Do not infer values.\n"
        "5) Aadhaar must be 12 digits only.\n"
        "6) PAN must be uppercase pattern AAAAA9999A.\n"
        "7) Dates must be YYYY-MM-DD when present.\n\n"
        f"Document type: {doc_type}\n"
        f"Target JSON schema: {schema_json_text}\n\n"
        "Document text:\n"
        f"{text[:10000]}"
    )


def extract_data_with_gemini(doc_type: str, text: str) -> dict:
    if doc_type not in SUPPORTED_DOC_TYPES:
        return {}
    if not getattr(settings, "USE_GEMINI", True):
        return {"error": "Gemini disabled by USE_GEMINI setting"}
    if not getattr(settings, "GEMINI_API_KEY", ""):
        return {"error": "Missing GEMINI_API_KEY"}

    try:
        llm = _get_gemini_llm()
        prompt = _build_extraction_prompt(doc_type, text)

        from langchain_core.messages import HumanMessage

        response = llm.invoke([HumanMessage(content=prompt)])
        response_text = response.content.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\n?", "", response_text)
            response_text = re.sub(r"\n?```$", "", response_text)

        parsed = json.loads(response_text)
        if not isinstance(parsed, dict):
            return {"error": "Gemini returned non-object JSON"}
        return _normalize_doc_payload(doc_type, parsed)
    except Exception as e:
        logger.warning("Gemini extraction failed for %s: %s", doc_type, e)
        return {"error": str(e)}


def extract_data_with_regex(doc_type: str, text: str) -> dict:
    result = {k: None for k in REQUIRED_FIELDS.get(doc_type, [])}
    text_upper = text.upper()

    if doc_type == "aadhaar":
        match = re.search(r"\b(\d{4})\s?(\d{4})\s?(\d{4})\b", text)
        result["aadhaar_number"] = "".join(match.groups()) if match else None

    elif doc_type == "pan":
        match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text_upper)
        result["pan_number"] = match.group(1) if match else None

    elif doc_type == "bank":
        acc_match = re.search(r"\b(\d{9,18})\b", text)
        ifsc_match = re.search(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", text_upper)
        result["account_number"] = acc_match.group(1) if acc_match else None
        result["ifsc_code"] = ifsc_match.group(1) if ifsc_match else None

        bank_match = re.search(
            r"\b([A-Z][A-Za-z&\s]{2,40}(?:BANK|BANK LTD|BANK LIMITED))\b",
            text,
            re.IGNORECASE,
        )
        result["bank_name"] = bank_match.group(1).strip() if bank_match else None

        holder_match = re.search(
            r"(?:A/C NAME|ACCOUNT HOLDER|NAME)\s*[:\-]?\s*([A-Z][A-Z\s\.]{2,50})",
            text_upper,
        )
        result["account_holder_name"] = (
            holder_match.group(1).strip().title() if holder_match else None
        )

    elif doc_type == "death_certificate":
        cert_match = re.search(
            r"(?:certificate\s*(?:no|number)|reg(?:istration)?\s*(?:no|number))\s*[:\-]?\s*([A-Z0-9\/\-\.\s]+)",
            text,
            re.IGNORECASE,
        )
        result["certificate_number"] = cert_match.group(1).strip() if cert_match else None
        result["registrar_signature_present"] = bool(
            re.search(r"registrar|signature|seal", text, re.IGNORECASE)
        )

        for label, field in [
            ("date of death", "date_of_death"),
            ("registration date", "registration_date"),
        ]:
            match = re.search(
                rf"{label}\s*[:\-]?\s*([0-3]?\d[\/\-.][0-1]?\d[\/\-.]\d{{2,4}})",
                text,
                re.IGNORECASE,
            )
            if match:
                result[field] = _normalize_date(match.group(1))

    elif doc_type == "newspaper_clipping":
        result["persons_mentioned"] = []

    return _normalize_doc_payload(doc_type, result)


def is_partial_extraction(doc_type: str, payload: dict) -> bool:
    fields = REQUIRED_FIELDS.get(doc_type, [])
    if not fields:
        return True
    has_any_value = False
    for field in fields:
        val = payload.get(field)
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        if isinstance(val, list) and not val:
            continue
        has_any_value = True
    return not has_any_value
