/**
 * Complete extraction result
 */
import type { DocumentMetadata } from "./document-metadata.js";
import type { PageInfo } from "./page-info.js";
import type { ImageItem } from "./image-item.js";
import type { TextItem } from "./text-item.js";
import type { DocumentSummary } from "./document-summary.js";
import type { StructuredPageData } from "./structured-page-data.js";

export interface ExtractionResult {
  document: DocumentMetadata;
  pages: PageInfo[];
  images: ImageItem[];
  textItems: TextItem[];
  text: string; // Main text content (alias for cleanText for backward compatibility)
  textWithRefs: string;
  cleanText: string;
  summary?: DocumentSummary;
  structuredData?: StructuredPageData;
}

