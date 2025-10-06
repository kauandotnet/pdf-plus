/**
 * Poppler-based Image Extractor
 *
 * Uses Poppler's pdfimages utility to extract embedded images from PDFs.
 * This is more comprehensive than XObject-based extraction and can find images
 * that are embedded in different ways (Form XObjects, inline images, etc.)
 *
 * Requires poppler-utils to be installed on the system.
 */

import fs from "node:fs";
import path from "node:path";
import type { ExtractionOptions } from "../../types/index.js";
import type { ImageItem } from "../../types/image-types.js";

export class PopplerImageExtractor {
  private poppler: any = null;

  /**
   * Lazy-load Poppler module
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
   * Extract images using Poppler's pdfimages
   */
  async extractImages(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<{ images: ImageItem[]; metadata: any }> {
    const poppler = await this.getPoppler();
    const { verbose = false, imageOutputDir = "./images" } = options;

    if (verbose) {
      console.log("🔧 Using Poppler pdfimages for image extraction");
    }

    // Create temporary directory for extraction
    const tempDir = path.join(imageOutputDir, ".poppler-temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPrefix = path.join(tempDir, "img");

    try {
      // First, list images to get metadata
      const listOutput = await poppler.pdfImages(pdfPath, undefined, {
        list: true,
      });

      // Parse the list output
      const imageMetadata = this.parseImageList(listOutput);

      if (verbose) {
        console.log(`   Found ${imageMetadata.length} images via Poppler`);
      }

      if (imageMetadata.length === 0) {
        return { images: [], metadata: { totalImages: 0, engine: "poppler" } };
      }

      // Extract images in their native format
      await poppler.pdfImages(pdfPath, outputPrefix, {
        allFiles: true, // Extract in native format (JPEG, JP2, PNG, etc.)
      });

      // Process extracted files
      const images: ImageItem[] = [];
      const extractedFiles = fs
        .readdirSync(tempDir)
        .filter((f) => f.startsWith("img-"))
        .sort();

      for (let i = 0; i < extractedFiles.length; i++) {
        const filename = extractedFiles[i];
        const tempPath = path.join(tempDir, filename);
        const metadata = imageMetadata[i] || {};

        // Determine format from extension
        const ext = path.extname(filename).toLowerCase().substring(1);
        const format = this.normalizeFormat(ext);

        // Get image dimensions from metadata or file
        const { width, height } = metadata;

        // Generate final filename
        const pageNum = metadata.page || 1;
        const imageNum = i + 1;
        const finalFilename = `img_p${pageNum}_${imageNum}.${format}`;
        const finalPath = path.join(imageOutputDir, finalFilename);

        // Move file to final location
        fs.renameSync(tempPath, finalPath);

        // Get file size
        const stats = fs.statSync(finalPath);

        images.push({
          name: `image_img_${imageNum}`,
          format: format.toUpperCase(),
          width: width || 0,
          height: height || 0,
          colorSpace: metadata.colorSpace || "unknown",
          bitsPerComponent: metadata.bpc || 8,
          path: finalPath,
          size: stats.size,
          pageNumber: pageNum,
        });

        if (verbose) {
          console.log(
            `   ✅ Extracted: ${finalFilename} (${format.toUpperCase()}) ${width}x${height}`
          );
        }
      }

      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      return {
        images,
        metadata: {
          totalImages: images.length,
          engine: "poppler",
        },
      };
    } catch (error) {
      // Clean up temp directory on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      throw error;
    }
  }

  /**
   * Parse pdfimages -list output
   */
  private parseImageList(listOutput: string): any[] {
    const lines = listOutput.split("\n").filter((line) => line.trim());
    const images: any[] = [];

    // Skip header lines (first 2 lines)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse line format:
      // page   num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
      const parts = line.split(/\s+/);
      if (parts.length < 10) continue;

      images.push({
        page: parseInt(parts[0]) || 1,
        num: parseInt(parts[1]) || 0,
        type: parts[2],
        width: parseInt(parts[3]) || 0,
        height: parseInt(parts[4]) || 0,
        colorSpace: parts[5],
        components: parseInt(parts[6]) || 0,
        bpc: parseInt(parts[7]) || 8,
        encoding: parts[8],
      });
    }

    return images;
  }

  /**
   * Normalize image format names
   */
  private normalizeFormat(ext: string): string {
    const formatMap: Record<string, string> = {
      jpg: "jpg",
      jpeg: "jpg",
      jp2: "jp2",
      png: "png",
      tif: "tiff",
      tiff: "tiff",
      pbm: "pbm",
      ppm: "ppm",
      ccitt: "ccitt",
      jb2: "jbig2",
    };

    return formatMap[ext.toLowerCase()] || ext.toLowerCase();
  }
}

