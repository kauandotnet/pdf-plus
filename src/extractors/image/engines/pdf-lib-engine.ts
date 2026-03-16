import { BaseImageEngine } from "./base-image-engine.js";
import type { ExtractionOptions, ImageItem } from "../../../types/index.js";
import { ParallelProcessor } from "../../../utils/parallel-processor.js";
import { AdaptiveWorkerPool } from "../../../utils/worker-pool.js";
import type { WorkerTask } from "../../../types/worker-types.js";
import { PixelConverter } from "../utils/pixel-converter.js";
import { decodePredictor } from "../../../utils/predictor-decoder.js";
import { rawRgbaToPng } from "../../../utils/napi-canvas-factory.js";
import {
  detectImageFormat,
  getFormatFromMimeType,
} from "../../../utils/image-format-detector.js";
import { getColorComponents } from "../../../utils/color-space-config.js";
import { getErrorMessage } from "../../../utils/error-utils.js";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import sizeOf from "image-size";

/**
 * PDF-lib based image extraction engine
 */
export class PdfLibEngine extends BaseImageEngine {
  readonly name = "pdf-lib";
  readonly description = "PDF-lib based extraction with full format support";

  // Lazy import cache for performance
  private static pdfLibModule: any = null;
  private static imageOptimizerModule: any = null;

  // Worker pool for CPU-intensive operations
  private workerPool: AdaptiveWorkerPool | null = null;

  async isAvailable(): Promise<boolean> {
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
        "../../../optimizers/index.js"
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

    const poolOptions: Record<string, any> = {};
    if (options.maxWorkerThreads !== undefined)
      poolOptions.maxWorkerThreads = options.maxWorkerThreads;
    if (options.minWorkerThreads !== undefined)
      poolOptions.minWorkerThreads = options.minWorkerThreads;
    if (options.autoScaleWorkers !== undefined)
      poolOptions.autoScaleWorkers = options.autoScaleWorkers;
    if (options.memoryThreshold !== undefined)
      poolOptions.memoryThreshold = options.memoryThreshold;
    if (options.cpuThreshold !== undefined)
      poolOptions.cpuThreshold = options.cpuThreshold;
    if (options.workerTaskTimeout !== undefined)
      poolOptions.workerTaskTimeout = options.workerTaskTimeout;
    if (options.workerIdleTimeout !== undefined)
      poolOptions.workerIdleTimeout = options.workerIdleTimeout;
    if (options.workerMemoryLimit !== undefined)
      poolOptions.workerMemoryLimit = options.workerMemoryLimit;
    if (options.verbose !== undefined) poolOptions.verbose = options.verbose;

    try {
      this.workerPool = new AdaptiveWorkerPool(poolOptions);
      await this.workerPool.initialize();
    } catch (error) {
      if (options.verbose) {
        console.error(
          "❌ Worker pool initialization failed:",
          getErrorMessage(error)
        );
      }
      // Don't throw - just continue without workers
      this.workerPool = null;
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
      return ImageOptimizer.convertJp2ToJpg(jp2Path, {
        quality,
        verbose,
      });
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
        error: getErrorMessage(error),
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
        error: getErrorMessage(error),
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

      if (options.verbose) {
        console.log(`   📖 Loading PDF document...`);
      }

      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });

      if (options.verbose) {
        console.log(`   📄 Getting pages...`);
      }

      const pages = pdfDoc.getPages();

      if (options.verbose) {
        console.log(`   ✅ Got ${pages.length} pages`);
      }

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

      // Use ternary to avoid let declaration
      const images: ImageItem[] = useParallel
        ? await this.extractImagesParallel(
            pdfDoc,
            pages,
            PDFName,
            options,
            maxConcurrentPages,
            maxConcurrentImages
          )
        : await this.extractImagesSequential(pdfDoc, pages, PDFName, options);

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

      // Convert JP2 to JPG for better compatibility (default: true)
      // JP2 images are decoded by PDF.js but we convert the format for compatibility
      // Only convert if files are being saved to disk
      const shouldConvertJp2 =
        options.extractImageFiles && options.preserveJp2 !== true;

