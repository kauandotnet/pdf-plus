/**
 * Structured page data with metadata
 */
import type { ExtractionOptions } from "./extraction-options.js";
import type { PageData } from "./page-data.js";

export interface StructuredPageData {
  metadata: {
    filename: string;
    extractedAt: string;
    totalPages: number;
    totalTextLength: number;
    totalImages: number;
    extractionOptions: ExtractionOptions;
  };
  pages: PageData[];
}

