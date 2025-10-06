/**
 * OCR options (future enhancement)
 */
export interface OCROptions {
  enabled: boolean;
  language?: string;
  confidence?: number;
  engine?: "tesseract" | "cloud";
}

