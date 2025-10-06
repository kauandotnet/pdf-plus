/**
 * Poppler-based PDF Page to Image Converter
 *
 * Uses Poppler's pdfToCairo for high-quality rendering with full JPEG2000 support.
 * Requires poppler-utils to be installed on the system.
 *
 * Installation:
 * - Linux: sudo apt-get install poppler-utils
 * - macOS: brew install poppler
 * - Windows: Download from https://blog.alivate.com.au/poppler-windows/
 */

import fs from "node:fs";
import path from "node:path";
import type {
  PageToImageOptions,
  PageToImageResult,
  PageImageResult,
  PageImageFormat,
} from "../../types/page-to-image-types.js";

export class PopplerConverter {
  private poppler: any = null;

  /**
   * Get or initialize Poppler instance
   */
  private async getPoppler() {
    if (!this.poppler) {
      try {
        const { Poppler } = await import("node-poppler");
        this.poppler = new Poppler();
      } catch (error) {
        throw new Error(
          "node-poppler not installed. Install with: npm install node-poppler\n" +
            "Also requires system poppler-utils:\n" +
            "  Linux: sudo apt-get install poppler-utils\n" +
            "  macOS: brew install poppler"
        );
      }
    }
    return this.poppler;
  }

  /**
   * Convert PDF pages to images using Poppler
   *
   * @param pdfPath - Path to PDF file
   * @param options - Conversion options
   * @returns Conversion result with image paths
   */
  async convertToImages(
    pdfPath: string,
    options: PageToImageOptions
  ): Promise<PageToImageResult> {
    const poppler = await this.getPoppler();

    const {
      outputDir = "./page-images",
      format = "png",
      // quality = 90, // Not used by Poppler (uses default quality)
      dpi = 150,
      pages = [],
      verbose = false,
      filenamePattern = "page-{page}.{ext}",
    } = options;

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const images: PageImageResult[] = [];
    const errors: Array<{ page: number; error: string }> = [];

    // Determine pages to convert
    let pageNumbers = pages;
    if (!pageNumbers || pageNumbers.length === 0) {
      // Get total pages from PDF
      const pdfInfo = await this.getPdfInfo(pdfPath);
      const totalPages = pdfInfo.pages || 1;
      pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (verbose) {
      console.log(
        `📸 Converting ${pageNumbers.length} pages with Poppler (parallel)...`
      );
    }

    // Process pages in parallel batches for better performance
    // Use 10 concurrent processes for optimal CPU utilization (configurable)
    const batchSize = options.maxConcurrentPages || 10;
    const batches: number[][] = [];

    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      batches.push(pageNumbers.slice(i, i + batchSize));
    }

    // Convert pages in parallel batches
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (pageNum) => {
          try {
            const filename = this.formatFilename(
              filenamePattern,
              pageNum,
              pageNumbers.length,
              path.basename(pdfPath, ".pdf"),
              format
            );
            const outputPath = path.join(outputDir, filename);

            // Poppler options
            const popplerOptions: any = {
              firstPageToConvert: pageNum,
              lastPageToConvert: pageNum,
              resolutionXYAxis: dpi,
            };

            // Set format-specific options
            if (format === "png") {
              popplerOptions.pngFile = true;
            } else if (format === "jpg" || format === "jpeg") {
              popplerOptions.jpegFile = true;
              // Note: node-poppler doesn't support quality setting via jpegopt
              // Quality is controlled by Poppler's default (which is good)
            }

            // Convert page
            await poppler.pdfToCairo(pdfPath, outputPath, popplerOptions);

            // Poppler adds page number suffix, rename to our pattern
            // Format: outputPath-{pageNum}.{format}
            const pageNumStr = pageNum.toString().padStart(2, "0");
            const popplerOutput = `${outputPath}-${pageNumStr}.${format}`;
            if (fs.existsSync(popplerOutput)) {
              fs.renameSync(popplerOutput, outputPath);
            } else {
              // Try without padding
              const popplerOutputNoPad = `${outputPath}-${pageNum}.${format}`;
              if (fs.existsSync(popplerOutputNoPad)) {
                fs.renameSync(popplerOutputNoPad, outputPath);
              }
            }

            // Get image dimensions
            const stats = fs.statSync(outputPath);
            const dimensions = await this.getImageDimensions(outputPath);

            images.push({
              page: pageNum,
              filepath: outputPath,
              format,
              width: dimensions.width,
              height: dimensions.height,
              fileSize: stats.size,
            });

            if (verbose) {
              console.log(
                `✓ Saved: ${filename} (${this.formatBytes(stats.size)})`
              );
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            errors.push({ page: pageNum, error: errorMsg });

            if (verbose) {
              console.error(`✗ Failed to convert page ${pageNum}:`, errorMsg);
            }
          }
        })
      );
    }

    // Calculate total size
    const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0);

    return {
      images,
      totalPages: pageNumbers.length,
      outputDir,
      totalSize,
    };
  }

  /**
   * Get PDF information using pdfinfo
   */
  private async getPdfInfo(pdfPath: string): Promise<any> {
    const poppler = await this.getPoppler();
    try {
      const info = await poppler.pdfInfo(pdfPath);
      // Parse pdfinfo output
      const lines = info.split("\n");
      const result: any = {};

      for (const line of lines) {
        const match = line.match(/^(\w+):\s+(.+)$/);
        if (match) {
          const key = match[1].toLowerCase();
          const value = match[2].trim();

          if (key === "pages") {
            result.pages = parseInt(value, 10);
          }
        }
      }

      return result;
    } catch (error) {
      // Fallback: assume 1 page
      return { pages: 1 };
    }
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(
    imagePath: string
  ): Promise<{ width: number; height: number }> {
    try {
      const sizeOf = await import("image-size");
      const dimensions = sizeOf.default(imagePath);
      return {
        width: dimensions.width || 0,
        height: dimensions.height || 0,
      };
    } catch (error) {
      return { width: 0, height: 0 };
    }
  }

  /**
   * Format filename pattern
   */
  private formatFilename(
    pattern: string,
    page: number,
    total: number,
    name: string,
    format: PageImageFormat
  ): string {
    const ext = format === "jpg" ? "jpg" : format;
    return pattern
      .replace("{page}", page.toString().padStart(3, "0"))
      .replace("{total}", total.toString())
      .replace("{name}", name)
      .replace("{ext}", ext);
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
