import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * Result of image optimization
 */
export interface OptimizationResult {
  success: boolean;
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercent: number;
  engine: "canvas" | "none";
  error?: string;
}

/**
 * Options for image optimization
 */
export interface OptimizationOptions {
  quality?: number; // 0-100, default 80
  verbose?: boolean;
}

/**
 * Image optimizer using @napi-rs/canvas
 *
 * This class provides image optimization capabilities using @napi-rs/canvas,
 * a high-performance Skia-based canvas library. It supports JPEG, PNG, and WebP
 * optimization with quality control.
 *
 * @example
 * ```typescript
 * const result = await ImageOptimizer.optimizeFile('image.jpg', {
 *   quality: 80
 * });
 *
 * console.log(`Saved ${result.savedPercent.toFixed(1)}% using ${result.engine}`);
 * ```
 */
export class ImageOptimizer {
  /**
   * Optimize an image file in-place
   *
   * The original file will be replaced with the optimized version.
   * If optimization fails, the original file remains unchanged.
   *
   * @param filePath - Path to the image file to optimize
   * @param options - Optimization options
   * @returns Promise resolving to optimization result
   */
  static async optimizeFile(
    filePath: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        originalSize: 0,
        optimizedSize: 0,
        savedBytes: 0,
        savedPercent: 0,
        engine: "none",
        error: `File not found: ${filePath}`,
      };
    }

    const originalSize = fs.statSync(filePath).size;

    // Use @napi-rs/canvas (Skia-based, high performance)
    const result = await ImageOptimizer.optimizeWithCanvas(filePath, options);
    if (result.success) {
      return {
        ...result,
        originalSize,
        savedBytes: originalSize - result.optimizedSize,
        savedPercent:
          ((originalSize - result.optimizedSize) / originalSize) * 100,
        engine: "canvas",
      };
    }

    // Optimization failed
    return {
      success: false,
      originalSize,
      optimizedSize: originalSize,
      savedBytes: 0,
      savedPercent: 0,
      engine: "none",
      error: result.error || "Image optimization failed",
    };
  }

  /**
   * Optimize using @napi-rs/canvas (Skia-based)
   */
  private static async optimizeWithCanvas(
    filePath: string,
    options: OptimizationOptions
  ): Promise<{ success: boolean; optimizedSize: number; error?: string }> {
    try {
      const ext = path.extname(filePath).toLowerCase();

      // Support JPEG, PNG, and WebP
      if (
        ext !== ".jpg" &&
        ext !== ".jpeg" &&
        ext !== ".png" &&
        ext !== ".webp"
      ) {
        return {
          success: false,
          optimizedSize: 0,
          error: `Unsupported format for canvas: ${ext}`,
        };
      }

      // Load image with @napi-rs/canvas
      const image = await loadImage(filePath);

      // Create canvas and draw image
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);

      // Write to temporary file
      const tempPath = `${filePath}.tmp`;
      const quality = options.quality || 80;
      let buffer: Buffer;

      if (ext === ".jpg" || ext === ".jpeg") {
        buffer = Buffer.from(await canvas.encode("jpeg", quality));
      } else if (ext === ".png") {
        buffer = canvas.toBuffer("image/png");
      } else if (ext === ".webp") {
        buffer = Buffer.from(await canvas.encode("webp", quality));
      } else {
        return {
          success: false,
          optimizedSize: 0,
          error: `Unsupported format: ${ext}`,
        };
      }

      fs.writeFileSync(tempPath, buffer);
      const optimizedSize = fs.statSync(tempPath).size;

      // Replace original with optimized
      fs.unlinkSync(filePath);
      fs.renameSync(tempPath, filePath);

      return { success: true, optimizedSize };
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ⚠️  Canvas optimization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return {
        success: false,
        optimizedSize: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Convert JPEG 2000 formats (jp2, jpx, j2c, jpm) to JPG
   *
   * JPEG 2000 files are not widely supported by browsers and image tools.
   * This method converts them to standard JPG format for better compatibility.
   *
   * Uses @napi-rs/canvas with OpenJPEG WASM decoder for high-performance conversion.
   *
   * @param jp2Path - Path to the JPEG 2000 file (jp2, jpx, j2c, or jpm)
   * @param options - Conversion options
   * @returns Promise resolving to conversion result with new file path
   */
  static async convertJp2ToJpg(
    jp2Path: string,
    options: { quality?: number; verbose?: boolean } = {}
  ): Promise<{
    success: boolean;
    newPath?: string;
    originalSize?: number;
    newSize?: number;
    error?: string;
  }> {
    const { convertJp2ToJpg } = await import(
      "../utils/jp2-to-jpg-converter.js"
    );

    return convertJp2ToJpg(jp2Path, {
      quality: options.quality,
      verbose: options.verbose,
      deleteOriginal: true,
    });
  }
}
