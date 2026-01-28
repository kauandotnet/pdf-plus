import fs from "node:fs";
import path from "node:path";
import type {
  ExtractionOptions,
  ExtractionResult,
  ExtractorConfig,
  ProgressInfo,
  ValidationError,
  TextItem,
  ImageItem,
  PageExtractionResult,
  PageData,
} from "../types/index.js";
import { validateConfig } from "../utils/validation.js";
import { TextExtractor } from "../extractors/text/text-extractor.js";
import { ImageExtractor } from "../extractors/image/image-extractor.js";
import { PageToImageConverter } from "../extractors/page-to-image/page-to-image-converter.js";
import { FormatProcessor } from "../utils/format-processor.js";
import { StructuredDataGenerator } from "../utils/structured-data-generator.js";
import { CacheManager } from "../utils/cache-manager.js";

/**
 * Main PDF content extractor class
 *
 * Provides comprehensive PDF content extraction capabilities including:
 * - Text extraction with positioning and formatting
 * - Image detection and extraction
 * - Structured data generation
 * - Page-specific extraction
 * - Caching for performance optimization
 *
 * @example
 * ```typescript
 * const extractor = new PDFExtractor();
 * const result = await extractor.extract('document.pdf', {
 *   extractText: true,
 *   extractImages: true,
 *   verbose: true
 * });
 * ```
 */
export class PDFExtractor {
  private textExtractor: TextExtractor;
  private imageExtractor: ImageExtractor;
  private pageToImageConverter: PageToImageConverter;
  private formatProcessor: FormatProcessor;
  private structuredDataGenerator: StructuredDataGenerator;
  private cacheManager: CacheManager;

  /**
   * Create a new PDFExtractor instance
   *
   * @param cacheDir - Optional directory for caching extracted data
   */
  constructor(cacheDir?: string) {
    this.textExtractor = new TextExtractor();
    this.imageExtractor = new ImageExtractor();
    this.pageToImageConverter = new PageToImageConverter();
    this.formatProcessor = new FormatProcessor();
    this.structuredDataGenerator = new StructuredDataGenerator();
    this.cacheManager = new CacheManager(cacheDir);
  }

