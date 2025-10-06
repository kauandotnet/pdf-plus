/**
 * Progress information for extraction
 */
export interface ProgressInfo {
  currentPage: number;
  totalPages: number;
  phase: "text" | "images" | "processing" | "complete";
  message?: string;
}

