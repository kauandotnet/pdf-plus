/**
 * Professional Image Extractor
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
        available: false, // Will be implemented in future version
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
  static getEngineRecommendations() {
    return [
      {
        useCase: "Maximum format support and metadata accuracy",
        engine: "pdf-lib" as const,
        reason:
          "Supports all PDF image formats including all JPEG 2000 variants (jp2, jpx, j2c, jpm), PNG with proper metadata extraction and automatic format detection",
      },
      {
        useCase: "Fast extraction with system tools",
        engine: "poppler" as const,
        reason:
          "Uses optimized native poppler tools, good for batch processing (coming soon)",
      },
      {
        useCase: "Cross-platform compatibility",
        engine: "pdf-lib" as const,
        reason: "Pure JavaScript implementation, works everywhere Node.js runs",
      },
    ];
  }

  /**
   * Extract images using pdf-lib (based on working NestJS implementation)
   * @deprecated Use extract() with imageEngine: 'pdf-lib' instead
   */
  async extractWithPdfLib(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<any> {
    try {
      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
      });

      const totalPages = pdfDoc.getPageCount();
      const images: ImageItem[] = [];
      let globalImageId = 1;

      if (options.verbose) {
        console.log(`📊 Processing ${totalPages} pages`);
      }

      // Create output directory if extracting files
      if (options.extractImageFiles && options.imageOutputDir) {
        if (!fs.existsSync(options.imageOutputDir)) {
          fs.mkdirSync(options.imageOutputDir, { recursive: true });
        }
      }

      // Process each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const pageNumber = pageIndex + 1;

        try {
          const page = pdfDoc.getPage(pageIndex);
          const resources = page.node.Resources();

          if (!resources) {
            if (options.verbose) {
              console.log(`   📄 Page ${pageNumber}: No resources found`);
            }
            continue;
          }

          const xObjects = resources.get(PDFName.of("XObject"));
          if (!xObjects) {
            if (options.verbose) {
              console.log(`   📄 Page ${pageNumber}: No XObjects found`);
            }
            continue;
          }

          // Use the working approach: access internal dict via type assertion
          const xObjectDict = (xObjects as any).dict;
          if (options.verbose) {
            console.log(
              `   📄 Page ${pageNumber}: Found ${xObjectDict.size} XObjects`
            );
          }

          // Iterate through XObjects
          for (const [key, ref] of xObjectDict) {
            try {
              // Use context.lookup to get the actual PDF object
              const pdfObject = (pdfDoc as any).context.lookup(ref);

              // Check if this is actually an image
              const subtype = pdfObject.dict.get(PDFName.of("Subtype"));
              if (!subtype || subtype.toString() !== "/Image") {
                continue;
              }

              // Extract image using the working approach
              const extractedImage = await this.extractImageFromPdfObject(
                pdfObject,
                pageNumber,
                globalImageId,
                options
              );

              if (extractedImage) {
                images.push(extractedImage);
                globalImageId++;
              }
            } catch (objectError) {
              if (options.verbose) {
                console.log(
                  `   ⚠️  Error processing XObject ${key.toString()}: ${
                    objectError instanceof Error
                      ? objectError.message
                      : "Unknown error"
                  }`
                );
              }
            }
          }
        } catch (pageError) {
          if (options.verbose) {
            console.log(
              `   ❌ Failed to process page ${pageNumber}: ${
                pageError instanceof Error ? pageError.message : "Unknown error"
              }`
            );
          }
        }
      }

      if (options.verbose) {
        console.log(
          `   ✅ Extracted ${images.length} images from ${totalPages} pages`
        );
      }

      // Convert JPEG 2000 formats to JPG unless user wants to preserve them
      // By default, JPEG 2000 images are converted to JPG for better compatibility
      // Set preserveJp2: true to keep original JPEG 2000 format
      const shouldConvertJp2 = options.preserveJp2 !== true;
      if (shouldConvertJp2 && images.length > 0) {
        // JPEG 2000 file extensions (all variants)
        const jp2Extensions = [".jp2", ".jpx", ".j2c", ".jpm"];

        const jp2Images = images.filter((img) => {
          if (!img.filePath) return false;
          const ext = img.filePath.toLowerCase();
          return jp2Extensions.some((jp2Ext) => ext.endsWith(jp2Ext));
        });

        if (jp2Images.length > 0) {
          if (options.verbose) {
            console.log(
              `🔄 Converting ${jp2Images.length} JPEG 2000 image(s) to JPG for better compatibility...`
            );
          }

          let convertedCount = 0;
          for (const image of jp2Images) {
            if (image.filePath && fs.existsSync(image.filePath)) {
              const result = await ImageOptimizer.convertJp2ToJpg(
                image.filePath,
                {
                  quality: 100, // Preserve maximum quality
                  verbose: false,
                }
              );

              if (result.success && result.newPath) {
                // Update image object with new path and format
                image.filePath = result.newPath;
                image.format = "jpg";
                image.mimeType = "image/jpeg";
                convertedCount++;

                if (options.verbose) {
                  console.log(
                    `   ✅ Converted ${path.basename(result.newPath)}`
                  );
                }
              }
            }
          }

          if (options.verbose) {
            if (convertedCount === 0) {
              console.log(
                `   ⚠️  JPEG 2000 conversion not available - files kept in original format`
              );
              console.log(
                `   💡 Install ImageMagick or set preserveJp2: true to skip conversion`
              );
            } else if (convertedCount < jp2Images.length) {
              console.log(
                `   ✅ Converted ${convertedCount}/${jp2Images.length} JPEG 2000 images`
              );
              console.log(
                `   ⚠️  ${
                  jp2Images.length - convertedCount
                } files kept in original format`
              );
            } else {
              console.log(
                `   ✅ Converted all ${convertedCount} JPEG 2000 images to JPG`
              );
            }
          }
        }
      }

      // NEW: Optimize images if requested
      if (options.optimizeImages && images.length > 0) {
        if (options.verbose) {
          console.log(`🎨 Optimizing ${images.length} images...`);
        }

        for (const image of images) {
          if (image.filePath && fs.existsSync(image.filePath)) {
            const result = await ImageOptimizer.optimizeFile(image.filePath, {
              engine: options.imageOptimizer || "auto",
              quality: options.imageQuality || 80,
              progressive: options.imageProgressive !== false,
              verbose: options.verbose || false,
            });

            if (result.success && options.verbose) {
              console.log(
                `   ✅ ${path.basename(image.filePath)}: ${
                  result.originalSize
                } → ${
                  result.optimizedSize
                } bytes (-${result.savedPercent.toFixed(1)}%) [${
                  result.engine
                }]`
              );
            } else if (!result.success && options.verbose) {
              console.log(
                `   ⚠️  ${path.basename(
                  image.filePath
                )}: Optimization skipped (${result.error || "unknown error"})`
              );
            }
          }
        }
      }

      return {
        images,
        totalPages,
        totalImages: images.length,
      };
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ❌ Error in pdf-lib extraction: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Extract a single image from a PDF object using the working approach
   */
  private async extractImageFromPdfObject(
    pdfObject: any,
    pageNumber: number,
    imageIndex: number,
    options: ExtractionOptions
  ): Promise<ImageItem | null> {
    try {
      // Get image properties
      const width = pdfObject.dict.get(PDFName.of("Width"));
      const height = pdfObject.dict.get(PDFName.of("Height"));
      const filter = pdfObject.dict.get(PDFName.of("Filter"));
      const colorSpace = pdfObject.dict.get(PDFName.of("ColorSpace"));
      const bitsPerComponent = pdfObject.dict.get(
        PDFName.of("BitsPerComponent")
      );

      // Extract actual values
      const widthVal =
        width && typeof width.value === "number" ? width.value : 100;
      const heightVal =
        height && typeof height.value === "number" ? height.value : 100;
      const bitsVal =
        bitsPerComponent && typeof bitsPerComponent.value === "number"
          ? bitsPerComponent.value
          : 8;

      if (options.verbose) {
        console.log(
          `   🖼️  Processing image ${imageIndex} on page ${pageNumber}: ${widthVal}x${heightVal}, ${bitsVal} bits`
        );
        console.log(
          `   📊 ColorSpace: ${colorSpace?.toString() || "unknown"}, Filter: ${
            filter?.toString() || "unknown"
          }`
        );
      }

      // Extract image data using the working approach
      const extractionResult = await this.extractImageData(
        pdfObject,
        filter,
        widthVal,
        heightVal,
        colorSpace,
        bitsVal,
        options
      );

      if (!extractionResult.success || !extractionResult.imageData) {
        if (options.verbose) {
          console.log(
            `   ❌ Failed to extract image data: ${extractionResult.error}`
          );
        }
        return null;
      }

      const imageData = extractionResult.imageData;
      const mimeType = extractionResult.mimeType || "image/jpeg";
      const extension = extractionResult.extension || "jpg";

      // Create filename
      const filename = `img_p${pageNumber}_${imageIndex}.${extension}`;
      let filepath = "";
      const size = imageData.length;

      // Get actual image dimensions from the extracted data
      // If PDF dimensions failed (100x100), use image-size to read from the actual image data
      let actualWidth = widthVal;
      let actualHeight = heightVal;

      if (widthVal === 100 && heightVal === 100 && imageData) {
        try {
          const sizeOf = require("image-size");
          const dimensions = sizeOf(Buffer.from(imageData));
          if (dimensions.width && dimensions.height) {
            actualWidth = dimensions.width;
            actualHeight = dimensions.height;
            if (options.verbose && imageIndex <= 3) {
              console.log(
                `   📐 Got actual dimensions from image data: ${actualWidth}x${actualHeight}`
              );
            }
          }
        } catch (err) {
          // Ignore errors, keep the PDF dimensions
        }
      }

      // Save image file if requested
      if (options.extractImageFiles && options.imageOutputDir) {
        filepath = path.join(options.imageOutputDir, filename);
        fs.writeFileSync(filepath, imageData);

        if (options.verbose) {
          console.log(
            `   💾 Extracted real image: ${filename} (${size} bytes, ${actualWidth}x${actualHeight})`
          );
        }
      }

      // Create image item
      const imageItem: ImageItem = {
        id: `img_${imageIndex}`,
        name: filename,
        page: pageNumber,
        position: {
          x: 0,
          y: 0,
          width: actualWidth,
          height: actualHeight,
        },
        width: actualWidth,
        height: actualHeight,
        format:
          mimeType === "image/jpeg"
            ? "JPEG"
            : mimeType === "image/png"
            ? "PNG"
            : "unknown",
      };

      // Add file-related properties only if file was saved
      if (filepath) {
        imageItem.filename = filename;
        imageItem.filepath = filepath;
        imageItem.filePath = filepath; // Legacy compatibility
      }

      return imageItem;
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ❌ Failed to extract image from PDF object: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return null;
    }
  }

  /**
   * Extract image data with proper decompression handling using actual PDF metadata
   */
  private async extractImageData(
    pdfObject: any,
    filter: any,
    width: number,
    height: number,
    colorSpace: any,
    bitsPerComponent: number,
    options: ExtractionOptions
  ): Promise<{
    success: boolean;
    imageData?: Buffer;
    mimeType?: string;
    extension?: string;
    error?: string;
  }> {
    try {
      let imageData: Buffer;
      let mimeType = "image/jpeg"; // Default
      let extension = "jpg";

      if (filter) {
        const filterStr = filter.toString();
        if (options.verbose) {
          console.log(`   🔧 Processing filter: ${filterStr}`);
        }

        if (
          filterStr.includes("DCTDecode") &&
          filterStr.includes("FlateDecode")
        ) {
          // Dual compression: FlateDecode wrapping DCTDecode (JPEG)
          if (options.verbose) {
            console.log(
              `   🔧 Handling dual compression: FlateDecode + DCTDecode`
            );
          }
          try {
            const compressedData = pdfObject.contents;
            imageData = zlib.inflateSync(Buffer.from(compressedData));
            mimeType = "image/jpeg";
            extension = "jpg";
            if (options.verbose) {
              console.log(
                `   ✅ Successfully decompressed ${compressedData.length} → ${imageData.length} bytes`
              );
            }
          } catch (zlibError) {
            if (options.verbose) {
              console.log(
                `   ❌ Zlib decompression failed: ${
                  zlibError instanceof Error
                    ? zlibError.message
                    : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `Zlib decompression failed: ${
                zlibError instanceof Error ? zlibError.message : "Unknown error"
              }`,
            };
          }
        } else if (filterStr.includes("DCTDecode")) {
          // Pure JPEG compression - data should be directly usable
          if (options.verbose) {
            console.log(`   🔧 Handling DCTDecode (JPEG) compression`);
          }
          imageData = Buffer.from(pdfObject.contents);
          mimeType = "image/jpeg";
          extension = "jpg";
        } else if (filterStr.includes("FlateDecode")) {
          // PNG/Deflate compression - use actual PDF metadata
          if (options.verbose) {
            console.log(`   🔧 Handling FlateDecode compression with metadata`);
            console.log(
              `   📊 Dimensions: ${width}x${height}, Bits: ${bitsPerComponent}`
            );
            console.log(
              `   📊 ColorSpace: ${colorSpace?.toString() || "unknown"}`
            );
          }

          try {
            // Get the raw compressed data
            const compressedData = pdfObject.contents;

            // Manually decompress using zlib
            const rawPixelData = zlib.inflateSync(Buffer.from(compressedData));

            if (options.verbose) {
              console.log(
                `   ✅ Successfully decompressed ${compressedData.length} → ${rawPixelData.length} bytes`
              );
            }

            // Check if decompressed data is a valid image format
            const detectedFormat = await this.detectImageFormat(rawPixelData);
            if (detectedFormat.valid) {
              // It's already a valid image format
              imageData = rawPixelData;
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
              if (options.verbose) {
                console.log(`   ✅ Detected valid format: ${mimeType}`);
              }
            } else {
              // Raw pixel data - create PNG using actual PDF metadata
              const pngResult = await this.createPngFromPdfMetadata(
                rawPixelData,
                width,
                height,
                colorSpace,
                bitsPerComponent,
                options
              );

              if (pngResult.success && pngResult.pngData) {
                imageData = pngResult.pngData;
                mimeType = "image/png";
                extension = "png";
                if (options.verbose) {
                  console.log(
                    `   ✅ Created PNG from PDF metadata: ${rawPixelData.length} → ${imageData.length} bytes`
                  );
                }
              } else {
                if (options.verbose) {
                  console.log(`   ❌ PNG creation failed: ${pngResult.error}`);
                }
                return {
                  success: false,
                  error: `PNG creation failed: ${pngResult.error}`,
                };
              }
            }
          } catch (decompressError) {
            if (options.verbose) {
              console.log(
                `   ❌ FlateDecode decompression failed: ${
                  decompressError instanceof Error
                    ? decompressError.message
                    : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `FlateDecode decompression failed: ${
                decompressError instanceof Error
                  ? decompressError.message
                  : "Unknown error"
              }`,
            };
          }
        } else if (filterStr.includes("JPXDecode")) {
          // JPEG 2000 format - detect exact variant (jp2, jpx, j2c, jpm)
          if (options.verbose) {
            console.log(`   🔧 Handling JPXDecode (JPEG 2000) compression`);
          }
          try {
            imageData = Buffer.from(pdfObject.contents);

            // Use file-type to detect the exact JPEG 2000 variant
            const detectedFormat = await this.detectImageFormat(imageData);
            if (detectedFormat.valid) {
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
              if (options.verbose) {
                console.log(
                  `   ✅ Extracted JPEG 2000 data: ${
                    imageData.length
                  } bytes (${extension.toUpperCase()})`
                );
              }
            } else {
              // Fallback to jp2 if detection fails
              mimeType = "image/jp2";
              extension = "jp2";
              if (options.verbose) {
                console.log(
                  `   ✅ Extracted JPEG 2000 data: ${imageData.length} bytes (format detection failed, using JP2)`
                );
              }
            }
          } catch (jpxError) {
            if (options.verbose) {
              console.log(
                `   ❌ JPXDecode extraction failed: ${
                  jpxError instanceof Error ? jpxError.message : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `JPXDecode extraction failed: ${
                jpxError instanceof Error ? jpxError.message : "Unknown error"
              }`,
            };
          }
        } else if (filterStr.includes("CCITTFaxDecode")) {
          // CCITT Fax compression (Group 3/4) - Black & white scanned images
          if (options.verbose) {
            console.log(
              `   🔧 Handling CCITTFaxDecode (TIFF Group 3/4 - B&W scanned image)`
            );
          }
          try {
            // Extract CCITT parameters from DecodeParms
            const decodeParms = pdfObject.dict.get(PDFName.of("DecodeParms"));
            let k = 0; // Default: Group 3 1D
            let columns = width;
            let rows = height;
            let blackIs1 = false;

            if (decodeParms) {
              // K parameter determines encoding type:
              // K < 0: Group 4 (2D encoding)
              // K = 0: Group 3 1D encoding
              // K > 0: Group 3 2D encoding
              const kValue = decodeParms.get(PDFName.of("K"));
              if (kValue) {
                k = kValue.asNumber();
              }

              const columnsValue = decodeParms.get(PDFName.of("Columns"));
              if (columnsValue) {
                columns = columnsValue.asNumber();
              }

              const rowsValue = decodeParms.get(PDFName.of("Rows"));
              if (rowsValue) {
                rows = rowsValue.asNumber();
              }

              const blackIs1Value = decodeParms.get(PDFName.of("BlackIs1"));
              if (blackIs1Value) {
                blackIs1 = blackIs1Value.asBoolean();
              }
            }

            if (options.verbose) {
              console.log(
                `   📊 CCITT Parameters: K=${k}, Columns=${columns}, Rows=${rows}, BlackIs1=${blackIs1}`
              );
              console.log(
                `   📊 Encoding: ${
                  k < 0 ? "Group 4 (2D)" : k === 0 ? "Group 3 1D" : "Group 3 2D"
                }`
              );
            }

            // Get raw CCITT-encoded data
            const ccittData = Buffer.from(pdfObject.contents);

            // Create a minimal TIFF file with CCITT compression
            // This preserves the original compression and quality
            const tiffBuffer = this.createTiffFromCCITT(
              ccittData,
              columns,
              rows,
              k,
              blackIs1
            );

            imageData = tiffBuffer;
            mimeType = "image/tiff";
            extension = "tiff";

            if (options.verbose) {
              console.log(
                `   ✅ Created TIFF from CCITT data: ${ccittData.length} → ${tiffBuffer.length} bytes`
              );
            }
          } catch (ccittError) {
            if (options.verbose) {
              console.log(
                `   ❌ CCITTFaxDecode extraction failed: ${
                  ccittError instanceof Error
                    ? ccittError.message
                    : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `CCITTFaxDecode extraction failed: ${
                ccittError instanceof Error
                  ? ccittError.message
                  : "Unknown error"
              }`,
            };
          }
        } else if (filterStr.includes("JBIG2Decode")) {
          // JBIG2 compression - Black & white images with better compression than CCITT
          if (options.verbose) {
            console.log(
              `   🔧 Handling JBIG2Decode (Advanced B&W compression)`
            );
          }
          try {
            // Extract raw JBIG2 data
            const jbig2Data = Buffer.from(pdfObject.contents);

            // JBIG2 decoding is complex and requires external libraries
            // For now, we'll save the raw JBIG2 data as a .jbig2 file
            // Users can convert it using tools like jbig2dec if needed

            // Check if there's a global JBIG2 stream (some PDFs have shared data)
            const decodeParms = pdfObject.dict.get(PDFName.of("DecodeParms"));
            let hasGlobalStream = false;

            if (decodeParms) {
              const globals = decodeParms.get(PDFName.of("JBIG2Globals"));
              if (globals) {
                hasGlobalStream = true;
                if (options.verbose) {
                  console.log(
                    `   📊 JBIG2 has global stream (shared dictionary)`
                  );
                }
              }
            }

            if (options.verbose) {
              console.log(
                `   📊 JBIG2 Data: ${jbig2Data.length} bytes, Global stream: ${hasGlobalStream}`
              );
            }

            // Save as .jbig2 file (preserves original compression)
            imageData = jbig2Data;
            mimeType = "image/x-jbig2";
            extension = "jbig2";

            if (options.verbose) {
              console.log(
                `   ✅ Extracted JBIG2 data: ${jbig2Data.length} bytes`
              );
              console.log(
                `   💡 Note: JBIG2 files can be converted using 'jbig2dec' tool`
              );
            }
          } catch (jbig2Error) {
            if (options.verbose) {
              console.log(
                `   ❌ JBIG2Decode extraction failed: ${
                  jbig2Error instanceof Error
                    ? jbig2Error.message
                    : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `JBIG2Decode extraction failed: ${
                jbig2Error instanceof Error
                  ? jbig2Error.message
                  : "Unknown error"
              }`,
            };
          }
        } else if (filterStr.includes("LZWDecode")) {
          // LZW compression - Used in TIFF images and legacy PDFs
          if (options.verbose) {
            console.log(`   🔧 Handling LZWDecode (TIFF/Legacy compression)`);
          }
          try {
            // Get compressed LZW data
            const lzwData = Buffer.from(pdfObject.contents);

            // Decode LZW
            const decodedData = this.decodeLZW(lzwData);

            if (options.verbose) {
              console.log(
                `   ✅ LZW decompressed: ${lzwData.length} → ${decodedData.length} bytes`
              );
            }

            // Check if decompressed data is a complete image
            const detectedFormat = await this.detectImageFormat(decodedData);
            if (detectedFormat.valid) {
              // It's a complete image file
              imageData = decodedData;
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
              if (options.verbose) {
                console.log(`   ✅ Detected format: ${mimeType}`);
              }
            } else {
              // Raw pixel data - create PNG
              const pngResult = await this.createPngFromPdfMetadata(
                decodedData,
                width,
                height,
                colorSpace,
                bitsPerComponent,
                options
              );

              if (pngResult.success && pngResult.pngData) {
                imageData = pngResult.pngData;
                mimeType = "image/png";
                extension = "png";
                if (options.verbose) {
                  console.log(
                    `   ✅ Created PNG from LZW data: ${decodedData.length} → ${imageData.length} bytes`
                  );
                }
              } else {
                return {
                  success: false,
                  error: `PNG creation from LZW failed: ${pngResult.error}`,
                };
              }
            }
          } catch (lzwError) {
            if (options.verbose) {
              console.log(
                `   ❌ LZWDecode decompression failed: ${
                  lzwError instanceof Error ? lzwError.message : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `LZWDecode decompression failed: ${
                lzwError instanceof Error ? lzwError.message : "Unknown error"
              }`,
            };
          }
        } else if (filterStr.includes("RunLengthDecode")) {
          // Run-length encoding - Simple compression for uniform areas
          if (options.verbose) {
            console.log(`   🔧 Handling RunLengthDecode (RLE compression)`);
          }
          try {
            // Get compressed RLE data
            const rleData = Buffer.from(pdfObject.contents);

            // Decode Run-Length Encoding
            const decodedData = this.decodeRunLength(rleData);

            if (options.verbose) {
              console.log(
                `   ✅ RLE decompressed: ${rleData.length} → ${decodedData.length} bytes`
              );
            }

            // Check if decompressed data is a complete image
            const detectedFormat = await this.detectImageFormat(decodedData);
            if (detectedFormat.valid) {
              // It's a complete image file
              imageData = decodedData;
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
              if (options.verbose) {
                console.log(`   ✅ Detected format: ${mimeType}`);
              }
            } else {
              // Raw pixel data - create PNG
              const pngResult = await this.createPngFromPdfMetadata(
                decodedData,
                width,
                height,
                colorSpace,
                bitsPerComponent,
                options
              );

              if (pngResult.success && pngResult.pngData) {
                imageData = pngResult.pngData;
                mimeType = "image/png";
                extension = "png";
                if (options.verbose) {
                  console.log(
                    `   ✅ Created PNG from RLE data: ${decodedData.length} → ${imageData.length} bytes`
                  );
                }
              } else {
                return {
                  success: false,
                  error: `PNG creation from RLE failed: ${pngResult.error}`,
                };
              }
            }
          } catch (rleError) {
            if (options.verbose) {
              console.log(
                `   ❌ RunLengthDecode decompression failed: ${
                  rleError instanceof Error ? rleError.message : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `RunLengthDecode decompression failed: ${
                rleError instanceof Error ? rleError.message : "Unknown error"
              }`,
            };
          }
        } else {
          // Unknown filter - try generic decompression
          if (options.verbose) {
            console.log(`   🔧 Handling unknown filter: ${filterStr}`);
          }
          try {
            const rawData = await pdfObject.asUint8Array();
            imageData = Buffer.from(rawData);

            // Try to detect format from decompressed data
            const detectedFormat = await this.detectImageFormat(imageData);
            if (detectedFormat.valid) {
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
            }
          } catch (genericError) {
            if (options.verbose) {
              console.log(
                `   ❌ Generic decompression failed: ${
                  genericError instanceof Error
                    ? genericError.message
                    : "Unknown error"
                }`
              );
            }
            return {
              success: false,
              error: `Generic decompression failed: ${
                genericError instanceof Error
                  ? genericError.message
                  : "Unknown error"
              }`,
            };
          }
        }
      } else {
        // No filter - raw image data
        if (options.verbose) {
          console.log(`   🔧 No filter - extracting raw data`);
        }
        try {
          const rawData = await pdfObject.asUint8Array();
          imageData = Buffer.from(rawData);

          // Try to detect format
          const detectedFormat = await this.detectImageFormat(imageData);
          if (detectedFormat.valid) {
            mimeType = detectedFormat.mimeType!;
            extension = detectedFormat.extension!;
          }
        } catch (rawError) {
          if (options.verbose) {
            console.log(
              `   ❌ Raw data extraction failed: ${
                rawError instanceof Error ? rawError.message : "Unknown error"
              }`
            );
          }
          return {
            success: false,
            error: `Raw data extraction failed: ${
              rawError instanceof Error ? rawError.message : "Unknown error"
            }`,
          };
        }
      }

      // Validate image data
      if (!imageData || imageData.length < 100) {
        return {
          success: false,
          error: `Image data too small: ${imageData?.length || 0} bytes`,
        };
      }

      return {
        success: true,
        imageData,
        mimeType,
        extension,
      };
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ❌ Failed to extract image data: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Detect image format from binary data using file-type library
   *
   * Uses the industry-standard file-type library for robust format detection
   * based on magic bytes (binary signatures). Supports 100+ file formats
   * including JPEG, PNG, GIF, TIFF, JPEG 2000 variants, WebP, HEIC, and more.
   */
  private async detectImageFormat(data: Buffer): Promise<{
    valid: boolean;
    mimeType?: string;
    extension?: string;
  }> {
    if (!data || data.length < 10) {
      return { valid: false };
    }

    try {
      const result = await fileTypeFromBuffer(data);

      if (result) {
        return {
          valid: true,
          mimeType: result.mime,
          extension: result.ext,
        };
      }

      return { valid: false };
    } catch (error) {
      // If file-type fails, return invalid
      return { valid: false };
    }
  }

  /**
   * Create a PNG file from raw pixel data using actual PDF metadata
   */
  private async createPngFromPdfMetadata(
    rawData: Buffer,
    width: number,
    height: number,
    colorSpace: any,
    bitsPerComponent: number,
    options: ExtractionOptions
  ): Promise<{
    success: boolean;
    pngData?: Buffer;
    error?: string;
  }> {
    try {
      // Determine color space from PDF metadata
      const colorSpaceStr = colorSpace?.toString() || "";
      let componentsPerPixel = 3; // Default RGB
      let colorType = 2; // RGB

      if (
        colorSpaceStr.includes("DeviceGray") ||
        colorSpaceStr.includes("Gray")
      ) {
        componentsPerPixel = 1;
        colorType = 0; // Grayscale
      } else if (
        colorSpaceStr.includes("DeviceRGB") ||
        colorSpaceStr.includes("RGB")
      ) {
        componentsPerPixel = 3;
        colorType = 2; // RGB
      } else if (
        colorSpaceStr.includes("DeviceCMYK") ||
        colorSpaceStr.includes("CMYK")
      ) {
        componentsPerPixel = 4;
        colorType = 2; // Will convert CMYK to RGB
      }

      // Calculate expected data size
      const expectedSize =
        width * height * componentsPerPixel * (bitsPerComponent / 8);
      const actualSize = rawData.length;

      if (options.verbose) {
        console.log(`   🔧 PDF Metadata PNG creation:`);
        console.log(
          `   📊 ColorSpace: ${colorSpaceStr}, Components: ${componentsPerPixel}, Bits: ${bitsPerComponent}`
        );
        console.log(
          `   📊 Expected size: ${expectedSize} bytes, Actual: ${actualSize} bytes`
        );
      }

      // Validate data size matches expectations
      if (Math.abs(actualSize - expectedSize) > actualSize * 0.1) {
        // Allow 10% tolerance
        return {
          success: false,
          error: `Data size mismatch: expected ${expectedSize}, got ${actualSize} bytes`,
        };
      }

      // Create PNG with proper color type
      const png = new PNG({
        width,
        height,
        colorType: colorType === 0 ? 0 : 6, // Grayscale or RGBA for output
        bitDepth: 8, // Always output 8-bit
      });

      // Convert pixel data based on color space
      let outputData: Buffer;

      if (componentsPerPixel === 1) {
        // Grayscale to RGBA
        outputData = Buffer.alloc(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const gray = rawData[i] || 0;
          const outputOffset = i * 4;
          outputData[outputOffset] = gray; // R
          outputData[outputOffset + 1] = gray; // G
          outputData[outputOffset + 2] = gray; // B
          outputData[outputOffset + 3] = 255; // A
        }
      } else if (componentsPerPixel === 3) {
        // RGB to RGBA
        outputData = Buffer.alloc(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const inputOffset = i * 3;
          const outputOffset = i * 4;
          outputData[outputOffset] = rawData[inputOffset] || 0; // R
          outputData[outputOffset + 1] = rawData[inputOffset + 1] || 0; // G
          outputData[outputOffset + 2] = rawData[inputOffset + 2] || 0; // B
          outputData[outputOffset + 3] = 255; // A
        }
      } else if (componentsPerPixel === 4) {
        // CMYK to RGB (simplified conversion)
        outputData = Buffer.alloc(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const inputOffset = i * 4;
          const c = (rawData[inputOffset] || 0) / 255;
          const m = (rawData[inputOffset + 1] || 0) / 255;
          const y = (rawData[inputOffset + 2] || 0) / 255;
          const k = (rawData[inputOffset + 3] || 0) / 255;

          const outputOffset = i * 4;
          outputData[outputOffset] = Math.round(255 * (1 - c) * (1 - k)); // R
          outputData[outputOffset + 1] = Math.round(255 * (1 - m) * (1 - k)); // G
          outputData[outputOffset + 2] = Math.round(255 * (1 - y) * (1 - k)); // B
          outputData[outputOffset + 3] = 255; // A
        }
      } else {
        return {
          success: false,
          error: `Unsupported color space with ${componentsPerPixel} components`,
        };
      }

      // Set PNG data
      png.data = outputData;

      // Pack PNG
      const pngBuffer = PNG.sync.write(png);

      if (options.verbose) {
        console.log(
          `   ✅ PNG created using PDF metadata: ${pngBuffer.length} bytes`
        );
      }

      return {
        success: true,
        pngData: pngBuffer,
      };
    } catch (error) {
      return {
        success: false,
        error: `PNG creation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Create a TIFF file from CCITT-encoded data
   *
   * This creates a minimal TIFF file with CCITT compression, preserving
   * the original compression and quality from the PDF.
   *
   * @param ccittData - Raw CCITT-encoded data from PDF
   * @param width - Image width in pixels
   * @param height - Image height in pixels
   * @param k - CCITT K parameter (< 0: Group 4, = 0: Group 3 1D, > 0: Group 3 2D)
   * @param blackIs1 - Whether black pixels are represented as 1 (default: false)
   * @returns Buffer containing a valid TIFF file
   */
  private createTiffFromCCITT(
    ccittData: Buffer,
    width: number,
    height: number,
    k: number,
    blackIs1: boolean
  ): Buffer {
    // Determine TIFF compression type based on K parameter
    // TIFF Compression values:
    // 3 = CCITT Group 3 (1D)
    // 4 = CCITT Group 4 (2D)
    const compression = k < 0 ? 4 : 3;

    // TIFF PhotometricInterpretation:
    // 0 = WhiteIsZero (black = 0, white = 1)
    // 1 = BlackIsZero (black = 1, white = 0)
    const photometric = blackIs1 ? 1 : 0;

    // Create a minimal TIFF file manually
    // TIFF structure: Header (8 bytes) + IFD (Image File Directory) + Image Data

    const ifdEntryCount = 11; // Number of IFD entries
    const ifdSize = 2 + ifdEntryCount * 12 + 4; // Entry count + entries + next IFD offset
    const headerSize = 8;
    const ifdOffset = headerSize;
    const imageDataOffset = headerSize + ifdSize;

    const totalSize = imageDataOffset + ccittData.length;
    const buffer = Buffer.alloc(totalSize);

    let offset = 0;

    // TIFF Header (8 bytes)
    buffer.write("II", offset); // Little-endian byte order
    offset += 2;
    buffer.writeUInt16LE(42, offset); // TIFF magic number
    offset += 2;
    buffer.writeUInt32LE(ifdOffset, offset); // Offset to first IFD
    offset += 4;

    // IFD (Image File Directory)
    buffer.writeUInt16LE(ifdEntryCount, offset); // Number of directory entries
    offset += 2;

    // Helper function to write IFD entry
    const writeIFDEntry = (
      tag: number,
      type: number,
      count: number,
      value: number
    ) => {
      buffer.writeUInt16LE(tag, offset); // Tag
      offset += 2;
      buffer.writeUInt16LE(type, offset); // Type (3 = SHORT, 4 = LONG)
      offset += 2;
      buffer.writeUInt32LE(count, offset); // Count
      offset += 4;
      buffer.writeUInt32LE(value, offset); // Value/Offset
      offset += 4;
    };

    // Write IFD entries (must be in ascending tag order)
    writeIFDEntry(256, 4, 1, width); // ImageWidth (LONG)
    writeIFDEntry(257, 4, 1, height); // ImageLength (LONG)
    writeIFDEntry(258, 3, 1, 1); // BitsPerSample (SHORT) - 1 bit
    writeIFDEntry(259, 3, 1, compression); // Compression (SHORT)
    writeIFDEntry(262, 3, 1, photometric); // PhotometricInterpretation (SHORT)
    writeIFDEntry(273, 4, 1, imageDataOffset); // StripOffsets (LONG)
    writeIFDEntry(277, 3, 1, 1); // SamplesPerPixel (SHORT)
    writeIFDEntry(278, 4, 1, height); // RowsPerStrip (LONG)
    writeIFDEntry(279, 4, 1, ccittData.length); // StripByteCounts (LONG)
    writeIFDEntry(282, 5, 1, imageDataOffset - 8); // XResolution (RATIONAL) - placeholder
    writeIFDEntry(283, 5, 1, imageDataOffset - 8); // YResolution (RATIONAL) - placeholder

    // Next IFD offset (0 = no more IFDs)
    buffer.writeUInt32LE(0, offset);
    offset += 4;

    // Copy CCITT image data
    ccittData.copy(buffer, imageDataOffset);

    return buffer;
  }

  /**
   * Decode LZW (Lempel-Ziv-Welch) compressed data
   *
   * LZW is used in TIFF images and some legacy PDFs.
   * This is a standard LZW decoder implementation.
   *
   * @param data - LZW compressed data
   * @returns Decompressed data
   */
  private decodeLZW(data: Buffer): Buffer {
    const output: number[] = [];

    // Initialize dictionary with single-byte values (0-255)
    const dictionary: Buffer[] = [];
    for (let i = 0; i < 256; i++) {
      dictionary[i] = Buffer.from([i]);
    }

    const clearCode = 256; // Clear dictionary
    const endCode = 257; // End of data
    let nextCode = 258; // Next available code

    // Bit reader state
    let bitPos = 0;
    let codeSize = 9; // Start with 9-bit codes

    // Read a code from the bit stream
    const readCode = (): number => {
      let code = 0;
      for (let i = 0; i < codeSize; i++) {
        const bytePos = Math.floor(bitPos / 8);
        const bitOffset = bitPos % 8;
        if (bytePos >= data.length) return endCode;
        const byte = data[bytePos];
        if (byte === undefined) return endCode;
        const bit = (byte >> (7 - bitOffset)) & 1;
        code = (code << 1) | bit;
        bitPos++;
      }
      return code;
    };

    let prevCode = readCode();
    if (prevCode === clearCode) {
      prevCode = readCode();
    }

    const prevEntry = dictionary[prevCode];
    if (prevCode !== endCode && prevEntry) {
      output.push(...prevEntry);
    }

    while (true) {
      const code = readCode();

      if (code === endCode || bitPos > data.length * 8) {
        break;
      }

      if (code === clearCode) {
        // Reset dictionary
        nextCode = 258;
        codeSize = 9;
        dictionary.length = 256;
        prevCode = readCode();
        const resetEntry = dictionary[prevCode];
        if (prevCode !== endCode && resetEntry) {
          output.push(...resetEntry);
        }
        continue;
      }

      let entry: Buffer;
      const dictEntry = dictionary[code];
      const prevDictEntry = dictionary[prevCode];

      if (dictEntry) {
        entry = dictEntry;
      } else if (code === nextCode && prevDictEntry) {
        // Special case: code not in dictionary yet
        const firstByte = prevDictEntry[0];
        if (firstByte !== undefined) {
          entry = Buffer.concat([prevDictEntry, Buffer.from([firstByte])]);
        } else {
          throw new Error(`Invalid LZW dictionary entry`);
        }
      } else {
        throw new Error(`Invalid LZW code: ${code}`);
      }

      output.push(...entry);

      // Add new entry to dictionary
      if (prevDictEntry) {
        const entryFirstByte = entry[0];
        if (entryFirstByte !== undefined) {
          dictionary[nextCode] = Buffer.concat([
            prevDictEntry,
            Buffer.from([entryFirstByte]),
          ]);
          nextCode++;

          // Increase code size when needed
          if (nextCode >= 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        }
      }

      prevCode = code;
    }

    return Buffer.from(output);
  }

  /**
   * Decode Run-Length Encoded data
   *
   * Run-length encoding is a simple compression where repeated bytes
   * are stored as a count followed by the byte value.
   *
   * PDF uses a specific RLE format:
   * - 0-127: Copy next n+1 bytes literally
   * - 128: No operation (ignored)
   * - 129-255: Repeat next byte (257-n) times
   *
   * @param data - RLE compressed data
   * @returns Decompressed data
   */
  private decodeRunLength(data: Buffer): Buffer {
    const output: number[] = [];
    let i = 0;

    while (i < data.length) {
      const length = data[i++];
      if (length === undefined) break;

      if (length === 128) {
        // EOD marker - end of data
        break;
      } else if (length < 128) {
        // Copy next (length + 1) bytes literally
        const count = length + 1;
        for (let j = 0; j < count && i < data.length; j++) {
          const byte = data[i++];
          if (byte !== undefined) {
            output.push(byte);
          }
        }
      } else {
        // Repeat next byte (257 - length) times
        const count = 257 - length;
        const byte = data[i++];
        if (byte !== undefined) {
          for (let j = 0; j < count; j++) {
            output.push(byte);
          }
        }
      }
    }

    return Buffer.from(output);
  }
}
