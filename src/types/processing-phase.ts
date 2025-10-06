/**
 * Processing phase for roadmap implementation
 */
export interface ProcessingPhase {
  name: string;
  description: string;
  status: "not_started" | "in_progress" | "complete" | "error";
  progress?: number;
  error?: string;
}

