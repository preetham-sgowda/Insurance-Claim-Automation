import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

/**
 * Result of text extraction from a document.
 */
export interface ExtractionResult {
  /** Extracted text content */
  text: string;
  /** Confidence score 0-1 (from Tesseract for OCR, 0.95 for native PDF text) */
  confidence: number;
  /** How the text was extracted */
  method: 'pdf_text_layer' | 'ocr' | 'unsupported';
  /** Number of pages (1 for images) */
  pageCount: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error message if extraction partially or fully failed */
  error?: string;
}

/**
 * Preprocess an image buffer for OCR:
 * - Convert to grayscale
 * - Resize if too small (upscale for better OCR accuracy)
 * - Normalize to PNG format
 */
async function preprocessImageForOCR(imageBuffer: Buffer): Promise<Buffer> {
  let pipeline = sharp(imageBuffer).grayscale().png();

  // Get metadata to decide if we need to upscale
  const metadata = await sharp(imageBuffer).metadata();
  if (metadata.width && metadata.width < 1000) {
    // Upscale small images for better OCR accuracy
    pipeline = sharp(imageBuffer)
      .resize({ width: Math.max(metadata.width * 2, 1500), withoutEnlargement: false })
      .grayscale()
      .png();
  }

  return pipeline.toBuffer();
}

/**
 * Run OCR on an image buffer using Tesseract.js.
 * Returns extracted text and confidence.
 */
async function runOCR(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  const preprocessed = await preprocessImageForOCR(imageBuffer);

  const worker = await createWorker('eng', 1, {
    cachePath: '/tmp',
    cacheMethod: 'write',
  });

  const { data } = await worker.recognize(preprocessed);
  await worker.terminate();

  return {
    text: data.text.trim(),
    confidence: data.confidence / 100, // Tesseract returns 0-100, we normalize to 0-1
  };
}

/**
 * Extract text from a PDF buffer.
 * First tries the native text layer via pdf-parse.
 * If no text found (scanned PDF), falls back to OCR via pdf-to-png + tesseract.
 */
async function extractFromPDF(pdfBuffer: Buffer): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Step 1: Try native text layer extraction
    const parser = new PDFParse({ data: pdfBuffer });
    let nativeText = '';
    let pageCount = 1;
    try {
      const textResult = await parser.getText();
      nativeText = (textResult.text || '').trim();
      pageCount = textResult.total || 1;
    } finally {
      await parser.destroy();
    }

    // If we got meaningful text (more than just whitespace/page numbers)
    if (nativeText.length > 50) {
      return {
        text: nativeText,
        confidence: 0.95,
        method: 'pdf_text_layer',
        pageCount,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Step 2: No text layer — this is a scanned PDF, fall back to OCR
    // Convert PDF pages to images, then OCR each page
    let pdfToImage: typeof import('pdf-to-png-converter');
    try {
      pdfToImage = await import('pdf-to-png-converter');
    } catch {
      return {
        text: nativeText || '',
        confidence: nativeText.length > 0 ? 0.3 : 0,
        method: 'pdf_text_layer',
        pageCount,
        processingTimeMs: Date.now() - startTime,
        error: 'pdf-to-png-converter not available for scanned PDF OCR fallback',
      };
    }

    const pngPages = await pdfToImage.pdfToPng(pdfBuffer, {
      disableFontFace: true,
      viewportScale: 2.0, // Higher scale = better OCR accuracy
    });

    if (!pngPages || pngPages.length === 0) {
      return {
        text: nativeText || '',
        confidence: 0.1,
        method: 'ocr',
        pageCount,
        processingTimeMs: Date.now() - startTime,
        error: 'Failed to convert PDF pages to images for OCR',
      };
    }

    // OCR each page and combine
    const pageTexts: string[] = [];
    let totalConfidence = 0;

    for (const page of pngPages) {
      if (page.content) {
        const ocrResult = await runOCR(page.content);
        pageTexts.push(ocrResult.text);
        totalConfidence += ocrResult.confidence;
      }
    }

    const combinedText = pageTexts.join('\n\n--- Page Break ---\n\n').trim();
    const avgConfidence = pngPages.length > 0 ? totalConfidence / pngPages.length : 0;

    return {
      text: combinedText,
      confidence: avgConfidence,
      method: 'ocr',
      pageCount: pngPages.length,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      text: '',
      confidence: 0,
      method: 'pdf_text_layer',
      pageCount: 0,
      processingTimeMs: Date.now() - startTime,
      error: `PDF extraction failed: ${err.message || err}`,
    };
  }
}

/**
 * Extract text from an image file (JPG, PNG, etc.) using OCR.
 */
async function extractFromImage(imageBuffer: Buffer): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const ocrResult = await runOCR(imageBuffer);

    return {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      method: 'ocr',
      pageCount: 1,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      text: '',
      confidence: 0,
      method: 'ocr',
      pageCount: 1,
      processingTimeMs: Date.now() - startTime,
      error: `Image OCR failed: ${err.message || err}`,
    };
  }
}

/**
 * Main entry point: extract text from any supported document.
 *
 * Supports:
 * - PDF files (native text layer + OCR fallback for scanned PDFs)
 * - Image files (JPG, PNG — direct OCR)
 *
 * @param fileBuffer - Raw file bytes
 * @param mimeType  - MIME type of the file
 * @param fileName  - Original filename (for logging)
 */
export async function extractTextFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractionResult> {
  const normalizedMime = mimeType.toLowerCase();

  if (normalizedMime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return extractFromPDF(fileBuffer);
  }

  if (
    normalizedMime.startsWith('image/') ||
    /\.(jpg|jpeg|png|bmp|tiff|tif|webp)$/i.test(fileName)
  ) {
    return extractFromImage(fileBuffer);
  }

  return {
    text: '',
    confidence: 0,
    method: 'unsupported',
    pageCount: 0,
    processingTimeMs: 0,
    error: `Unsupported file type: ${mimeType} (${fileName})`,
  };
}
