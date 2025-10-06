/**
 * Page extraction result
 */
import type { TextItem } from "./text-item.js";
import type { ImageItem } from "./image-item.js";

export interface PageExtractionResult {
  pageNumber: number;
  text: string;
  rawText: string;
  textItems: TextItem[];
  images: ImageItem[];
  metadata: {
    wordCount: number;
    characterCount: number;
    imageCount: number;
  };
}

