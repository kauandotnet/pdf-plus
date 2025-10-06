/**
 * Custom error classes for PDF extraction
 * 
 * Provides domain-specific errors with context and error codes
 * for better error handling and debugging.
 */

/**
 * Base error class for all PDF extraction errors
 */
export class PDFExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'PDFExtractionError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Validation error for invalid configuration or input
 */
export class ValidationError extends PDFExtractionError {
  constructor(
    message: string,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * File system error for file access issues
 */
export class FileSystemError extends PDFExtractionError {
  constructor(
    message: string,
    public readonly filePath: string,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, 'FILE_SYSTEM_ERROR', { ...context, filePath });
    this.name = 'FileSystemError';
  }
}

/**
 * PDF parsing error for invalid or corrupted PDFs
 */
export class PDFParsingError extends PDFExtractionError {
  constructor(
    message: string,
    public readonly pdfPath: string,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, 'PDF_PARSING_ERROR', { ...context, pdfPath });
    this.name = 'PDFParsingError';
  }
}

/**
 * Image extraction error
 */
export class ImageExtractionError extends PDFExtractionError {
  constructor(
    message: string,
    public readonly pageNumber?: number,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, 'IMAGE_EXTRACTION_ERROR', { ...context, pageNumber });
    this.name = 'ImageExtractionError';
  }
}

/**
 * Text extraction error
 */
export class TextExtractionError extends PDFExtractionError {
  constructor(
    message: string,
    public readonly pageNumber?: number,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, 'TEXT_EXTRACTION_ERROR', { ...context, pageNumber });
    this.name = 'TextExtractionError';
  }
}

/**
 * Engine error for extraction engine failures
 */
export class EngineError extends PDFExtractionError {
  constructor(
    message: string,
    public readonly engineName: string,
    context?: Readonly<Record<string, unknown>>
  ) {
    super(message, 'ENGINE_ERROR', { ...context, engineName });
    this.name = 'EngineError';
  }
}

/**
 * Type guard to check if error is a PDFExtractionError
 */
export const isPDFExtractionError = (error: unknown): error is PDFExtractionError => {
  return error instanceof PDFExtractionError;
};

/**
 * Type guard to check if error is a ValidationError
 */
export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError;
};

/**
 * Type guard to check if error is a FileSystemError
 */
export const isFileSystemError = (error: unknown): error is FileSystemError => {
  return error instanceof FileSystemError;
};

/**
 * Helper to create error from unknown error
 */
export const toExtractionError = (
  error: unknown,
  defaultMessage = 'An unknown error occurred'
): PDFExtractionError => {
  if (isPDFExtractionError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new PDFExtractionError(
      error.message || defaultMessage,
      'UNKNOWN_ERROR',
      { originalError: error.name, stack: error.stack }
    );
  }

  return new PDFExtractionError(
    defaultMessage,
    'UNKNOWN_ERROR',
    { originalError: String(error) }
  );
};

