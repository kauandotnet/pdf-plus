/**
 * Document metadata
 */
import type { ExtractionOptions } from "./extraction-options.js";

export interface DocumentMetadata {
  filename: string;
  pages: number;
  textLength: number;
  extractedAt: string;
  metadata: Record<string, unknown>;
  options: ExtractionOptions;
}

