/**
 * Professional Image Extractor - Refactored Version
 *
 * Clean, idiomatic TypeScript with:
 * - No `let` declarations
 * - No `any` types
 * - Dependency injection
 * - Functional patterns
 * - Proper error handling
 * - Immutable data structures
 */

import { promises as fs } from "node:fs";
import type { ExtractionOptions, ImageItem } from "../../types/index.js";
import type { Logger } from "../../utils/logger.js";
import { createLogger } from "../../utils/logger.js";
import { ImageEngineFactory } from "./engines/engine-factory.js";
import {
  ImageExtractionError,
  FileSystemError,
  toExtractionError,
} from "../../errors/index.js";
import type { Result } from "../../types/result.js";
import { success, failure, tryCatchAsync } from "../../types/result.js";

/**
 * Image extraction result with metadata
 */
export interface ImageExtractionResult {
  readonly success: true;
  readonly images: ReadonlyArray<ImageItem>;
  readonly metadata: Readonly<{
    totalImages: number;
    engine: string;
    totalPages?: number;
  }>;
}

/**
 * Image extraction failure
 */
export interface ImageExtractionFailure {
  readonly success: false;
  readonly error: string;
  readonly images: ReadonlyArray<never>;
}

/**
 * Combined result type
 */
export type ImageExtractionResponse =
  | ImageExtractionResult
  | ImageExtractionFailure;

/**
 * Engine information
 */
export interface EngineInfo {
  readonly name: string;
  readonly description: string;
  readonly available: boolean;
  readonly capabilities: Readonly<{
    formats: ReadonlyArray<string>;
    supportsMetadata: boolean;
    supportsEmbeddedImages: boolean;
    supportsVectorImages: boolean;
  }>;
}

/**
 * Engine recommendation
 */
export interface EngineRecommendation {
  readonly useCase: string;
  readonly engine: "pdf-lib" | "poppler";
  readonly reason: string;
}

/**
 * Image extraction configuration
 */
interface ImageExtractionConfig {
  readonly pdfPath: string;
  readonly options: Readonly<ExtractionOptions>;
  readonly logger: Logger;
}

/**
 * Professional Image Extractor
 *
 * Extracts images from PDF files using configurable engines with
 * automatic fallback and proper error handling.
 *
 * @example
 * ```typescript
 * const extractor = new ImageExtractor();
 * const result = await extractor.extract('document.pdf', {
 *   extractImageFiles: true,
 *   imageOutputDir: './images',
 *   imageEngine: 'auto'
 * });
 *
 * if (result.success) {
 *   console.log(`Extracted ${result.images.length} images`);
 * }
 * ```
 */
