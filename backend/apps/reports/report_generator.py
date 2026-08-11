"""
NexSettle — PDF Report Generator
Generates a comprehensive claim report PDF using ReportLab.
"""

import logging
import os
from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from django.conf import settings

logger = logging.getLogger("nexsettle")


# ── Color Palette ──────────────────────────────────────────────────────────
BRAND_BLUE    = colors.HexColor("#1a56db")
BRAND_DARK    = colors.HexColor("#1e293b")
BRAND_LIGHT   = colors.HexColor("#f8fafc")
FRAUD_RED     = colors.HexColor("#dc2626")
SUCCESS_GREEN = colors.HexColor("#16a34a")
GRAY          = colors.HexColor("#64748b")
LIGHT_GRAY    = colors.HexColor("#e2e8f0")


def generate_claim_report(claim: dict, output_path: str = None) -> bytes:
    """
    Generate a PDF report for a claim.

    Args:
        claim: The full claim document from MongoDB.
        output_path: Optional path to save the PDF.

    Returns:
        bytes: PDF content.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Custom Styles ──────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "NexTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=BRAND_BLUE,
        spaceAfter=6,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "NexSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=GRAY,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "NexSection",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=BRAND_DARK,
        spaceBefore=12,
        spaceAfter=6,
        borderPad=4,
    )
    body_style = ParagraphStyle(
        "NexBody",
        parent=styles["Normal"],
        fontSize=9,
        textColor=BRAND_DARK,
        leading=14,
    )
    fraud_style = ParagraphStyle(
        "NexFraud",
        parent=styles["Normal"],
        fontSize=10,
        textColor=FRAUD_RED,
        spaceAfter=4,
    )

    # ── Header ─────────────────────────────────────────────────────────────
    story.append(Paragraph("NexSettle", title_style))
    story.append(Paragraph("AI-Powered Insurance Claims Automation Platform", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_BLUE))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("CLAIM SETTLEMENT REPORT", ParagraphStyle(
        "ClaimHeader", parent=styles["Heading1"], fontSize=16,
        textColor=BRAND_DARK, alignment=TA_CENTER,
    )))
    story.append(Spacer(1, 0.3 * cm))

    # ── Claim Summary Table ────────────────────────────────────────────────
    generated_at = datetime.now(tz=timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    claim_type_display = claim.get("claim_type", "unknown").replace("_", " ").title()
    claim_status_display = claim.get("claim_status", "unknown").replace("_", " ").title()

    summary_data = [
        ["Field", "Value"],
        ["Claim ID", claim.get("claim_id", "N/A")],
        ["User ID", claim.get("user_unique_id", "N/A")],
        ["Policy Number", claim.get("policy_number") or "N/A"],
        ["Claim Type", claim_type_display],
        ["Claim Status", claim_status_display],
        ["Generated At", generated_at],
    ]

    summary_table = Table(summary_data, colWidths=[5 * cm, 12 * cm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0), 10),
        ("BACKGROUND",  (0, 1), (-1, -1), BRAND_LIGHT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BRAND_LIGHT, colors.white]),
        ("FONTSIZE",    (0, 1), (-1, -1), 9),
        ("GRID",        (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.5 * cm))

    # ── Fraud Status ───────────────────────────────────────────────────────
    story.append(Paragraph("Fraud Detection", section_style))
    fraud_flag = claim.get("fraud_flag", False)
    fraud_text = "⚠ FRAUD DETECTED" if fraud_flag else "✓ No Fraud Detected"
    fraud_color = FRAUD_RED if fraud_flag else SUCCESS_GREEN
    story.append(Paragraph(
        fraud_text,
        ParagraphStyle("FraudStatus", parent=styles["Normal"], fontSize=11,
                       textColor=fraud_color, spaceAfter=4),
    ))
    if fraud_flag and claim.get("fraud_reasons"):
        for reason in claim["fraud_reasons"]:
            story.append(Paragraph(f"• {reason}", fraud_style))

    story.append(Spacer(1, 0.4 * cm))

    # ── Extracted Documents ────────────────────────────────────────────────
    story.append(Paragraph("Extracted Document Data", section_style))

    for extracted_doc in claim.get("extracted_documents", []):
        doc_type = extracted_doc.get("document_type", "").replace("_", " ").title()
        conf = extracted_doc.get("confidence_score", 0.0)
        story.append(Paragraph(
            f"<b>{doc_type}</b> — Confidence: {conf:.1%}",
            ParagraphStyle("DocType", parent=styles["Normal"], fontSize=10,
                           textColor=BRAND_BLUE, spaceBefore=8, spaceAfter=4),
        ))

        extracted = extracted_doc.get("extracted_data", {})
        if extracted:
            rows = [["Field", "Value"]]
            for k, v in extracted.items():
                rows.append([k.replace("_", " ").title(), str(v) if v is not None else "N/A"])

            t = Table(rows, colWidths=[5.5 * cm, 11.5 * cm])
            t.setStyle(TableStyle([
                ("BACKGROUND",  (0, 0), (-1, 0), BRAND_DARK),
                ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
                ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",    (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BRAND_LIGHT, colors.white]),
                ("GRID",        (0, 0), (-1, -1), 0.3, LIGHT_GRAY),
                ("TOPPADDING",  (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(t)
        story.append(Spacer(1, 0.3 * cm))

    # ── Claim Estimation ───────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_GRAY))
    story.append(Paragraph("Claim Estimation", section_style))

    amount = claim.get("estimated_claim_amount", 0.0)
    basis = claim.get("estimation_basis", "")

    estimation_data = [
        ["Field", "Value"],
        ["Estimated Payout", f"₹ {amount:,.2f}"],
        ["Basis", basis or "N/A"],
        ["Overall Confidence", f"{claim.get('overall_confidence', 0.0):.1%}"],
    ]

    est_table = Table(estimation_data, colWidths=[5 * cm, 12 * cm])
    est_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), SUCCESS_GREEN),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BRAND_LIGHT, colors.white]),
        ("GRID",        (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("FONTNAME",    (0, 1), (0, 1), "Helvetica-Bold"),
        ("TEXTCOLOR",   (1, 1), (1, 1), SUCCESS_GREEN),
        ("FONTSIZE",    (0, 1), (-1, 1), 11),
    ]))
    story.append(est_table)

    # ── Footer ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_GRAY))
    story.append(Paragraph(
        "This report is auto-generated by the NexSettle AI Claims Automation Platform. "
        "It is for internal verification purposes only and does not constitute a final settlement decision.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7, textColor=GRAY,
                       alignment=TA_CENTER, spaceBefore=6),
    ))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)
        logger.info(f"Claim report saved: {output_path}")

    return pdf_bytes
