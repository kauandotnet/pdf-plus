/**
 * Page information from PDF
 */
import type { TextItem } from "./text-item.js";
import type { ImageItem } from "./image-item.js";

export interface PageInfo {
  number: number;
  width: number;
  height: number;
  textItems: TextItem[];
  images: ImageItem[];
  textCount: number;
  imageCount: number;
}