export class ImageExtractor {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger(false);
  }

  /**
   * Extract images from PDF file
   *
   * @param pdfPath - Path to the PDF file
   * @param options - Extraction options
   * @returns Promise resolving to extraction result
   */
  async extract(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<ImageExtractionResponse> {
    const config = this.createConfig(pdfPath, options);

    // Ensure output directory exists
    const dirResult = await this.ensureOutputDirectory(config);
    if (!dirResult.success) {
      return this.createFailureResponse(dirResult.error.message);
    }

    // Try primary engine
    const primaryResult = await this.extractWithEngine(config);
    if (primaryResult.success) {
      return primaryResult.data;
    }

    // Fallback to pdf-lib
    config.logger.warn("Primary engine failed, falling back to pdf-lib");
    const fallbackResult = await this.extractWithFallback(config);

    return fallbackResult.success
      ? fallbackResult.data
      : this.createFailureResponse(fallbackResult.error.message);
  }

  /**
   * Get available extraction engines
   */
  static getAvailableEngines(): ReadonlyArray<EngineInfo> {
    return [
      {
        name: "pdf-lib",
        description: "PDF-lib based extraction with full format support",
        available: true,
        capabilities: {
          formats: ["jpg", "jpeg", "png", "jp2", "jpx", "j2c", "jpm", "tiff"],
          supportsMetadata: true,
          supportsEmbeddedImages: true,
          supportsVectorImages: false,
        },
      },
      {
        name: "poppler",
        description: "Poppler-based extraction using pdfimages command",
        available: false,
        capabilities: {
          formats: ["jpg", "jpeg", "png", "tiff", "ppm", "pbm"],
          supportsMetadata: true,
          supportsEmbeddedImages: true,
          supportsVectorImages: true,
        },
      },
    ];
  }

  /**
   * Get engine recommendations
   */
  static getEngineRecommendations(): ReadonlyArray<EngineRecommendation> {
    return [
      {
        useCase: "Maximum format support and metadata accuracy",
        engine: "pdf-lib",
        reason: "Supports all common formats including JPEG 2000 variants",
      },
      {
        useCase: "Vector image extraction",
        engine: "poppler",
        reason: "Can extract vector graphics as raster images",
      },
    ];
  }

  /**
   * Create extraction configuration
   */
  private createConfig(
    pdfPath: string,
    options: ExtractionOptions
  ): ImageExtractionConfig {
    const normalizedOptions: ExtractionOptions = {
      verbose: false,
      extractImageFiles: false,
      ...options,
    };

    const logger = createLogger(normalizedOptions.verbose ?? false);

    return {
      pdfPath,
      options: normalizedOptions,
      logger,
    };
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(
    config: ImageExtractionConfig
  ): Promise<Result<void, FileSystemError>> {
    const { options } = config;

    if (!options.extractImageFiles || !options.imageOutputDir) {
      return success(undefined);
    }

    return tryCatchAsync(async () => {
      await fs.mkdir(options.imageOutputDir!, { recursive: true });
    }).then((result) =>
      result.success
        ? success(undefined)
        : failure(
            new FileSystemError(
              `Failed to create output directory: ${options.imageOutputDir}`,
              options.imageOutputDir!,
              { originalError: result.error }
            )
          )
    );
  }

  /**
   * Extract images using configured engine
   */
  private async extractWithEngine(
    config: ImageExtractionConfig
  ): Promise<Result<ImageExtractionResponse, ImageExtractionError>> {
    const { pdfPath, options, logger } = config;

    logger.info(`🖼️  Extracting images from: ${pdfPath}`);
    logger.info(`🔧 Using engine: pdf-lib`);

    return tryCatchAsync(async () => {
      const engine = await ImageEngineFactory.getEngine();
      logger.info(`   ✅ Selected engine: ${engine.name}`);

      const result = await engine.extractImages(pdfPath, options);

      if (!result.success) {
        throw new ImageExtractionError(
          result.error ?? "Engine extraction failed",
          undefined,
          { engine: engine.name }
        );
      }

      return this.createSuccessResponse(
        result.images ?? [],
        engine.name,
        result.totalPages
      );
    }).then((result) =>
      result.success
        ? success(result.data)
        : failure(toExtractionError(result.error) as ImageExtractionError)
    );
  }

  /**
   * Extract images with fallback engine
   */
  private async extractWithFallback(
    config: ImageExtractionConfig
  ): Promise<Result<ImageExtractionResponse, ImageExtractionError>> {
    return tryCatchAsync(async () => {
      const engine = await ImageEngineFactory.getEngine();
      const result = await engine.extractImages(config.pdfPath, config.options);

      if (!result.success) {
        throw new ImageExtractionError(
          result.error ?? "Fallback extraction failed",
          undefined,
          { engine: "pdf-lib" }
        );
      }

      return this.createSuccessResponse(
        result.images ?? [],
        engine.name,
        result.totalPages
      );
    }).then((result) =>
      result.success
        ? success(result.data)
        : failure(toExtractionError(result.error) as ImageExtractionError)
    );
  }

  /**
   * Create success response
   */
  private createSuccessResponse(
    images: ReadonlyArray<ImageItem>,
    engineName: string,
    totalPages?: number
  ): ImageExtractionResult {
    return {
      success: true,
      images,
      metadata: {
        totalImages: images.length,
        engine: engineName,
        ...(totalPages !== undefined && { totalPages }),
      },
    };
  }

  /**
   * Create failure response
   */
  private createFailureResponse(error: string): ImageExtractionFailure {
    return {
      success: false,
      error,
      images: [],
    };
  }
}