  /**
   * Extract content from a PDF file
   *
   * This is the main extraction method that can extract text, images, or both
   * depending on the provided options. It supports various output formats and
   * processing modes.
   *
   * @param pdfPath - Path to the PDF file to extract content from
   * @param options - Configuration options for extraction
   * @returns Promise resolving to complete extraction results
   *
   * @throws {ValidationError} When configuration is invalid
   * @throws {ExtractionError} When PDF processing fails
   *
   * @example
   * ```typescript
   * // Extract both text and images
   * const result = await extractor.extract('document.pdf', {
   *   extractText: true,
   *   extractImages: true,
   *   extractImageFiles: true,
   *   imageOutputDir: './images',
   *   verbose: true
   * });
   *
   * console.log(`Extracted ${result.images.length} images`);
   * console.log(`Text: ${result.cleanText.substring(0, 100)}...`);
   * ```
   */
  async extract(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const config: ExtractorConfig = {
      pdfPath,
      outputDir: options.imageOutputDir || "./extracted-images",
      options: {
        extractText: true,
        extractImages: true,
        extractImageFiles: false,
        useImagePaths: false,
        imageRefFormat: "[IMAGE:{id}]",
        verbose: false,
        // Default includePageMarkers to true to ensure proper page boundary detection
        // This prevents issues where pages appear "empty" when they're actually part of continuous text
        includePageMarkers: true,
        pageMarkerFormat: "--- PAGE {page} ---",
        ...options,
      },
    };

    // Validate configuration
    const validationErrors = this.validateConfiguration(config);
    if (validationErrors.length > 0) {
      throw this.createValidationError(
        "Invalid configuration",
        validationErrors
      );
    }

    try {
      // Check if PDF file exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
      }

      const startTime = Date.now();
      this.reportProgress(config.options, {
        currentPage: 0,
        totalPages: 0,
        phase: "processing",
      });

      // Extract text content
      let textData = null;
      let textDataWithMarkers = null;
      if (config.options.extractText) {
        if (config.options.verbose) {
          console.log("📝 Extracting text content...");
        }

        // Always extract clean text first
        textData = await this.textExtractor.extract(pdfPath);

        // Generate text with page markers if requested OR if image refs are needed
        if (
          config.options.includePageMarkers ||
          config.options.includeImageRefs
        ) {
          const pageMarkerFormat =
            config.options.pageMarkerFormat || "--- PAGE {page} ---";
          const pageOffset = config.options.pageOffset || 0;
          const extractOptions: {
            pageOffset: number;
            includeImageRefs: boolean;
            imageRefFormat: string;
          } = {
            pageOffset,
            includeImageRefs: config.options.includeImageRefs ?? false,
            imageRefFormat:
              config.options.imageRefFormat ?? "[IMG:{id}] {name}",
          };

          textDataWithMarkers = await this.textExtractor.extractWithPageMarkers(
            pdfPath,
            pageMarkerFormat,
            extractOptions
          );
        }
      }

      // Extract text items if requested
      let textItems: TextItem[] = [];
      if (config.options.extractTextItems && config.options.extractText) {
        if (config.options.verbose) {
          console.log("📝 Extracting text items...");
        }
        textItems = await this.textExtractor.extractTextItems(
          pdfPath,
          config.options
        );
      }

      // Extract images
      let imageData = null;
      if (config.options.extractImages) {
        if (config.options.verbose) {
          console.log("🖼️  Extracting image references...");
        }
        imageData = await this.imageExtractor.extract(pdfPath, config.options);
      }

      // Generate page images and thumbnails if requested
      let pageImagesData: Map<number, any> | null = null;
      let thumbnailsData: Map<number, any> | null = null;

      if (
        config.options.generatePageImages ||
        config.options.generateThumbnails
      ) {
        const totalPages = imageData?.totalPages || textData?.numPages || 0;
        const pageNumbers =
          config.options.pageNumbers ||
          Array.from({ length: totalPages }, (_, i) => i + 1);

        // Generate page images with quality variants
        if (config.options.generatePageImages) {
          pageImagesData = await this.generatePageImagesWithVariants(
            pdfPath,
            pageNumbers,
            config.options
          );
        }

        // Generate thumbnails
        if (config.options.generateThumbnails) {
          thumbnailsData = await this.generatePageThumbnails(
            pdfPath,
            pageNumbers,
            config.options
          );
        }
      }

      // Process and format results
      const result = await this.processResults(
        pdfPath,
        textData,
        textDataWithMarkers,
        imageData,
        textItems,
        config.options,
        startTime,
        pageImagesData,
        thumbnailsData
      );

      this.reportProgress(config.options, {
        currentPage: result.document.pages,
        totalPages: result.document.pages,
        phase: "complete",
      });

      return result;
    } catch (error) {
      if (config.options.verbose) {
        console.error("💥 Error during extraction:", error);
      }
      throw this.createExtractionError("PDF content extraction failed", error);
    }
  }

  /**
   * Extract only text content (optimized)
   *
   * This method is optimized for text-only extraction and is faster than
   * the full extract() method when you only need text content.
   *
   * @param pdfPath - Path to the PDF file
   * @param options - Partial extraction options (images will be disabled)
   * @returns Promise resolving to extracted text content
   *
   * @example
   * ```typescript
   * const text = await extractor.extractText('document.pdf', {
   *   verbose: true
   * });
   * console.log(`Extracted ${text.length} characters`);
   * ```
   */
  async extractText(
    pdfPath: string,
    options: Partial<ExtractionOptions> = {}
  ): Promise<string> {
    const result = await this.extract(pdfPath, {
      ...options,
      extractText: true,
      extractImages: false,
    });
    return result.cleanText;
  }

  /**
   * Extract only image references (optimized)
   */
  async extractImages(
    pdfPath: string,
    options: Partial<ExtractionOptions> = {}
  ): Promise<ExtractionResult["images"]> {
    const result = await this.extract(pdfPath, {
      ...options,
      extractText: false,
      extractImages: true,
    });
    return result.images;
  }

  /**
   * Extract and save image files
   */
  async extractImageFiles(
    pdfPath: string,
    outputDir: string = "./extracted-images",
    options: Partial<ExtractionOptions> = {}
  ): Promise<string[]> {
    const result = await this.extract(pdfPath, {
      ...options,
      extractImageFiles: true,
      imageOutputDir: outputDir,
      useImagePaths: true,
    });

    return result.images
      .filter((img) => img.filePath)
      .map((img) => img.filePath as string);
  }

  /**
   * Generate page images (render PDF pages to image files)
   *
   * This is a simplified method to only render PDF pages to images
   * without extracting embedded images or text.
   *
   * @param pdfPath - Path to the PDF file
   * @param outputDir - Directory to save page images
   * @param options - Optional configuration (pageImageFormat, pageImageDpi, pageRenderEngine, etc.)
   * @returns Promise resolving to array of generated image file paths
   *
   * @example
   * ```typescript
   * const extractor = new PDFExtractor();
   * const imagePaths = await extractor.generatePageImages('document.pdf', './page-images', {
   *   pageImageFormat: 'jpg',
   *   pageImageDpi: 150,
   *   pageRenderEngine: 'poppler'
   * });
   * console.log(`Generated ${imagePaths.length} page images`);
   * ```
   */
  async generatePageImages(
    pdfPath: string,
    outputDir: string = "./page-images",
    options: Partial<ExtractionOptions> = {}
  ): Promise<string[]> {
    const result = await this.extract(pdfPath, {
      ...options,
      extractText: true, // Required for validation
      extractImages: false,
      extractImageFiles: false,
      generatePageImages: true,
      generateStructuredData: true,
      includePageImagesInStructuredData: true,
      imageOutputDir: outputDir,
    });

    // Extract page image paths from structured data
    const pageImagePaths: string[] = [];
    if (result.structuredData?.pages) {
      for (const page of result.structuredData.pages) {
        if (page.pageImage?.path) {
          pageImagePaths.push(page.pageImage.path);
        }
      }
    }

    return pageImagePaths;
  }

  private validateConfiguration(config: ExtractorConfig): ValidationError[] {
    return validateConfig(config);
  }

  private async processResults(
    pdfPath: string,
    textData: {
      text: string;
      pages?: string[];
      numPages?: number;
      info?: Record<string, unknown>;
    } | null,
    textDataWithMarkers: { text: string; pages?: string[] | PageData[] } | null,
    imageData: { images: ImageItem[]; totalPages?: number } | null,
    textItems: TextItem[],
    options: ExtractionOptions,
    startTime: number,
    pageImagesData?: Map<number, any> | null,
    thumbnailsData?: Map<number, any> | null
  ): Promise<ExtractionResult> {
    const filename = path.basename(pdfPath);
    const processingTime = Date.now() - startTime;

    // Build the result object
    const cleanText = this.extractRawText(textData?.text || ""); // Apply raw text cleaning
    const result: ExtractionResult = {
      document: {
        filename,
        pages: imageData?.totalPages || textData?.numPages || 0,
        textLength: textData?.text?.length || 0,
        extractedAt: new Date().toISOString(),
        metadata: textData?.info || {},
        options,
      },
      pages: [],
      images: imageData?.images || [],
      textItems: textItems,
      text: cleanText, // Main text content (alias for cleanText for backward compatibility)
      textWithRefs: "",
      cleanText: cleanText,
    };

    // Generate text with image references if both are available
    if (options.extractText && options.extractImages && textData && imageData) {
      // If we have textDataWithMarkers (from CombinedPageExtractor), it already includes image refs
      if (textDataWithMarkers?.text && options.includeImageRefs) {
        result.textWithRefs = textDataWithMarkers.text;
      } else if (options.includeImageRefs) {
        // Generate image refs using formatProcessor
        const baseText = textDataWithMarkers?.text || textData.text;
        result.textWithRefs = this.formatProcessor.generateTextWithImageRefs(
          baseText,
          imageData.images,
          options.imageRefFormat || "[IMAGE:{id}]",
          result.document.pages
        );
      } else {
        // No image refs requested, use clean text
        result.textWithRefs = textDataWithMarkers?.text || textData.text;
      }
    } else if (options.extractText && textData) {
      // Use marked text if available, otherwise use clean text
      result.textWithRefs = textDataWithMarkers?.text || textData.text;
    } else if (options.extractImages && imageData) {
      result.textWithRefs = this.formatProcessor.generateImageOnlyRefs(
        imageData.images,
        options.imageRefFormat || "[IMAGE:{id}]"
      );
    }

    // Add summary
    result.summary = {
      totalPages: result.document.pages,
      totalTextItems: 0, // Will be calculated by extractors
      totalImages: result.images.length,
      totalTextLength: result.document.textLength,
      averageImagesPerPage: (
        result.images.length / result.document.pages
      ).toFixed(2),
      pagesWithImages: new Set(result.images.map((img) => img.page)).size,
    };

    // Generate structured page data if requested
    if (options.generateStructuredData) {
      const textForStructured = result.textWithRefs || result.cleanText;
      result.structuredData =
        this.structuredDataGenerator.generateStructuredData(
          filename,
          textForStructured,
          result.images,
          result.document.pages,
          options,
          pageImagesData,
          thumbnailsData
        );

      if (options.verbose) {
        console.log(
          `📊 Generated structured data for ${result.document.pages} pages`
        );
      }
    }

    if (options.verbose) {
      console.log(`✅ Extraction complete in ${processingTime}ms`);
      console.log(`📄 Pages: ${result.document.pages}`);
      console.log(`📝 Text length: ${result.document.textLength}`);
      console.log(`🖼️  Images: ${result.images.length}`);
    }

    return result;
  }

  /**
   * Get text for a specific page
   */
  async getText(
    pdfPath: string,
    pageNumber: number,
    options: ExtractionOptions = {}
  ): Promise<string> {
    const pageResult = await this.getPage(pdfPath, pageNumber, {
      ...options,
      extractText: true,
      extractImages: false,
    });
    return pageResult.text;
  }

  /**
   * Get images for a specific page
   */
  async getImages(
    pdfPath: string,
    pageNumber: number,
    options: ExtractionOptions = {}
  ): Promise<ImageItem[]> {
    const pageResult = await this.getPage(pdfPath, pageNumber, {
      ...options,
      extractText: false,
      extractImages: true,
    });
    return pageResult.images;
  }

  /**
   * Get text items for a specific page
   */
  async getTextItems(
    pdfPath: string,
    pageNumber: number,
    options: ExtractionOptions = {}
  ): Promise<TextItem[]> {
    const pageResult = await this.getPage(pdfPath, pageNumber, {
      ...options,
      extractText: true,
      extractTextItems: true,
    });
    return pageResult.textItems;
  }

  /**
   * Get raw text for a specific page (no page markers, image refs, just clean text)
   */
  async getRawText(
    pdfPath: string,
    pageNumber: number,
    options: ExtractionOptions = {}
  ): Promise<string> {
    const pageResult = await this.getPage(pdfPath, pageNumber, {
      ...options,
      extractText: true,
      extractImages: false,
    });
    return pageResult.rawText;
  }

  /**
   * Get complete page data (text + images + text items)
   */
  async getPage(
    pdfPath: string,
    pageNumber: number,
    options: ExtractionOptions = {}
  ): Promise<PageExtractionResult> {
    // Check cache first if enabled
    if (options.useCache !== false) {
      const cached = this.cacheManager.getCachedPageResult(pdfPath, pageNumber);
      if (cached) {
        if (options.verbose) {
          console.log(`📋 Using cached data for page ${pageNumber}`);
        }
        return cached;
      }
    }

    // Extract page-specific data
    const pageOptions = { ...options, specificPages: [pageNumber] };
    const fullResult = await this.extract(pdfPath, pageOptions);

    // Filter results for the specific page
    const pageText = this.extractPageText(
      fullResult.textWithRefs || fullResult.cleanText,
      pageNumber
    );
    const pageImages = fullResult.images.filter(
      (img) => img.page === pageNumber
    );
    const pageTextItems =
      fullResult.textItems?.filter((item) => item.page === pageNumber) || [];

    const rawText = this.extractRawText(pageText);

    const result: PageExtractionResult = {
      pageNumber,
      text: pageText,
      rawText: rawText,
      textItems: pageTextItems,
      images: pageImages,
      metadata: {
        wordCount: this.countWords(rawText), // Count words from raw text
        characterCount: rawText.length, // Count characters from raw text
        imageCount: pageImages.length,
      },
    };

    // Cache the result if enabled
    if (options.useCache !== false) {
      this.cacheManager.cachePageResult(pdfPath, pageNumber, result);
    }

    return result;
  }

  /**
   * Extract text for a specific page from full text
   */
  private extractPageText(fullText: string, pageNumber: number): string {
    // Look for page markers
    const pageMarkerRegex =
      /(?:--- PAGE (\d+) ---|🎨 ART BASEL PAGE (\d+) 🎨|PAGE (\d+))/g;
    const parts = fullText.split(pageMarkerRegex);

    if (parts.length > 1) {
      // Find the part that corresponds to our page
      for (let i = 1; i < parts.length; i += 4) {
        const pageNum = parseInt(
          parts[i] || parts[i + 1] || parts[i + 2] || "0",
          10
        );
        if (pageNum === pageNumber) {
          return parts[i + 3] || "";
        }
      }
    }

    // Fallback: estimate by splitting text evenly
    const lines = fullText.split("\n");
    const linesPerPage = Math.ceil(lines.length / pageNumber);
    const startLine = (pageNumber - 1) * linesPerPage;
    const endLine = Math.min(pageNumber * linesPerPage, lines.length);

    return lines.slice(startLine, endLine).join("\n");
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Extract raw text without page markers, image references, or formatting
   */
  private extractRawText(text: string): string {
    let rawText = text;

    // Remove page markers (various formats)
    rawText = rawText.replace(/--- PAGE \d+ ---\s*/g, "");
    rawText = rawText.replace(/🎨 ART BASEL PAGE \d+ 🎨\s*/g, "");
    rawText = rawText.replace(/PAGE \d+\s*/g, "");

    // Remove image references (various formats)
    rawText = rawText.replace(/\[IMG:\w+\]\s*\w*\s*/g, "");
    rawText = rawText.replace(/\[IMG-\w+\]\s*[^[\n]*\s*/g, "");
    rawText = rawText.replace(
      /📷\s*[^-\n]*-\s*Page\s*\d+\s*-\s*Image\s*#\d+\s*/g,
      ""
    );
    rawText = rawText.replace(
      /🎨\s*Art\s*Basel\s*Image\s*\d+\s*\(Page\s*\d+\)\s*/g,
      ""
    );

    // Clean up extra whitespace and newlines
    rawText = rawText.replace(/\n\s*\n\s*\n/g, "\n\n"); // Max 2 consecutive newlines
    rawText = rawText.replace(/^\s+|\s+$/g, ""); // Trim start/end
    rawText = rawText.replace(/[ \t]+/g, " "); // Multiple spaces to single space

    return rawText;
  }

  /**
   * Clear cache for a PDF
   */
  clearCache(pdfPath: string): void {
    this.cacheManager.clearCache(pdfPath);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getCacheStats();
  }

  /**
   * Generate page images with multiple quality variants
   */
  private async generatePageImagesWithVariants(
    pdfPath: string,
    pageNumbers: number[],
    options: ExtractionOptions
  ): Promise<Map<number, any>> {
    const pageImagesMap = new Map<number, any>();
    const outputDir = options.imageOutputDir || "./page-images";
    const format = options.pageImageFormat || "png";
    const dpi = options.pageImageDpi || 150;
    const qualities = options.pageImageQualities || [
      options.pageImageQuality || 90,
    ];
    // Note: poppler engine removed - now using pdfjs only
    if (options.verbose) {
      console.log(
        `📸 Generating page images for ${pageNumbers.length} pages using pdfjs...`
      );
    }

    // Use pdfjs-based converter
    const converter = this.pageToImageConverter;

    // Generate default quality page images
    const defaultQuality = qualities[0];
    const convertOptions: any = {
      outputDir: path.join(outputDir, format),
      format,
      quality: defaultQuality,
      dpi,
      pages: pageNumbers,
      verbose: options.verbose ?? false,
    };
    const result = await converter.convertToImages(pdfPath, convertOptions);

    // Store default quality images
    for (const pageImage of result.images) {
      const stats = fs.statSync(pageImage.filepath);
      pageImagesMap.set(pageImage.page, {
        path: pageImage.filepath,
        format: pageImage.format,
        width: pageImage.width,
        height: pageImage.height,
        size: stats.size,
        dpi,
        quality: defaultQuality,
        variants: [],
      });
    }

    // Generate quality variants if requested
    if (qualities.length > 1) {
      for (const quality of qualities.slice(1)) {
        const variantOptions: any = {
          outputDir: path.join(outputDir, `${format}-q${quality}`),
          format,
          quality,
          dpi,
          pages: pageNumbers,
          verbose: false,
        };
        const variantResult = await converter.convertToImages(
          pdfPath,
          variantOptions
        );

        for (const pageImage of variantResult.images) {
          const stats = fs.statSync(pageImage.filepath);
          const pageData = pageImagesMap.get(pageImage.page);
          if (pageData) {
            pageData.variants.push({
              path: pageImage.filepath,
              format: pageImage.format,
              width: pageImage.width,
              height: pageImage.height,
              size: stats.size,
              quality,
              dpi,
            });
          }
        }
      }
    }

    if (options.verbose) {
      console.log(
        `✅ Generated ${pageImagesMap.size} page images with ${qualities.length} quality variant(s)`
      );
    }

    return pageImagesMap;
  }

  /**
   * Generate thumbnails for pages
   */
  private async generatePageThumbnails(
    pdfPath: string,
    pageNumbers: number[],
    options: ExtractionOptions
  ): Promise<Map<number, any>> {
    const thumbnailsMap = new Map<number, any>();
    const outputDir = options.imageOutputDir || "./page-images";
    const thumbnailQuality = options.thumbnailQuality || 80;

    if (options.verbose) {
      console.log(
        `🖼️  Generating thumbnails for ${pageNumbers.length} pages...`
      );
    }

    const thumbnailOptions: any = {
      outputDir: path.join(outputDir, "thumbnails"),
      format: "jpg",
      quality: thumbnailQuality,
      dpi: 72,
      scale: 0.25, // 25% scale for thumbnails
      pages: pageNumbers,
      verbose: options.verbose ?? false,
      filenamePattern: "thumb-{page}.{ext}",
    };
    const result = await this.pageToImageConverter.convertToImages(
      pdfPath,
      thumbnailOptions
    );

    for (const thumbnail of result.images) {
      const stats = fs.statSync(thumbnail.filepath);
      thumbnailsMap.set(thumbnail.page, {
        path: thumbnail.filepath,
        format: thumbnail.format,
        width: thumbnail.width,
        height: thumbnail.height,
        size: stats.size,
        quality: thumbnailQuality,
      });
    }

    if (options.verbose) {
      console.log(`✅ Generated ${thumbnailsMap.size} thumbnails`);
    }

    return thumbnailsMap;
  }

  private reportProgress(
    options: ExtractionOptions,
    progress: ProgressInfo
  ): void {
    if (options.progressCallback) {
      options.progressCallback(progress);
    }
  }

  private createValidationError(
    message: string,
    errors: ValidationError[]
  ): Error {
    const error = new Error(message) as any;
    error.code = "VALIDATION_ERROR";
    error.validationErrors = errors;
    return error;
  }

  private createExtractionError(
    message: string,
    originalError: unknown
  ): Error {
    const error = new Error(message) as any;
    error.code = "EXTRACTION_ERROR";
    error.originalError = originalError;
    return error;
  }
}

// Export default instance for convenience
export const pdfExtractor = new PDFExtractor();
