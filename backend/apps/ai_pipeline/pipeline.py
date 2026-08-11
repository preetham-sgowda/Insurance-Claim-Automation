"""
NexSettle — LangGraph AI Processing Pipeline
Orchestrates: OCR → Classify → Extract → Fraud → Policy Verify → Estimate → Store

Graph State:
    - files: List[dict]  (each: {bytes, mime_type, original_name})
    - user_unique_id: str
    - documents: List[dict]  (accumulated extracted docs)
    - fraud_result: dict
    - policy_result: dict
    - estimate_result: dict
    - claim_id: str
    - status: str
    - errors: List[str]
"""

import logging
from typing import TypedDict, List

from langgraph.graph import StateGraph, END

from utils.ocr import extract_text
from utils.masking import mask_document_data
from .document_classifier import classify_document
from .data_extractor import (
    extract_data_with_gemini,
    extract_data_with_regex,
    is_partial_extraction,
)
from .fraud_detector import detect_fraud
from .policy_verifier import verify_policy
from .claim_estimator import estimate_claim

logger = logging.getLogger("nexsettle")


# ── State Schema ───────────────────────────────────────────────────────────

class PipelineState(TypedDict):
    files: List[dict]                      # Input files
    user_unique_id: str                     # Claimant user ID
    claim_id: str                           # Generated claim ID
    documents: List[dict]                   # Extracted docs (accumulated)
    fraud_result: dict
    policy_result: dict
    estimate_result: dict
    overall_confidence: float
    status: str
    errors: List[str]


# ── Node Functions ─────────────────────────────────────────────────────────

def node_ocr_and_classify(state: PipelineState) -> dict:
    """OCR + classify each uploaded file."""
    documents = []
    errors = []

    for file_info in state.get("files", []):
        file_bytes = file_info["bytes"]
        mime_type = file_info["mime_type"]
        original_name = file_info.get("original_name", "unknown")

        # OCR
        ocr_result = extract_text(file_bytes, mime_type)

        if ocr_result["status"] == "invalid_document":
            errors.append(f"{original_name}: {ocr_result.get('message', 'Invalid document format.')}")
            documents.append({
                "document_type": "unknown",
                "file_format": mime_type.split("/")[-1],
                "original_name": original_name,
                "status": "invalid_document",
                "extracted_data": {},
                "confidence_score": 0.0,
                "raw_text": "",
            })
            continue

        if ocr_result["status"] == "failed_ocr":
            errors.append(f"{original_name}: {ocr_result.get('message', 'OCR failed.')}")
            documents.append({
                "document_type": "unknown",
                "file_format": mime_type.split("/")[-1],
                "original_name": original_name,
                "status": "failed_ocr",
                "extracted_data": {},
                "confidence_score": ocr_result["confidence"],
                "raw_text": "",
            })
            continue

        # Classify
        doc_type = classify_document(ocr_result["text"])
        logger.info(f"File '{original_name}' classified as: {doc_type}")

        documents.append({
            "document_type": doc_type,
            "file_format": mime_type.split("/")[-1],
            "mime_type": mime_type,
            "original_name": original_name,
            "status": "classified",
            "extracted_data": {},
            "confidence_score": ocr_result["confidence"],
            "raw_text": ocr_result["text"],
        })

    return {"documents": documents, "errors": errors}


def node_extract_data(state: PipelineState) -> dict:
    """Run Gemini extraction on classified documents."""
    updated_docs = []

    for doc in state.get("documents", []):
        if doc["status"] not in ["classified"]:
            updated_docs.append(doc)
            continue

        doc_type = doc["document_type"]
        raw_text = doc.get("raw_text", "")
        mime_type = doc.get("mime_type")

        if doc_type == "unknown" or not raw_text:
            doc["status"] = "invalid_document"
            doc["extracted_data"] = {}
            doc.pop("raw_text", None)
            updated_docs.append(doc)
            continue

        if doc_type == "death_certificate" and mime_type == "text/plain":
            doc["status"] = "invalid_document"
            doc["extracted_data"] = {}
            doc.pop("raw_text", None)
            updated_docs.append(doc)
            continue

        # Try Gemini first, fallback to regex
        extracted = extract_data_with_gemini(doc_type, raw_text)
        if "error" in extracted:
            logger.warning(f"Gemini failed for {doc_type}, falling back to regex.")
            extracted = extract_data_with_regex(doc_type, raw_text)

        doc["extracted_data"] = extracted
        doc["status"] = "partial" if is_partial_extraction(doc_type, extracted) else "extracted"
        # Don't persist raw_text in the final output
        doc.pop("raw_text", None)
        updated_docs.append(doc)

    return {"documents": updated_docs}


