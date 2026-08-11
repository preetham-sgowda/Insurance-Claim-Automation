"""
NexSettle — Data Masking Utility
Masks sensitive identifiers before MongoDB storage.
"""


def mask_aadhaar(aadhaar: str) -> str:
    """Mask first 8 digits of Aadhaar: ********1234"""
    if not aadhaar:
        return aadhaar
    clean = aadhaar.replace(" ", "")
    if len(clean) != 12:
        return aadhaar
    return "********" + clean[-4:]


def mask_pan(pan: str) -> str:
    """Mask first 5 chars of PAN: *****1234F"""
    if not pan or len(pan) != 10:
        return pan
    return "*****" + pan[5:]


def mask_account_number(account_number: str) -> str:
    """Mask all but last 4 digits of bank account."""
    if not account_number:
        return account_number
    visible = account_number[-4:]
    return "X" * (len(account_number) - 4) + visible


def mask_document_data(doc_type: str, extracted_data: dict) -> dict:
    """
    Return a copy of extracted_data with sensitive fields masked.
    Original data should only be used temporarily during processing.
    """
    import copy
    masked = copy.deepcopy(extracted_data)

    if doc_type == "aadhaar":
        if "aadhaar_number" in masked and masked["aadhaar_number"]:
            masked["aadhaar_number"] = mask_aadhaar(masked["aadhaar_number"])

    elif doc_type == "pan":
        if "pan_number" in masked and masked["pan_number"]:
            masked["pan_number"] = mask_pan(masked["pan_number"])

    elif doc_type == "bank":
        if "account_number" in masked and masked["account_number"]:
            masked["account_number"] = mask_account_number(masked["account_number"])

    return masked
