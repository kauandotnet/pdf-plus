/**
 * Format placeholder types
 */
export type FormatPlaceholder = "id" | "name" | "page" | "index" | "path";

export interface FormatContext {
  id: string;
  name: string;
  page: number;
  index: number;
  path: string;
}

