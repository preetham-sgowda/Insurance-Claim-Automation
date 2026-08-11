"""
NexSettle — OCR Utility
Handles image and scanned PDF text extraction using pytesseract.
"""

import io
import logging
from pathlib import Path

import pytesseract
from PIL import Image

logger = logging.getLogger("nexsettle")

# Configure Tesseract path from Django settings (supports Windows)
try:
    from django.conf import settings as _dj_settings
    _tess_cmd = getattr(_dj_settings, "TESSERACT_CMD", None)
    if _tess_cmd:
        import os as _os
        if _os.path.exists(_tess_cmd):
            pytesseract.pytesseract.tesseract_cmd = _tess_cmd
except Exception:
    pass  # Settings not yet loaded during import — pytesseract will use PATH


def _is_image_file(file_path: str) -> bool:
    suffix = Path(file_path).suffix.lower()
    return suffix in [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"]


def _is_pdf_file(file_path: str) -> bool:
    return Path(file_path).suffix.lower() == ".pdf"


def extract_text_from_image(image_source) -> dict:
    """
    Extract text from an image file or PIL Image.

    Returns:
        {
            "text": str,
            "confidence": float (0.0–1.0),
            "status": "success" | "failed_ocr"
        }
    """
    try:
        if isinstance(image_source, (str, Path)):
            img = Image.open(image_source)
        elif isinstance(image_source, bytes):
            img = Image.open(io.BytesIO(image_source))
        else:
            img = image_source  # already PIL Image

        # Get detailed OCR data with confidence scores
        ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        raw_text = pytesseract.image_to_string(img)

        # Calculate average confidence (ignore -1 values from empty cells)
        confidences = []
        for c in ocr_data["conf"]:
            c_str = str(c).strip()
            if not c_str or c_str == "-1":
                continue
            try:
                confidences.append(float(c_str))
            except ValueError:
                continue
        avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0

        if avg_confidence < 0.6:
            return {
                "text": raw_text,
                "confidence": round(avg_confidence, 3),
                "status": "failed_ocr",
                "message": "Document can't be fetched properly. Please re-upload a clearer copy.",
            }

        return {
            "text": raw_text,
            "confidence": round(avg_confidence, 3),
            "status": "success",
        }

    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return {
            "text": "",
            "confidence": 0.0,
            "status": "failed_ocr",
            "message": f"OCR processing error: {str(e)}",
        }


def extract_text_from_pdf(pdf_source) -> dict:
    """
    Extract text from a PDF (text-based or scanned).
    For scanned PDFs, converts pages to images and runs OCR.

    Returns same structure as extract_text_from_image.
    """
    try:
        from pdf2image import convert_from_bytes, convert_from_path
        import PyPDF2

        if isinstance(pdf_source, (str, Path)):
            with open(pdf_source, "rb") as f:
                pdf_bytes = f.read()
        else:
            pdf_bytes = pdf_source

        # Attempt direct text extraction first
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        direct_text = ""
        for page in reader.pages:
            direct_text += page.extract_text() or ""

        if len(direct_text.strip()) > 50:
            # Sufficient text found via direct extraction
            return {
                "text": direct_text,
                "confidence": 0.95,
                "status": "success",
            }

        # Fallback: OCR on converted images
        images = convert_from_bytes(pdf_bytes, dpi=200)
        all_text = ""
        all_confs = []

        for img in images:
            result = extract_text_from_image(img)
            all_text += result["text"] + "\n"
            all_confs.append(result["confidence"])

        avg_conf = sum(all_confs) / len(all_confs) if all_confs else 0.0

        if avg_conf < 0.6:
            return {
                "text": all_text,
                "confidence": round(avg_conf, 3),
                "status": "failed_ocr",
                "message": "Document can't be fetched properly. Please re-upload a clearer copy.",
            }

        return {
            "text": all_text,
            "confidence": round(avg_conf, 3),
            "status": "success",
        }

    except Exception as e:
        logger.error(f"PDF OCR extraction failed: {e}")
        return {
            "text": "",
            "confidence": 0.0,
            "status": "failed_ocr",
            "message": f"PDF processing error: {str(e)}",
        }


def extract_text(file_bytes: bytes, mime_type: str) -> dict:
    """
    Unified entry point for text extraction.
    Dispatches to image or PDF handler based on MIME type.
    """
    if mime_type in ["image/png", "image/jpeg", "image/jpg"]:
        return extract_text_from_image(file_bytes)
    elif mime_type == "application/pdf":
        return extract_text_from_pdf(file_bytes)
    elif mime_type == "text/plain":
        try:
            text = file_bytes.decode("utf-8", errors="ignore").strip()
            if not text:
                return {
                    "text": "",
                    "confidence": 0.0,
                    "status": "failed_ocr",
                    "message": "Document can't be fetched properly. Please re-upload a clearer copy.",
                }
            return {
                "text": text,
                "confidence": 1.0,
                "status": "success",
            }
        except Exception as e:
            return {
                "text": "",
                "confidence": 0.0,
                "status": "failed_ocr",
                "message": f"Text processing error: {str(e)}",
            }
    else:
        return {
            "text": "",
            "confidence": 0.0,
            "status": "invalid_document",
            "message": f"Unsupported file format: {mime_type}",
        }
