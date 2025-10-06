import type { ImageItem, ExtractionOptions } from "../../types/index.js";

/**
 * Base interface for image extraction engines
 */
export interface BaseImageEngine {
  /**
   * Extract images from a PDF source
   * @param pdfSource - The PDF file path or buffer
   * @param options - Extraction options
   * @returns Promise resolving to extracted images or result object
   */
  extractImages(
    pdfSource: string | Buffer,
    options: ExtractionOptions
  ): Promise<
    ImageItem[] | { success: boolean; images?: ImageItem[]; error?: string }
  >;

  /**
   * Get the name of this engine
   */
  getName(): string;

  /**
   * Check if this engine is available/supported
   */
  isAvailable(): boolean | Promise<boolean>;
}

/**
 * Abstract base class for image extraction engines
 */
export abstract class AbstractImageEngine implements BaseImageEngine {
  abstract extractImages(
    pdfSource: string | Buffer,
    options: ExtractionOptions
  ): Promise<
    ImageItem[] | { success: boolean; images?: ImageItem[]; error?: string }
  >;

  abstract getName(): string;

  isAvailable(): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Helper method to generate unique image ID
   */
  protected generateImageId(page: number, index: number): string {
    return `img_p${page}_${index}`;
  }

  /**
   * Helper method to determine image format from buffer
   */
  protected detectImageFormat(buffer: Buffer): string {
    // Check for common image format signatures
    if (buffer.length >= 4) {
      // PNG signature
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return "png";
      }

      // JPEG signature
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        return "jpg";
      }

      // WebP signature
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46
      ) {
        return "webp";
      }
    }

    return "unknown";
  }
}
