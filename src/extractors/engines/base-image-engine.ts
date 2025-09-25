import type { ExtractionOptions, ImageItem } from "../../types/index.js";

/**
 * Abstract base class for image extraction engines
 */
export abstract class BaseImageEngine {
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Check if this engine is available on the current system
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Extract images from a PDF file
   */
  abstract extractImages(
    pdfPath: string,
    options: ExtractionOptions
  ): Promise<{
    success: boolean;
    images?: ImageItem[];
    error?: string;
  }>;

  /**
   * Get engine-specific capabilities
   */
  abstract getCapabilities(): {
    formats: string[];
    maxFileSize?: number;
    supportsMetadata: boolean;
    supportsEmbeddedImages: boolean;
    supportsVectorImages: boolean;
  };
}
