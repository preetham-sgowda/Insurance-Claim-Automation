# ─────────────────────────────────────────────────────────────────────────────
# NexSettle — Dockerfile
# Python 3.12 · Django · LangGraph · Gemini · Tesseract OCR
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# ── System dependencies (Tesseract OCR + poppler for pdf2image) ────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ──────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Application code ───────────────────────────────────────────────────────
COPY . .

# ── Create media directories ───────────────────────────────────────────────
RUN mkdir -p media/claims media/reports

# ── Environment defaults (override via docker-compose or .env) ─────────────
ENV DJANGO_SETTINGS_MODULE=nexsettle.settings
ENV TESSERACT_CMD=/usr/bin/tesseract

# ── Expose port ────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Start Django dev server ────────────────────────────────────────────────
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
