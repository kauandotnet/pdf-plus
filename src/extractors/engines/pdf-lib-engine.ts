import { BaseImageEngine } from "./base-image-engine.js";
import type { ExtractionOptions, ImageItem } from "../../types/index.js";
import fs from "fs";
import path from "path";

/**
 * PDF-lib based image extraction engine
 */
export class PdfLibEngine extends BaseImageEngine {
  readonly name = "pdf-lib";
  readonly description = "PDF-lib based extraction with full format support";

  async isAvailable(): Promise<boolean> {
    try {
      await import("pdf-lib");
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities() {
    return {
      formats: ["jpg", "jpeg", "png", "jp2", "tiff"],
      supportsMetadata: true,
      supportsEmbeddedImages: true,
      supportsVectorImages: false,
    };
  }

  async extractImages(
    pdfPath: string,
    options: ExtractionOptions
  ): Promise<{
    success: boolean;
    images?: ImageItem[];
    error?: string;
  }> {
    try {
      const { PDFDocument, PDFName } = await import("pdf-lib");
      // const zlib = await import("zlib"); // Imported but not used in this scope

      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`,
        };
      }

      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      const images: ImageItem[] = [];
      let globalImageIndex = 1;

      if (options.verbose) {
        console.log(`📊 Processing ${pages.length} pages with PDF-lib engine`);
      }

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageNumber = pageIndex + 1;

        // Get page resources
        const resources = page?.node.Resources;
        if (!resources) continue;

        const resourcesDict =
          typeof resources === "function" ? resources() : resources;
        const xObjects = resourcesDict?.get?.(PDFName.of("XObject"));
        if (!xObjects) continue;

        const xObjectEntries = (xObjects as any).entries?.() || [];
        let pageImageCount = 0;

        if (options.verbose) {
          console.log(
            `   📄 Page ${pageNumber}: Found ${xObjectEntries.length} XObjects`
          );
        }

        for (const [, xObjectRef] of xObjectEntries) {
          const xObject = pdfDoc.context.lookup(xObjectRef);
          if (!xObject) continue;

          const subtype = (xObject as any).dict?.get?.(PDFName.of("Subtype"));
          if (subtype?.toString() !== "/Image") continue;

          pageImageCount++;

          // Extract image using the existing logic
          const imageResult = await this.extractImageFromPdfObject(
            xObject,
            pageNumber,
            globalImageIndex,
            options
          );

          if (imageResult) {
            images.push(imageResult);
          }

          globalImageIndex++;
        }
      }

      if (options.verbose) {
        console.log(
          `   ✅ Extracted ${images.length} images from ${pages.length} pages`
        );
      }

      return {
        success: true,
        images,
      };
    } catch (error) {
      return {
        success: false,
        error: `PDF-lib extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  private async extractImageFromPdfObject(
    pdfObject: any,
    pageNumber: number,
    imageIndex: number,
    options: ExtractionOptions
  ): Promise<ImageItem | null> {
    try {
      const { PDFName } = await import("pdf-lib");
      // const zlib = await import("zlib"); // Imported but not used in this scope

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

      // Extract image data
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

      // Generate filename
      const extension = extractionResult.extension || "bin";
      const filename = `img_p${pageNumber}_${imageIndex}.${extension}`;
      let filepath: string | undefined;
      const size = extractionResult.imageData.length;

      // Save image file if requested
      if (options.extractImageFiles && options.imageOutputDir) {
        const imagesDir = path.join(options.imageOutputDir, "images");
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        filepath = path.join(imagesDir, filename);
        fs.writeFileSync(filepath, extractionResult.imageData);

        if (options.verbose) {
          console.log(
            `   💾 Extracted real image: ${filename} (${size} bytes)`
          );
        }
      }

      return {
        id: `img_${imageIndex}`,
        filename: `images/${filename}`, // Include images/ path
        filepath: filepath || "",
        page: pageNumber,
        width: widthVal,
        height: heightVal,
        format: this.getFormatFromMimeType(extractionResult.mimeType || ""),
        mimeType: extractionResult.mimeType || "",
        size,
        position: { x: 0, y: 0, width: widthVal, height: heightVal },
      };
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ❌ Error in pdf-lib extraction: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return null;
    }
  }

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
      const zlib = await import("zlib");
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

      return {
        success: true,
        imageData,
        mimeType,
        extension,
      };
    } catch (error) {
      return {
        success: false,
        error: `Image data extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Additional helper methods would go here...
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

  private async createPngFromPdfMetadata(
    rawData: Buffer,
    width: number,
    height: number,
    colorSpace: any,
    bitsPerComponent: number,
    options: ExtractionOptions
  ): Promise<{ success: boolean; pngData?: Buffer; error?: string }> {
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

  private getFormatFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case "image/jpeg":
        return "JPEG";
      case "image/png":
        return "PNG";
      case "image/jp2":
        return "JPEG 2000";
      case "image/gif":
        return "GIF";
      case "image/tiff":
        return "TIFF";
      default:
        return "unknown";
    }
  }
}
