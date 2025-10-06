/**
 * Text item extracted from PDF
 */
import type { Position } from "./position.js";
import type { FontInfo } from "./font-info.js";

export interface TextItem {
  id: string;
  content: string;
  position: Position;
  font: FontInfo;
  page: number;
  transform?: number[];
  type: "text" | "heading" | "paragraph" | "caption";
  fontSize?: number;
  color?: string;
}

