/**
 * Extractor configuration
 */
import type { ExtractionOptions } from "./extraction-options.js";

export interface ExtractorConfig {
  pdfPath: string;
  outputDir?: string;
  options: ExtractionOptions;
}

