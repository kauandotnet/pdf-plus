import fs from "node:fs";
import path from "node:path";
import Jimp from "jimp";

/**
 * Result of image optimization
 */
export interface OptimizationResult {
  success: boolean;
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercent: number;
  engine: "jimp" | "sharp" | "none";
  error?: string;
}

/**
 * Options for image optimization
 */
export interface OptimizationOptions {
  quality?: number; // 0-100, default 80
  verbose?: boolean;
  useSharp?: boolean; // Use Sharp for better quality (optional dependency)
}

/**
 * Image optimizer using Jimp (pure JavaScript)
 *
 * This class provides image optimization capabilities using Jimp, a pure JavaScript
 * image processing library with no native dependencies. It supports JPEG and PNG
 * optimization with quality control.
 *
 * @example
 * ```typescript
 * const result = await ImageOptimizer.optimizeFile('image.jpg', {
 *   engine: 'auto',
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

    // Try Sharp first if enabled and available
    if (options.useSharp) {
      const sharpResult = await ImageOptimizer.optimizeWithSharp(filePath, options);
      if (sharpResult.success) {
        return {
          ...sharpResult,
          originalSize,
          savedBytes: originalSize - sharpResult.optimizedSize,
          savedPercent:
            ((originalSize - sharpResult.optimizedSize) / originalSize) * 100,
          engine: "sharp",
        };
      }
      // If Sharp fails, fall back to Jimp
      if (options.verbose) {
        console.log(
          `   ⚠️  Sharp optimization failed, falling back to Jimp: ${sharpResult.error}`
        );
      }
    }

    // Use Jimp (pure JavaScript, no native dependencies)
    const result = await ImageOptimizer.optimizeWithJimp(filePath, options);
    if (result.success) {
      return {
        ...result,
        originalSize,
        savedBytes: originalSize - result.optimizedSize,
        savedPercent:
          ((originalSize - result.optimizedSize) / originalSize) * 100,
        engine: "jimp",
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
   * Optimize using Sharp (optional dependency)
   */
  private static async optimizeWithSharp(
    filePath: string,
    options: OptimizationOptions
  ): Promise<{ success: boolean; optimizedSize: number; error?: string }> {
    try {
      // Check if Sharp is available
      const { getSharp, isSharpAvailable } = await import(
        "../utils/sharp-detector.js"
      );

      if (!isSharpAvailable()) {
        return {
          success: false,
          optimizedSize: 0,
          error: "Sharp is not installed. Install it with: npm install sharp",
        };
      }

      const sharp = await getSharp();
      const ext = path.extname(filePath).toLowerCase();

      // Only support JPEG and PNG
      if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
        return {
          success: false,
          optimizedSize: 0,
          error: `Unsupported format for Sharp: ${ext}`,
        };
      }

      // Read and optimize image with Sharp
      const tempPath = filePath + ".tmp";
      const quality = options.quality || 80;

      if (ext === ".jpg" || ext === ".jpeg") {
        await sharp(filePath).jpeg({ quality, mozjpeg: true }).toFile(tempPath);
      } else if (ext === ".png") {
        await sharp(filePath)
          .png({ quality, compressionLevel: 9 })
          .toFile(tempPath);
      }

      const optimizedSize = fs.statSync(tempPath).size;

      // Replace original with optimized
      fs.unlinkSync(filePath);
      fs.renameSync(tempPath, filePath);

      return { success: true, optimizedSize };
    } catch (error) {
      return {
        success: false,
        optimizedSize: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Optimize using Jimp (pure JavaScript)
   */
  private static async optimizeWithJimp(
    filePath: string,
    options: OptimizationOptions
  ): Promise<{ success: boolean; optimizedSize: number; error?: string }> {
    try {
      const ext = path.extname(filePath).toLowerCase();

      // Only support JPEG and PNG
      if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
        return {
          success: false,
          optimizedSize: 0,
          error: `Unsupported format for Jimp: ${ext}`,
        };
      }

      // Read image with Jimp
      const image = await Jimp.read(filePath);

      // Configure based on format
      if (ext === ".jpg" || ext === ".jpeg") {
        image.quality(options.quality || 80);
      } else if (ext === ".png") {
        // PNG compression level (0-9)
        image.deflateLevel(9);
      }

      // Write to temporary file
      const tempPath = filePath + ".tmp";
      await image.writeAsync(tempPath);

      const optimizedSize = fs.statSync(tempPath).size;

      // Replace original with optimized
      fs.unlinkSync(filePath);
      fs.renameSync(tempPath, filePath);

      return { success: true, optimizedSize };
    } catch (error) {
      if (options.verbose) {
        console.log(
          `   ⚠️  Jimp optimization failed: ${
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
   * Supports two conversion engines:
   * - Jimp (default): Pure JavaScript, works everywhere
   * - Sharp (optional): Better color preservation, requires native compilation
   *
   * @param jp2Path - Path to the JPEG 2000 file (jp2, jpx, j2c, or jpm)
   * @param options - Conversion options
   * @returns Promise resolving to conversion result with new file path
   */
  static async convertJp2ToJpg(
    jp2Path: string,
    options: { quality?: number; verbose?: boolean; useSharp?: boolean } = {}
  ): Promise<{
    success: boolean;
    newPath?: string;
    originalSize?: number;
    newSize?: number;
    error?: string;
  }> {
    if (options.verbose) {
      console.log(
        `   🔍 ImageOptimizer.convertJp2ToJpg called with useSharp=${options.useSharp}`
      );
    }

    // Use main converter that chooses between Sharp and Jimp
    const { convertJp2ToJpg } = await import(
      "../utils/jp2-to-jpg-converter.js"
    );

    return convertJp2ToJpg(jp2Path, {
      quality: options.quality,
      verbose: options.verbose,
      deleteOriginal: true,
      useSharp: options.useSharp,
    });
  }
}