def node_mask_sensitive_data(state: PipelineState) -> dict:
    """Mask Aadhaar, PAN, and bank account numbers before storage."""
    updated_docs = []
    for doc in state.get("documents", []):
        masked_data = mask_document_data(doc["document_type"], doc.get("extracted_data", {}))
        doc["extracted_data"] = masked_data
        updated_docs.append(doc)
    return {"documents": updated_docs}


def node_fraud_detection(state: PipelineState) -> dict:
    """Run fraud detection across all extracted documents."""
    extracted_docs = [d for d in state.get("documents", []) if d["status"] in ["extracted", "partial"]]
    fraud_result = detect_fraud(extracted_docs)
    logger.info(f"Fraud detection result — flag: {fraud_result['fraud_flag']}")
    return {"fraud_result": fraud_result}


def node_policy_verification(state: PipelineState) -> dict:
    """Verify extracted data against MongoDB policy holder records."""
    if state.get("fraud_result", {}).get("fraud_flag"):
        return {
            "policy_result": {
                "verified": False,
                "verification_notes": ["Skipped — fraud detected."],
                "claim_type": "unknown",
                "policy_number": None,
            }
        }

    policy_result = verify_policy(
        state.get("user_unique_id", ""),
        state.get("documents", []),
    )
    return {"policy_result": policy_result}


def node_claim_estimation(state: PipelineState) -> dict:
    """Estimate payout amount."""
    fraud_flag = state.get("fraud_result", {}).get("fraud_flag", False)
    claim_type = state.get("policy_result", {}).get("claim_type", "natural_death")

    estimate = estimate_claim(
        user_unique_id=state.get("user_unique_id", ""),
        claim_type=claim_type,
        fraud_flag=fraud_flag,
        documents=state.get("documents", []),
    )
    return {"estimate_result": estimate}


def node_finalize(state: PipelineState) -> dict:
    """Calculate overall confidence and final status."""
    docs = state.get("documents", [])
    if not docs:
        return {"overall_confidence": 0.0, "status": "failed"}

    scores = [d.get("confidence_score", 0.0) for d in docs]
    overall = round(sum(scores) / len(scores), 3) if scores else 0.0

    has_failed_ocr = any(d["status"] == "failed_ocr" for d in docs)
    has_invalid = any(d["status"] == "invalid_document" for d in docs)
    has_partial = any(d["status"] == "partial" for d in docs)

    if has_failed_ocr:
        final_status = "failed_ocr"
    elif has_invalid:
        final_status = "invalid_document"
    elif has_partial:
        final_status = "partial"
    else:
        final_status = "success"

    return {"overall_confidence": overall, "status": final_status}


# ── Build Graph ────────────────────────────────────────────────────────────

def build_pipeline() -> StateGraph:
    graph = StateGraph(PipelineState)

    graph.add_node("ocr_classify",      node_ocr_and_classify)
    graph.add_node("extract_data",      node_extract_data)
    graph.add_node("fraud_detection",   node_fraud_detection)
    graph.add_node("policy_verify",     node_policy_verification)
    graph.add_node("claim_estimate",    node_claim_estimation)
    graph.add_node("mask_data",         node_mask_sensitive_data)
    graph.add_node("finalize",          node_finalize)

    graph.set_entry_point("ocr_classify")
    graph.add_edge("ocr_classify",    "extract_data")
    graph.add_edge("extract_data",    "fraud_detection")
    graph.add_edge("fraud_detection", "policy_verify")
    graph.add_edge("policy_verify",   "claim_estimate")
    graph.add_edge("claim_estimate",  "mask_data")
    graph.add_edge("mask_data",       "finalize")
    graph.add_edge("finalize",        END)

    return graph.compile()


# Singleton compiled pipeline
_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = build_pipeline()
    return _pipeline


def run_pipeline(files: list, user_unique_id: str, claim_id: str) -> dict:
    """
    Run the full NexSettle AI pipeline.

    Args:
        files: List of {bytes, mime_type, original_name}
        user_unique_id: The USR_xxxx user ID
        claim_id: Pre-generated CLM_xxxx ID

    Returns:
        Final pipeline state dict
    """
    pipeline = get_pipeline()

    initial_state: PipelineState = {
        "files": files,
        "user_unique_id": user_unique_id,
        "claim_id": claim_id,
        "documents": [],
        "fraud_result": {},
        "policy_result": {},
        "estimate_result": {},
        "overall_confidence": 0.0,
        "status": "processing",
        "errors": [],
    }

    logger.info(f"Starting pipeline for claim: {claim_id}, user: {user_unique_id}")
    result = pipeline.invoke(initial_state)
    logger.info(f"Pipeline completed for claim: {claim_id} — status: {result.get('status')}")

    return result
