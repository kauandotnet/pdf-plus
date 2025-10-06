/**
 * Extraction error
 */
import type { ValidationError } from "./validation-error.js";

export interface ExtractionError extends Error {
  code: string;
  context?: Record<string, unknown>;
  validationErrors?: ValidationError[];
}

