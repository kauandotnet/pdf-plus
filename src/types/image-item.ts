/**
 * Image item extracted from PDF
 */
import type { Position } from "./position.js";

export interface ImageItem {
  id: string;
  name?: string;
  filename?: string;
  filepath?: string;
  position: Position;
  page: number;
  transform?: number[];
  width: number;
  height: number;
  format?: string;
  mimeType?: string;
  size?: number;
  filePath?: string; // Legacy compatibility
  data?: Uint8Array;
}

