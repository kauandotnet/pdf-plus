import type { ExtractionOptions, ImageItem } from "../../types/index.js";
import { ParallelProcessor } from "../../utils/parallel-processor.js";
import { AdaptiveWorkerPool } from "../../utils/worker-pool.js";
import type { WorkerTask } from "../../types/worker-types.js";
import { rawPixelsToPng } from "../../utils/napi-canvas-factory.js";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { AbstractImageEngine } from "./base-image-engine.js";

/**
 * PDF-lib based image extraction engine
 */
export class PdfLibEngine extends AbstractImageEngine {
  readonly name = "pdf-lib";
  readonly description = "PDF-lib based extraction with full format support";

  getName(): string {
    return this.name;
  }

  // Lazy import cache for performance
  private static pdfLibModule: any = null;
  private static imageOptimizerModule: any = null;

  // Worker pool for CPU-intensive operations
  private workerPool: AdaptiveWorkerPool | null = null;

  override async isAvailable(): Promise<boolean> {
    try {
      await this.getPdfLibModule();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached PDF-lib module or import it
   */
  private async getPdfLibModule() {
    if (!PdfLibEngine.pdfLibModule) {
      PdfLibEngine.pdfLibModule = await import("pdf-lib");
    }
    return PdfLibEngine.pdfLibModule;
  }

  /**
   * Get cached ImageOptimizer module or import it
   */
  private async getImageOptimizerModule() {
    if (!PdfLibEngine.imageOptimizerModule) {
      PdfLibEngine.imageOptimizerModule = await import(
        "../../optimizers/index.js"
      );
    }
    return PdfLibEngine.imageOptimizerModule;
  }

  /**
   * Initialize worker pool if needed
   */
  private async initializeWorkerPool(
    options: ExtractionOptions
  ): Promise<void> {
    if (!options.useWorkerThreads || this.workerPool) return;

    this.workerPool = new AdaptiveWorkerPool({
      maxWorkerThreads: options.maxWorkerThreads,
      minWorkerThreads: options.minWorkerThreads,
      autoScaleWorkers: options.autoScaleWorkers,
      memoryThreshold: options.memoryThreshold,
      cpuThreshold: options.cpuThreshold,
      workerTaskTimeout: options.workerTaskTimeout,
      workerIdleTimeout: options.workerIdleTimeout,
      workerMemoryLimit: options.workerMemoryLimit,
      verbose: options.verbose,
    });

    if (options.verbose) {
      console.log("🔧 Worker pool initialized");
    }
  }

  /**
   * Cleanup worker pool
   */
  private async cleanupWorkerPool(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.terminate();
      this.workerPool = null;
    }
  }

  /**
   * Convert JP2 file to JPG using worker if available
   */
  private async convertJp2FileWithWorker(
    jp2Path: string,
    quality: number,
    verbose: boolean
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    const useWorker =
      this.workerPool && this.workerPool.getStats().totalWorkers > 0;

    if (!useWorker) {
      // Fall back to main thread
      const { ImageOptimizer } = await this.getImageOptimizerModule();
      return ImageOptimizer.convertJp2ToJpg(jp2Path, { quality, verbose });
    }

    try {
      // Read file
      const buffer = await fsPromises.readFile(jp2Path);

      // Convert using worker
      const task: WorkerTask = {
        type: "convert",
        taskId: `convert-${Date.now()}-${Math.random()}`,
        data: {
          buffer,
          options: { quality },
        },
      };

      const result = await this.workerPool!.execute(task);

      if (!result.success || !result.data) {
        throw new Error(result.error || "JP2 conversion failed");
      }

      // Write converted file
      const jpgPath = jp2Path.replace(/\.jp2$/i, ".jpg");
      await fsPromises.writeFile(jpgPath, result.data);

      // Delete original JP2 file
      await fsPromises.unlink(jp2Path);

      return {
        success: true,
        newPath: jpgPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Optimize image file using worker if available
   */
  private async optimizeFileWithWorker(
    filepath: string,
    options: {
      engine?: string;
      quality?: number;
      progressive?: boolean;
      verbose?: boolean;
    }
  ): Promise<{
    success: boolean;
    originalSize?: number;
    optimizedSize?: number;
    savedPercent?: number;
    engine?: string;
    error?: string;
  }> {
    const useWorker =
      this.workerPool && this.workerPool.getStats().totalWorkers > 0;

    if (!useWorker) {
      // Fall back to main thread
      const { ImageOptimizer } = await this.getImageOptimizerModule();
      return ImageOptimizer.optimizeFile(filepath, options);
    }

    try {
      // Read file
      const buffer = await fsPromises.readFile(filepath);
      const originalSize = buffer.length;

      // Determine format from extension
      const ext = path.extname(filepath).toLowerCase().slice(1);
      const format = ext === "jpg" ? "jpeg" : ext;

      // Optimize using worker
      const task: WorkerTask = {
        type: "optimize",
        taskId: `optimize-${Date.now()}-${Math.random()}`,
        data: {
          buffer,
          options: {
            format,
            quality: options.quality || 80,
            progressive: options.progressive !== false,
            engine: options.engine || "auto",
          },
        },
      };

      const result = await this.workerPool!.execute(task);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Optimization failed");
      }

      // Write optimized file
      await fsPromises.writeFile(filepath, result.data);

      const optimizedSize = result.data.length;
      const savedBytes = originalSize - optimizedSize;
      const savedPercent = (savedBytes / originalSize) * 100;

      return {
        success: true,
        originalSize,
        optimizedSize,
        savedPercent,
        engine: "worker",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
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
      // Initialize worker pool if enabled
      await this.initializeWorkerPool(options);

      // Use cached PDF-lib module
      const { PDFDocument, PDFName } = await this.getPdfLibModule();

      // Check if file exists (async)
      try {
        await fsPromises.access(pdfPath);
      } catch {
        await this.cleanupWorkerPool();
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`,
        };
      }

      // Read PDF file asynchronously
      const pdfBytes = await fsPromises.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Determine if parallel processing is enabled
      const useParallel = options.parallelProcessing !== false; // Default: true
      const maxConcurrentPages = options.maxConcurrentPages || 10;
      const maxConcurrentImages = options.maxConcurrentImages || 20;

      if (options.verbose) {
        console.log(
          `📊 Processing ${pages.length} pages with PDF-lib engine (${
            useParallel ? "parallel" : "sequential"
          })`
        );
      }

      let images: ImageItem[];

      if (useParallel) {
        // PARALLEL PROCESSING
        images = await this.extractImagesParallel(
          pdfDoc,
          pages,
          PDFName,
          options,
          maxConcurrentPages,
          maxConcurrentImages
        );
      } else {
        // SEQUENTIAL PROCESSING (original behavior)
        images = await this.extractImagesSequential(
          pdfDoc,
          pages,
          PDFName,
          options
        );
      }

      if (options.verbose) {
        console.log(
          `   ✅ Extracted ${images.length} images from ${pages.length} pages`
        );
      }

      // BATCH FILE WRITES: Write all image files in parallel
      if (
        options.extractImageFiles &&
        options.imageOutputDir &&
        images.length > 0
      ) {
        const imagesToWrite = images.filter(
          (img: any) => img._imageData && img.filepath
        );

        if (imagesToWrite.length > 0) {
          // Ensure output directory exists
          const imagesDir = path.join(options.imageOutputDir, "images");
          await fsPromises.mkdir(imagesDir, { recursive: true });

          if (options.verbose) {
            console.log(`   💾 Writing ${imagesToWrite.length} image files...`);
          }

          // Write all files in parallel
          await Promise.all(
            imagesToWrite.map((img: any) =>
              fsPromises.writeFile(img.filepath, img._imageData)
            )
          );

          // Clean up temporary data
          imagesToWrite.forEach((img: any) => {
            delete img._imageData;
          });
        }
      }

      // NEW: Convert JP2 to JPG if requested (default: true)
      const shouldConvertJp2 = options.convertJp2ToJpg !== false;
      if (shouldConvertJp2 && images.length > 0) {
        const jp2Images = images.filter(
          (img) => img.filepath && img.filepath.toLowerCase().endsWith(".jp2")
        );

        if (jp2Images.length > 0) {
          if (options.verbose) {
            console.log(
              `🔄 Converting ${jp2Images.length} JP2 images to JPG...`
            );
          }

          const maxConcurrentConversions =
            options.maxConcurrentConversions || 5;
          const quality =
            options.imageQuality !== undefined ? options.imageQuality : 100;

          if (useParallel) {
            // PARALLEL JP2 CONVERSION (with optional worker support)
            const conversionResults = await ParallelProcessor.mapSettled(
              jp2Images,
              async (image) => {
                if (image.filepath && fs.existsSync(image.filepath)) {
                  // Use worker-aware conversion method
                  return this.convertJp2FileWithWorker(
                    image.filepath,
                    quality,
                    options.verbose || false
                  );
                }
                return { success: false, error: "File not found" };
              },
              {
                maxConcurrency: maxConcurrentConversions,
                verbose: options.verbose,
              }
            );

            // Update image objects with conversion results
            conversionResults.forEach((result, index) => {
              if (
                result.status === "fulfilled" &&
                result.value.success &&
                result.value.newPath
              ) {
                const image = jp2Images[index];
                image.filepath = result.value.newPath;
                image.filename = image.filename?.replace(/\.jp2$/i, ".jpg");
                image.format = "jpg";
                image.mimeType = "image/jpeg";
              }
            });
          } else {
            // SEQUENTIAL JP2 CONVERSION (with optional worker support)
            for (const image of jp2Images) {
              if (image.filepath && fs.existsSync(image.filepath)) {
                // Use worker-aware conversion method
                const result = await this.convertJp2FileWithWorker(
                  image.filepath,
                  quality,
                  options.verbose || false
                );

                if (result.success && result.newPath) {
                  // Update image object with new path
                  image.filepath = result.newPath;
                  image.filename = image.filename?.replace(/\.jp2$/i, ".jpg");
                  image.format = "jpg";
                  image.mimeType = "image/jpeg";
                }
              }
            }
          }
        }
      }

      // NEW: Optimize images if requested
      if (options.optimizeImages && images.length > 0) {
        if (options.verbose) {
          console.log(`🎨 Optimizing ${images.length} images...`);
        }

        const maxConcurrentOptimizations =
          options.maxConcurrentOptimizations || 5;

        if (useParallel) {
          // PARALLEL IMAGE OPTIMIZATION (with optional worker support)
          const optimizationResults = await ParallelProcessor.mapSettled(
            images,
            async (image) => {
              if (image.filepath && fs.existsSync(image.filepath)) {
                // Use worker-aware optimization method
                return this.optimizeFileWithWorker(image.filepath, {
                  quality: options.imageQuality || 80,
                  verbose: false, // Reduce noise in parallel mode
                });
              }
              return { success: false, error: "File not found" };
            },
            {
              maxConcurrency: maxConcurrentOptimizations,
              verbose: options.verbose,
            }
          );

          // Log results if verbose
          if (options.verbose) {
            optimizationResults.forEach((result, index) => {
              const image = images[index];
              if (result.status === "fulfilled" && result.value.success) {
                console.log(
                  `   ✅ ${image.filename}: ${result.value.originalSize} → ${
                    result.value.optimizedSize
                  } bytes (-${result.value.savedPercent?.toFixed(1) ?? 0}%) [${
                    result.value.engine
                  }]`
                );
              } else if (
                result.status === "fulfilled" &&
                !result.value.success
              ) {
                console.log(
                  `   ⚠️  ${image.filename}: Optimization skipped (${
                    result.value.error || "unknown error"
                  })`
                );
              }
            });
          }
        } else {
          // SEQUENTIAL IMAGE OPTIMIZATION (with optional worker support)
          for (const image of images) {
            if (image.filepath && fs.existsSync(image.filepath)) {
              // Use worker-aware optimization method
              const result = await this.optimizeFileWithWorker(image.filepath, {
                quality: options.imageQuality || 80,
                verbose: options.verbose,
              });

              if (result.success && options.verbose) {
                console.log(
                  `   ✅ ${image.filename}: ${result.originalSize} → ${
                    result.optimizedSize
                  } bytes (-${result.savedPercent?.toFixed(1) ?? 0}%) [${
                    result.engine
                  }]`
                );
              } else if (!result.success && options.verbose) {
                console.log(
                  `   ⚠️  ${image.filename}: Optimization skipped (${
                    result.error || "unknown error"
                  })`
                );
              }
            }
          }
        }
      }

      // Cleanup worker pool
      await this.cleanupWorkerPool();

      return {
        success: true,
        images,
      };
    } catch (error) {
      // Cleanup worker pool on error
      await this.cleanupWorkerPool();

      return {
        success: false,
        error: `PDF-lib extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Extract images from all pages in parallel
   */
  private async extractImagesParallel(
    pdfDoc: any,
    pages: any[],
    PDFName: any,
    options: ExtractionOptions,
    maxConcurrentPages: number,
    maxConcurrentImages: number
  ): Promise<ImageItem[]> {
    // First, count images per page to calculate proper indices
    // We need to do this sequentially to maintain correct image numbering
    const pageImageCounts: number[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const resources = page?.node.Resources;
      if (!resources) {
        pageImageCounts.push(0);
        continue;
      }

      const resourcesDict =
        typeof resources === "function" ? resources() : resources;
      const xObjects = resourcesDict?.get?.(PDFName.of("XObject"));
      if (!xObjects) {
        pageImageCounts.push(0);
        continue;
      }

      const xObjectEntries = (xObjects as any).entries?.() || [];
      let imageCount = 0;
      for (const [, xObjectRef] of xObjectEntries) {
        const xObject = pdfDoc.context.lookup(xObjectRef);
        if (!xObject) continue;
        const subtype = (xObject as any).dict?.get?.(PDFName.of("Subtype"));
        if (subtype?.toString() === "/Image") {
          imageCount++;
        }
      }
      pageImageCounts.push(imageCount);
    }

    // Calculate starting image index for each page
    const startIndices: number[] = [];
    let currentIndex = 1;
    for (const count of pageImageCounts) {
      startIndices.push(currentIndex);
      currentIndex += count;
    }

    // Process pages in parallel with concurrency limit
    const pageResults = await ParallelProcessor.mapSettled(
      pages,
      async (page, pageIndex) => {
        const pageNumber = pageIndex + 1;
        const startImageIndex = startIndices[pageIndex];
        return this.extractImagesFromPage(
          pdfDoc,
          page,
          pageNumber,
          startImageIndex,
          PDFName,
          options,
          maxConcurrentImages
        );
      },
      {
        maxConcurrency: maxConcurrentPages,
        verbose: options.verbose,
      }
    );

    // Flatten results and filter out failed pages
    const allImages: ImageItem[] = [];

    pageResults.forEach((result, pageIndex) => {
      if (result.status === "fulfilled") {
        allImages.push(...result.value);
      } else if (options.verbose) {
        console.log(
          `   ⚠️  Failed to process page ${pageIndex + 1}: ${result.reason}`
        );
      }
    });

    return allImages;
  }

  /**
   * Extract images from a single page (used by parallel processing)
   */
  private async extractImagesFromPage(
    pdfDoc: any,
    page: any,
    pageNumber: number,
    startImageIndex: number,
    PDFName: any,
    options: ExtractionOptions,
    maxConcurrentImages: number
  ): Promise<ImageItem[]> {
    // Get page resources
    const resources = page?.node.Resources;
    if (!resources) return [];

    const resourcesDict =
      typeof resources === "function" ? resources() : resources;
    const xObjects = resourcesDict?.get?.(PDFName.of("XObject"));
    if (!xObjects) return [];

    const xObjectEntries = (xObjects as any).entries?.() || [];

    if (options.verbose) {
      console.log(
        `   📄 Page ${pageNumber}: Found ${xObjectEntries.length} XObjects`
      );
    }

    // Extract images from XObjects in parallel
    const imageResults = await ParallelProcessor.mapSettled(
      xObjectEntries,
      async (entry: unknown, index: number) => {
        const [, xObjectRef] = entry as [any, any];
        const xObject = pdfDoc.context.lookup(xObjectRef);
        if (!xObject) return null;

        const subtype = (xObject as any).dict?.get?.(PDFName.of("Subtype"));
        if (subtype?.toString() !== "/Image") return null;

        const imageIndex = startImageIndex + index;
        return this.extractImageFromPdfObject(
          xObject,
          pageNumber,
          imageIndex,
          options
        );
      },
      {
        maxConcurrency: maxConcurrentImages,
        verbose: false, // Don't log for each image to reduce noise
      }
    );

    // Filter out null results and failed extractions
    const images: ImageItem[] = [];
    imageResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        images.push(result.value);
      }
    });

    return images;
  }

  /**
   * Extract images from all pages sequentially (original behavior)
   */
  private async extractImagesSequential(
    pdfDoc: any,
    pages: any[],
    PDFName: any,
    options: ExtractionOptions
  ): Promise<ImageItem[]> {
    const images: ImageItem[] = [];
    let globalImageIndex = 1;

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

    return images;
  }

  private async extractImageFromPdfObject(
    pdfObject: any,
    pageNumber: number,
    imageIndex: number,
    options: ExtractionOptions
  ): Promise<ImageItem | null> {
    try {
      // Use cached PDF-lib module
      const { PDFName } = await this.getPdfLibModule();

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

      // Prepare file path if requested (actual write happens in batch later)
      if (options.extractImageFiles && options.imageOutputDir) {
        const imagesDir = path.join(options.imageOutputDir, "images");
        filepath = path.join(imagesDir, filename);

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
        // Store image data for batch writing
        _imageData: extractionResult.imageData,
      } as any;
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
            const detectedFormat = this.detectImageFormatDetailed(rawPixelData);
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
            const detectedFormat = this.detectImageFormatDetailed(imageData);
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
          const detectedFormat = this.detectImageFormatDetailed(imageData);
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
  private detectImageFormatDetailed(data: Buffer): {
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
      // Determine color space from PDF metadata
      const colorSpaceStr = colorSpace?.toString() || "";
      let componentsPerPixel = 3; // Default RGB
      let isCmyk = false;

      if (
        colorSpaceStr.includes("DeviceGray") ||
        colorSpaceStr.includes("Gray")
      ) {
        componentsPerPixel = 1;
      } else if (
        colorSpaceStr.includes("DeviceRGB") ||
        colorSpaceStr.includes("RGB")
      ) {
        componentsPerPixel = 3;
      } else if (
        colorSpaceStr.includes("DeviceCMYK") ||
        colorSpaceStr.includes("CMYK")
      ) {
        componentsPerPixel = 4;
        isCmyk = true;
      }

      // Calculate expected data size
      const expectedSize =
        width * height * componentsPerPixel * (bitsPerComponent / 8);
      const actualSize = rawData.length;

      if (options.verbose) {
        console.log(`   🔧 PDF Metadata PNG creation (@napi-rs/canvas):`);
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

      // Convert to PNG using @napi-rs/canvas
      const pngBuffer = rawPixelsToPng(
        rawData,
        width,
        height,
        componentsPerPixel,
        isCmyk
      );

      if (!pngBuffer) {
        return {
          success: false,
          error: `Unsupported color space with ${componentsPerPixel} components`,
        };
      }

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
