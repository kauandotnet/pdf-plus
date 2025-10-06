import fs from "node:fs";
import path from "node:path";
import sizeOf from "image-size";
import type { ExtractionOptions, ImageItem } from "../../types/index.js";

/**
 * Image extraction from PDF files using pdf-lib (clean implementation based on NestJS)
 *
 * Supports multiple extraction engines including pdf-lib and poppler for
 * maximum compatibility and performance. Can extract image metadata,
 * save image files, and handle various image formats.
 *
 * @example
 * ```typescript
 * const imageExtractor = new ImageExtractor();
 * const result = await imageExtractor.extract('document.pdf', {
 *   extractImageFiles: true,
 *   imageOutputDir: './images',
 *   imageEngine: 'auto'
 * });
 * ```
 */
export class ImageExtractor {
  /**
   * Extract images from PDF file using configurable engines
   *
   * @param pdfPath - Path to the PDF file
   * @param options - Extraction options including engine selection and output settings
   * @returns Promise resolving to extraction result with image metadata
   * @throws {Error} When image extraction fails
   */
  async extract(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<any> {
    // Set default options
    const opts: ExtractionOptions = {
      verbose: false,
      extractImageFiles: false,
      ...options,
    };

    if (opts.verbose) {
      console.log(`🖼️  Extracting images from: ${pdfPath}`);
      console.log(`🔧 Using engine: pdf-lib`);
    }

    // Ensure output directory exists if extracting files
    if (opts.extractImageFiles && opts.imageOutputDir) {
      if (!fs.existsSync(opts.imageOutputDir)) {
        fs.mkdirSync(opts.imageOutputDir, { recursive: true });
      }
    }

    try {
      // Import engine factory
      const { ImageEngineFactory } = await import("./engines/engine-factory");

      // Get the PDF-lib engine
      const engine = await ImageEngineFactory.getEngine();

      if (opts.verbose) {
        console.log(`   ✅ Selected engine: ${engine.name}`);
      }

      // Use the selected engine
      const result = await engine.extractImages(pdfPath, opts);

      if (!result.success) {
        throw new Error(result.error || "Engine extraction failed");
      }

      // Check if we should use Poppler fallback
      const shouldUsePopplerFallback =
        opts.usePopplerFallback && result.images && result.images.length === 0;

      if (shouldUsePopplerFallback) {
        if (opts.verbose) {
          console.log(
            "   ⚠️  No images found with standard extraction, trying Poppler fallback..."
          );
        }

        try {
          const { PopplerImageExtractor } = await import(
            "./poppler-image-extractor.js"
          );
          const popplerExtractor = new PopplerImageExtractor();
          const popplerResult = await popplerExtractor.extractImages(
            pdfPath,
            opts
          );

          if (popplerResult.images.length > 0) {
            if (opts.verbose) {
              console.log(
                `   ✅ Poppler found ${popplerResult.images.length} images!`
              );
            }
            return {
              success: true,
              images: popplerResult.images,
              metadata: popplerResult.metadata,
            };
          }
        } catch (popplerError) {
          if (opts.verbose) {
            console.log(
              `   ⚠️  Poppler fallback failed: ${
                popplerError instanceof Error
                  ? popplerError.message
                  : "Unknown error"
              }`
            );
          }
          // Continue with original result (0 images)
        }
      }

      return {
        success: true,
        images: result.images || [],
        metadata: {
          totalImages: result.images?.length || 0,
          engine: engine.name,
        },
      };
    } catch (error) {
      if (opts.verbose) {
        console.log(
          `   ⚠️  Engine selection failed, falling back to pdf-lib: ${error}`
        );
      }

      // Fallback to pdf-lib engine
      try {
        return await this.extractWithPdfLib(pdfPath, opts);
      } catch (fallbackError) {
        if (opts.verbose) {
          console.error(
            `❌ Error extracting images: ${
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError)
            }`
          );
        }
        return {
          success: false,
          images: [],
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        };
      }
    }
  }

  /**
   * Get available image extraction engines
   */
  static async getAvailableEngines() {
    return [
      {
        name: "pdf-lib",
        description: "PDF-lib based extraction with full format support",
        available: true,
        capabilities: {
          formats: ["jpg", "jpeg", "png", "jp2", "tiff"],
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
          "Supports all PDF image formats including JPEG 2000, PNG with proper metadata extraction",
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
      const { PDFDocument, PDFName } = await import("pdf-lib");

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

      // Convert JP2 to JPG if requested
      if (!options.preserveJp2 && options.extractImageFiles) {
        const jp2Images = images.filter(
          (img) =>
            img.filePath?.endsWith(".jp2") || img.filepath?.endsWith(".jp2")
        );

        if (jp2Images.length > 0) {
          if (options.verbose) {
            console.log(
              `\n🔄 Converting ${jp2Images.length} JP2 files to JPG...`
            );
            console.log(`   🔍 options.useSharp = ${options.useSharp}`);
          }

          const { ImageOptimizer } = await import(
            "../../optimizers/image-optimizer.js"
          );

          for (const img of jp2Images) {
            const imagePath = img.filePath || img.filepath;
            if (!imagePath) continue;

            const result = await ImageOptimizer.convertJp2ToJpg(imagePath, {
              quality: 100,
              verbose: options.verbose,
              useSharp: options.useSharp,
            });

            if (result.success && result.newPath) {
              // Update image path to the new JPG file
              img.filePath = result.newPath;
              img.filepath = result.newPath;
              img.format = "jpg";
            }
          }

          if (options.verbose) {
            const successful = jp2Images.filter(
              (img) =>
                img.filePath?.endsWith(".jpg") || img.filepath?.endsWith(".jpg")
            ).length;
            console.log(
              `   ✅ Converted ${successful}/${jp2Images.length} JP2 → JPG\n`
            );
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
      const { PDFName } = await import("pdf-lib");

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

      // Save image file if requested
      if (options.extractImageFiles && options.imageOutputDir) {
        filepath = path.join(options.imageOutputDir, filename);
        fs.writeFileSync(filepath, imageData);

        if (options.verbose) {
          console.log(
            `   💾 Extracted real image: ${filename} (${size} bytes)`
          );
        }
      }

      // Get actual image dimensions from the extracted data
      // If PDF dimensions are wrong (often 100x100), use image-size to read from actual image data
      let actualWidth = widthVal;
      let actualHeight = heightVal;

      if (imageData) {
        try {
          const dimensions = sizeOf(Buffer.from(imageData));
          if (dimensions.width && dimensions.height) {
            actualWidth = dimensions.width;
            actualHeight = dimensions.height;

            if (
              options.verbose &&
              (widthVal !== actualWidth || heightVal !== actualHeight)
            ) {
              console.log(
                `   📐 Corrected dimensions from ${widthVal}x${heightVal} to ${actualWidth}x${actualHeight}`
              );
            }
          }
        } catch (err) {
          if (options.verbose) {
            console.log(
              `   ⚠️  Could not read dimensions from image data, using PDF metadata: ${widthVal}x${heightVal}`
            );
          }
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
        filePath: filepath,
      };

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
      const zlib = await import("node:zlib");
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
            const detectedFormat = this.detectImageFormat(rawPixelData);
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
          // JPEG 2000 format
          if (options.verbose) {
            console.log(`   🔧 Handling JPXDecode (JPEG 2000) compression`);
          }
          try {
            imageData = Buffer.from(pdfObject.contents);
            mimeType = "image/jp2"; // JPEG 2000
            extension = "jp2";

            if (options.verbose) {
              console.log(
                `   ✅ Extracted JPEG 2000 data: ${imageData.length} bytes`
              );
              console.log(
                `   ⚠️  JP2 format has limited compatibility. Consider using preserveJp2: false with Sharp for conversion.`
              );
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
        } else {
          // Unknown filter - try generic decompression
          if (options.verbose) {
            console.log(`   🔧 Handling unknown filter: ${filterStr}`);
          }
          try {
            const rawData = await pdfObject.asUint8Array();
            imageData = Buffer.from(rawData);

            // Try to detect format from decompressed data
            const detectedFormat = this.detectImageFormat(imageData);
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
          const detectedFormat = this.detectImageFormat(imageData);
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
   * Detect image format from binary data (from NestJS implementation)
   */
  private detectImageFormat(data: Buffer): {
    valid: boolean;
    mimeType?: string;
    extension?: string;
  } {
    if (!data || data.length < 10) {
      return { valid: false };
    }

    // JPEG
    if (data[0] === 0xff && data[1] === 0xd8) {
      return { valid: true, mimeType: "image/jpeg", extension: "jpg" };
    }

    // PNG
    if (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    ) {
      return { valid: true, mimeType: "image/png", extension: "png" };
    }

    // GIF
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
      return { valid: true, mimeType: "image/gif", extension: "gif" };
    }

    // TIFF
    if (
      (data[0] === 0x49 && data[1] === 0x49) ||
      (data[0] === 0x4d && data[1] === 0x4d)
    ) {
      return { valid: true, mimeType: "image/tiff", extension: "tiff" };
    }

    // JPEG 2000 (JP2)
    if (
      data.length >= 12 &&
      data[0] === 0x00 &&
      data[1] === 0x00 &&
      data[2] === 0x00 &&
      data[3] === 0x0c &&
      data[4] === 0x6a &&
      data[5] === 0x50 &&
      data[6] === 0x20 &&
      data[7] === 0x20
    ) {
      return { valid: true, mimeType: "image/jp2", extension: "jp2" };
    }

    return { valid: false };
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
      const { PNG } = await import("pngjs");

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
}