      if (shouldConvertJp2 && images.length > 0) {
        const jp2Images = images.filter(
          (img) => img.filepath && img.filepath.toLowerCase().endsWith(".jp2")
        );

        if (options.verbose) {
          console.log(`   🔍 Found ${jp2Images.length} JP2 images to convert`);
        }

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
              (() => {
                const opts: Record<string, any> = {
                  maxConcurrency: maxConcurrentConversions,
                };
                if (options.verbose !== undefined)
                  opts.verbose = options.verbose;
                return opts;
              })()
            );

            // Update image objects with conversion results
            conversionResults.forEach((result, index) => {
              if (
                result.status === "fulfilled" &&
                (result.value as any).success &&
                (result.value as any).newPath
              ) {
                const image = jp2Images[index];
                if (!image) return;
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
                  } bytes (-${(result.value.savedPercent || 0).toFixed(1)}%) [${
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
                  } bytes (-${(result.savedPercent || 0).toFixed(1)}%) [${
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
          getErrorMessage(error)
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
      // Resources is a method, not a property
      const resources = page?.node?.Resources?.();
      if (!resources) {
        pageImageCounts.push(0);
        continue;
      }

      const xObjects = resources?.get?.(PDFName.of("XObject"));
      if (!xObjects) {
        pageImageCounts.push(0);
        continue;
      }

      const xObjectEntries = (xObjects as any).entries?.() || [];
      const imageCount = xObjectEntries.reduce(
        (count: number, [, xObjectRef]: [any, any]) => {
          const xObject = pdfDoc.context.lookup(xObjectRef);
          if (!xObject) return count;
          const subtype = (xObject as any).dict?.get?.(PDFName.of("Subtype"));
          return subtype?.toString() === "/Image" ? count + 1 : count;
        },
        0
      );
      pageImageCounts.push(imageCount);
    }

    // Calculate starting image index for each page using reduce
    const startIndices = pageImageCounts.reduce<number[]>((indices, _count) => {
      const nextIndex =
        indices.length === 0
          ? 1
          : indices[indices.length - 1] + pageImageCounts[indices.length - 1];
      return [...indices, nextIndex];
    }, []);

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
    // Get page resources - Resources is a method, not a property
    const resources = page?.node?.Resources?.();
    if (!resources) return [];

    const xObjects = resources?.get?.(PDFName.of("XObject"));
    if (!xObjects) return [];

    const xObjectEntries = (xObjects as any).entries?.() || [];

    if (options.verbose) {
      console.log(
        `   📄 Page ${pageNumber}: Found ${xObjectEntries.length} XObjects`
      );
    }

    // Extract images from XObjects in parallel
    const imageResults = await ParallelProcessor.mapSettled(
      xObjectEntries as Array<[any, any]>,
      async ([, xObjectRef]: [any, any], index: number) => {
        const xObject = pdfDoc.context.lookup(xObjectRef);
        if (!xObject) return null;

        const subtype = (xObject as any).dict?.get?.(PDFName.of("Subtype"));
        if (subtype?.toString() !== "/Image") return null;

        const imageIndex = startImageIndex + index;
        return this.extractImageFromPdfObject(
          xObject,
          pageNumber,
          imageIndex,
          options,
          pdfDoc
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

      // Get page resources - Resources is a method, not a property
      const resources = page?.node?.Resources?.();
      if (!resources) continue;

      const xObjects = resources?.get?.(PDFName.of("XObject"));
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
          options,
          pdfDoc
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
    options: ExtractionOptions,
    pdfDoc?: any
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
      const decodeParms = pdfObject.dict.get(PDFName.of("DecodeParms"));

      // Extract actual values using IIFE to avoid let declarations
      // pdf-lib returns PDFNumber objects with asNumber() method
      const { widthVal, heightVal } = (() => {
        const initialWidth = width
          ? typeof width.asNumber === "function"
            ? width.asNumber()
            : width.value ?? 100
          : 100;
        const initialHeight = height
          ? typeof height.asNumber === "function"
            ? height.asNumber()
            : height.value ?? 100
          : 100;

        // If still 100x100, try to get from the stream itself
        if (initialWidth === 100 && initialHeight === 100 && pdfObject.dict) {
          // Try direct lookup from dictionary entries
          const dictEntries = pdfObject.dict.entries();
          const dimensions = Array.from(
            dictEntries as Iterable<[any, any]>
          ).reduce<{
            width: number;
            height: number;
          }>(
            (
              acc: { width: number; height: number },
              [key, val]: [any, any]
            ) => {
              if (key.toString() === "/Width" && val?.asNumber) {
                return { ...acc, width: val.asNumber() };
              }
              if (key.toString() === "/Height" && val?.asNumber) {
                return { ...acc, height: val.asNumber() };
              }
              return acc;
            },
            { width: initialWidth, height: initialHeight }
          );
          return { widthVal: dimensions.width, heightVal: dimensions.height };
        }
        return { widthVal: initialWidth, heightVal: initialHeight };
      })();
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
        decodeParms,
        options,
        pdfDoc
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
      const size = extractionResult.imageData.length;

      // Get actual image dimensions from the extracted data using IIFE
      // If PDF dimensions failed, use image-size to read from the actual image data
      const { finalWidth, finalHeight } = (() => {
        if (options.verbose && imageIndex <= 3) {
          console.log(
            `   🔍 Before image-size: ${widthVal}x${heightVal}, hasImageData: ${!!extractionResult.imageData}`
          );
        }

        if (
          widthVal === 100 &&
          heightVal === 100 &&
          extractionResult.imageData
        ) {
          try {
            const dimensions = sizeOf(Buffer.from(extractionResult.imageData));
            if (dimensions.width && dimensions.height) {
              if (options.verbose && imageIndex <= 3) {
                console.log(
                  `   📐 Got dimensions from image data: ${dimensions.width}x${dimensions.height}`
                );
              }
              return {
                finalWidth: dimensions.width,
                finalHeight: dimensions.height,
              };
            }
          } catch (err) {
            if (options.verbose && imageIndex <= 3) {
              console.log(
                `   ⚠️  Failed to get dimensions from image data: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`
              );
            }
          }
        }
        return { finalWidth: widthVal, finalHeight: heightVal };
      })();

      // Prepare file path if requested (actual write happens in batch later)
      const filepath = (() => {
        if (options.extractImageFiles && options.imageOutputDir) {
          const imagesDir = path.join(options.imageOutputDir, "images");
          const fp = path.join(imagesDir, filename);

          if (options.verbose) {
            console.log(
              `   💾 Extracted real image: ${filename} (${size} bytes, ${finalWidth}x${finalHeight})`
            );
          }
          return fp;
        }
        return undefined;
      })();

      return {
        id: `img_${imageIndex}`,
        filename: `images/${filename}`, // Include images/ path
        filepath: filepath || "",
        page: pageNumber,
        width: finalWidth,
        height: finalHeight,
        format: this.getFormatFromMimeTypeLocal(extractionResult.mimeType || ""),
        mimeType: extractionResult.mimeType || "",
        size,
        position: { x: 0, y: 0, width: finalWidth, height: finalHeight },
        // Store image data for batch writing
        _imageData: extractionResult.imageData,
      } as any;
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ❌ Error in pdf-lib extraction: ${
            getErrorMessage(error)
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
    decodeParms: any,
    options: ExtractionOptions,
    pdfDoc?: any
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
                  getErrorMessage(zlibError)
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
            let rawPixelData = zlib.inflateSync(Buffer.from(compressedData));

            if (options.verbose) {
              console.log(
                `   ✅ Successfully decompressed ${compressedData.length} → ${rawPixelData.length} bytes`
              );
            }

            // Check for predictor and decode if present
            if (decodeParms) {
              const predictor = decodeParms.get
                ? decodeParms.get(
                    await this.getPdfLibModule().then((m) =>
                      m.PDFName.of("Predictor")
                    )
                  )
                : decodeParms.Predictor;
              const columns = decodeParms.get
                ? decodeParms.get(
                    await this.getPdfLibModule().then((m) =>
                      m.PDFName.of("Columns")
                    )
                  )
                : decodeParms.Columns;
              const colors = decodeParms.get
                ? decodeParms.get(
                    await this.getPdfLibModule().then((m) =>
                      m.PDFName.of("Colors")
                    )
                  )
                : decodeParms.Colors;

              const predictorVal = predictor?.asNumber
                ? predictor.asNumber()
                : predictor?.value ?? predictor;
              const columnsVal = columns?.asNumber
                ? columns.asNumber()
                : columns?.value ?? columns ?? width;
              const colorsVal = colors?.asNumber
                ? colors.asNumber()
                : colors?.value ?? colors;

              if (predictorVal && predictorVal > 1) {
                if (options.verbose) {
                  console.log(
                    `   🔧 Applying predictor decoder: Predictor=${predictorVal}, Columns=${columnsVal}, Colors=${colorsVal}`
                  );
                }

                try {
                  // Determine color components from colorSpace if not in DecodeParms
                  const components =
                    colorsVal ?? this.getColorComponentsLocal(colorSpace);

                  rawPixelData = decodePredictor(
                    rawPixelData,
                    predictorVal,
                    columnsVal,
                    components,
                    bitsPerComponent
                  );

                  if (options.verbose) {
                    console.log(
                      `   ✅ Predictor decoded: ${rawPixelData.length} bytes`
                    );
                  }
                } catch (predictorError) {
                  if (options.verbose) {
                    console.log(
                      `   ⚠️  Predictor decoding failed: ${
                        getErrorMessage(predictorError)
                      }`
                    );
                  }
                  // Continue with unfiltered data
                }
              }
            }

            // Check if decompressed data is a valid image format
            const detectedFormat = this.detectImageFormatLocal(rawPixelData);
            if (detectedFormat.valid) {
              // It's already a valid image format
              imageData = rawPixelData;
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
              if (options.verbose) {
                console.log(`   ✅ Detected valid format: ${mimeType}`);
              }
            } else {
              // Check for Indexed color space and expand palette if needed
              const indexedInfo = this.resolveIndexedColorSpace(colorSpace, pdfDoc, options);
              if (indexedInfo) {
                // Expand indexed pixels and create PNG directly
                const expandedData = this.expandIndexedPixels(rawPixelData, indexedInfo.palette, indexedInfo.baseComponents, width, height);
                if (options.verbose) {
                  console.log(
                    `   🎨 Expanded indexed pixels: ${rawPixelData.length} → ${expandedData.length} bytes (${indexedInfo.maxIndex + 1} palette entries, ${indexedInfo.baseComponents} components)`
                  );
                }

                // Convert expanded pixel data directly to PNG
                const converter = new PixelConverter(width, height);
                const rgbaData = converter.convertToRGBA(expandedData, indexedInfo.baseComponents);
                if (rgbaData) {
                  imageData = rawRgbaToPng(rgbaData, width, height);
                  mimeType = "image/png";
                  extension = "png";
                  if (options.verbose) {
                    console.log(
                      `   ✅ Created PNG from indexed data: ${expandedData.length} → ${imageData.length} bytes`
                    );
                  }
                } else {
                  return {
                    success: false,
                    error: `Failed to convert indexed pixels to RGBA (${indexedInfo.baseComponents} components)`,
                  };
                }
              } else {
                // Non-indexed raw pixel data - create PNG using PDF metadata
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
            }
          } catch (decompressError) {
            if (options.verbose) {
              console.log(
                `   ❌ FlateDecode decompression failed: ${
                  getErrorMessage(decompressError)
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
                  getErrorMessage(jpxError)
                }`
              );
            }
            return {
              success: false,
              error: `JPXDecode extraction failed: ${
                getErrorMessage(jpxError)
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
            const detectedFormat = this.detectImageFormatLocal(imageData);
            if (detectedFormat.valid) {
              mimeType = detectedFormat.mimeType!;
              extension = detectedFormat.extension!;
            }
          } catch (genericError) {
            if (options.verbose) {
              console.log(
                `   ❌ Generic decompression failed: ${
                  getErrorMessage(genericError)
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
          const detectedFormat = this.detectImageFormatLocal(imageData);
          if (detectedFormat.valid) {
            mimeType = detectedFormat.mimeType!;
            extension = detectedFormat.extension!;
          }
        } catch (rawError) {
          if (options.verbose) {
            console.log(
              `   ❌ Raw data extraction failed: ${
                getErrorMessage(rawError)
              }`
            );
          }
          return {
            success: false,
            error: `Raw data extraction failed: ${
              getErrorMessage(rawError)
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
          getErrorMessage(error)
        }`,
      };
    }
  }

  // Additional helper methods would go here...
  /**
   * Detect image format from binary data
   * Uses centralized image format detection utility
   */
  private detectImageFormatLocal(data: Buffer): {
    valid: boolean;
    mimeType?: string;
    extension?: string;
  } {
    return detectImageFormat(data);
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
      // Determine color space from PDF metadata using PixelConverter utility
      const colorSpaceStr = colorSpace?.toString() || "";
      const { componentsPerPixel } =
        PixelConverter.detectColorSpace(colorSpaceStr);

      // Calculate expected data size (without predictor bytes)
      const expectedSizeWithoutPredictor =
        width * height * componentsPerPixel * (bitsPerComponent / 8);
      const actualSize = rawData.length;

      if (options.verbose) {
        console.log(`   🔧 PDF Metadata PNG creation (@napi-rs/canvas):`);
        console.log(
          `   📊 ColorSpace: ${colorSpaceStr}, Components: ${componentsPerPixel}, Bits: ${bitsPerComponent}`
        );
        console.log(
          `   📊 Expected size (no predictor): ${expectedSizeWithoutPredictor} bytes, Actual: ${actualSize} bytes`
        );
      }

      // Calculate actual dimensions from data size
      // The actual data might include predictor bytes or have different dimensions
      const bytesPerPixel = componentsPerPixel * (bitsPerComponent / 8);
      const totalPixels = Math.floor(actualSize / bytesPerPixel);

      // Try to determine if this matches the expected dimensions
      const expectedPixels = width * height;
      const pixelRatio = totalPixels / expectedPixels;

      if (options.verbose) {
        console.log(
          `   📊 Pixel count: expected ${expectedPixels}, calculated ${totalPixels} (ratio: ${pixelRatio.toFixed(
            2
          )})`
        );
      }

      // If the data size doesn't match, try to recalculate dimensions
      let actualWidth = width;
      const actualHeight = height;

      if (Math.abs(pixelRatio - 1.0) > 0.1) {
        // Data size doesn't match - might have predictor bytes or wrong dimensions
        // Try to find dimensions that match the actual data size
        const rowBytes = actualSize / height;
        const calculatedWidth = Math.floor(rowBytes / bytesPerPixel);

        if (options.verbose) {
          console.log(
            `   ⚠️  Size mismatch detected. Recalculating: width=${calculatedWidth}, height=${height}`
          );
        }

        // Use recalculated dimensions if they seem reasonable
        if (calculatedWidth > 0 && calculatedWidth < 100000) {
          actualWidth = calculatedWidth;
        } else {
          // Can't determine dimensions - skip this image
          return {
            success: false,
            error: `Cannot determine image dimensions: expected ${width}x${height}, data suggests ${calculatedWidth}x${height}`,
          };
        }
      }

      // Convert pixel data using PixelConverter utility class
      const converter = new PixelConverter(width, height);
      const outputData = converter.convertToRGBA(rawData, componentsPerPixel);

      if (!outputData) {
        return {
          success: false,
          error: `Unsupported color space with ${componentsPerPixel} components`,
        };
      }

      // Convert to PNG using @napi-rs/canvas
      const pngBuffer = rawRgbaToPng(outputData, actualWidth, actualHeight);

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
          getErrorMessage(error)
        }`,
      };
    }
  }

  /**
   * Get format name from MIME type
   * Uses centralized MIME type mapping utility
   */
  private getFormatFromMimeTypeLocal(mimeType: string): string {
    return getFormatFromMimeType(mimeType);
  }

  /**
   * Get the number of color components from a PDF ColorSpace
   * Uses centralized color space utility
   */
  private getColorComponentsLocal(colorSpace: any): number {
    if (!colorSpace) {
      return 3; // Default to RGB
    }
    return getColorComponents(colorSpace.toString());
  }

  /**
   * Resolve an Indexed color space from a PDF ColorSpace object.
   * Returns palette info if it's Indexed, or null otherwise.
   *
   * Indexed color space format: [/Indexed base maxIndex lookupTable]
   */
  private resolveIndexedColorSpace(
    colorSpace: any,
    pdfDoc: any,
    options: ExtractionOptions
  ): {
    palette: Buffer;
    maxIndex: number;
    baseComponents: number;
    baseColorSpaceName: string;
  } | null {
    if (!pdfDoc || !colorSpace) return null;

    try {
      // Resolve the colorSpace reference if needed
      let resolved = colorSpace;
      if (colorSpace.objectNumber !== undefined) {
        resolved = pdfDoc.context.lookup(colorSpace);
      }

      // Check if it's an array (Indexed is always an array)
      if (!resolved?.array) return null;

      const arr = resolved.array;
      if (arr.length < 4) return null;

      // First element must be /Indexed
      const csName = arr[0]?.toString?.();
      if (csName !== "/Indexed") return null;

      // arr[1] = base color space
      // arr[2] = maxIndex (highest valid index)
      // arr[3] = lookup table (palette data)

      const maxIndex = typeof arr[2]?.value === "number" ? arr[2].value : parseInt(String(arr[2]), 10);

      // Extract palette data first, then infer components from its size
      let paletteData: Buffer;
      let lookupTable = arr[3];
      if (lookupTable?.objectNumber !== undefined) {
        lookupTable = pdfDoc.context.lookup(lookupTable);
      }

      if (lookupTable?.contents) {
        // It's a stream - try decompression
        try {
          const zlib = require("node:zlib");
          paletteData = zlib.inflateSync(Buffer.from(lookupTable.contents));
        } catch {
          paletteData = Buffer.from(lookupTable.contents);
        }
      } else if (Buffer.isBuffer(lookupTable) || lookupTable instanceof Uint8Array) {
        paletteData = Buffer.from(lookupTable);
      } else {
        if (options.verbose) {
          console.log(`   ⚠️  Could not read Indexed palette data`);
        }
        return null;
      }

      // Determine base components from palette size: palette = (maxIndex+1) * components
      const paletteEntries = maxIndex + 1;
      let baseComponents: number;
      let baseColorSpaceName: string;

      if (paletteData.length === paletteEntries * 4) {
        baseComponents = 4;
        baseColorSpaceName = "/DeviceCMYK";
      } else if (paletteData.length === paletteEntries * 3) {
        baseComponents = 3;
        baseColorSpaceName = "/DeviceRGB";
      } else if (paletteData.length === paletteEntries) {
        baseComponents = 1;
        baseColorSpaceName = "/DeviceGray";
      } else {
        // Fallback: assume RGB
        baseComponents = 3;
        baseColorSpaceName = "/DeviceRGB";
      }

      if (options.verbose) {
        console.log(
          `   🎨 Indexed color space: ${maxIndex + 1} colors, base=${baseColorSpaceName} (${baseComponents} components), palette=${paletteData.length} bytes`
        );
      }

      return {
        palette: paletteData,
        maxIndex,
        baseComponents,
        baseColorSpaceName,
      };
    } catch (error) {
      if (options.verbose) {
        console.log(`   ⚠️  Failed to resolve Indexed color space: ${getErrorMessage(error)}`);
      }
      return null;
    }
  }

  /**
   * Expand indexed pixel data to full color using a palette lookup table.
   */
  private expandIndexedPixels(
    indexedData: Buffer,
    palette: Buffer,
    baseComponents: number,
    width: number,
    height: number
  ): Buffer {
    const pixelCount = width * height;
    const expandedData = Buffer.alloc(pixelCount * baseComponents);

    for (let i = 0; i < pixelCount; i++) {
      const index = indexedData[i] || 0;
      const paletteOffset = index * baseComponents;

      for (let c = 0; c < baseComponents; c++) {
        expandedData[i * baseComponents + c] = palette[paletteOffset + c] || 0;
      }
    }

    return expandedData;
  }
}
