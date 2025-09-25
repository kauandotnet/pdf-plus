import { BaseImageEngine } from "./base-image-engine.js";
import type { ExtractionOptions, ImageItem } from "../../types/index.js";
import fs from "node:fs";
import path from "node:path";

/**
 * Poppler-based image extraction engine
 */
export class PopplerEngine extends BaseImageEngine {
  readonly name = "poppler";
  readonly description = "Poppler-based extraction using pdfimages command";

  async isAvailable(): Promise<boolean> {
    try {
      const { Poppler } = await import("node-poppler");
      new Poppler(); // Test if we can create an instance

      return true;
    } catch {
      return false;
    }
  }

  getCapabilities() {
    return {
      formats: ["png"], // All images are converted to PNG
      supportsMetadata: true,
      supportsEmbeddedImages: true,
      supportsVectorImages: true,
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
      const { Poppler } = await import("node-poppler");

      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`,
        };
      }

      const popplerInstance = new Poppler();
      const images: ImageItem[] = [];

      // Create temporary directory for poppler output
      const tempDir = path.join(process.cwd(), "temp-poppler-images");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      try {
        if (options.verbose) {
          console.log(`📊 Processing PDF with Poppler engine`);
        }

        // Extract images using node-poppler pdfImages method
        const outputPrefix = path.join(tempDir, "img");

        const pdfImagesOptions = {
          firstPageToConvert: 1,
          lastPageToConvert: -1, // All pages
          pngFile: true, // Convert all images to PNG format
        };

        if (options.verbose) {
          console.log(
            `   🔧 Using node-poppler pdfImages with prefix: ${outputPrefix}`
          );
        }

        // Extract images using node-poppler
        await popplerInstance.pdfImages(
          pdfPath,
          outputPrefix,
          pdfImagesOptions
        );

        if (options.verbose) {
          console.log(`   🔧 Poppler extraction completed`);
        }

        // Get image list with metadata using node-poppler
        const imageListOptions = {
          list: true,
        };

        if (options.verbose) {
          console.log(`   🔧 Getting metadata with node-poppler`);
        }

        const imageListOutput = await popplerInstance.pdfImages(
          pdfPath,
          undefined,
          imageListOptions
        );
        const imageMetadata = this.parseImageList(imageListOutput);

        if (options.verbose) {
          console.log(`   📊 Found ${imageMetadata.length} images in metadata`);
        }

        // Find extracted PNG files (pdfimages with -png creates files like img-000.png, img-001.png, etc.)
        const extractedFiles = fs
          .readdirSync(tempDir)
          .filter((file) => file.startsWith("img-") && file.endsWith(".png"));

        if (options.verbose) {
          console.log(
            `   📊 Found ${extractedFiles.length} extracted image files`
          );
        }

        // Process each extracted image
        for (let i = 0; i < extractedFiles.length; i++) {
          const filename = extractedFiles[i];
          if (!filename) continue;

          const tempFilePath = path.join(tempDir, filename);

          if (!fs.existsSync(tempFilePath)) continue;

          const stats = fs.statSync(tempFilePath);
          fs.readFileSync(tempFilePath); // Validate file exists

          // Parse filename to get image index (format: img-000.png, img-001.png, etc.)
          const match = filename.match(/img-(\d+)\.png/);
          const imageIndex = match ? parseInt(match[1]!, 10) + 1 : i + 1; // Convert 0-based to 1-based

          // Get metadata for this image by index (poppler outputs images sequentially)
          const metadata = imageMetadata[i] || {
            page: 1,
            index: imageIndex,
            width: 0,
            height: 0,
            format: "PNG",
          };

          const pageNumber = metadata.page;

          // Generate final filename (all images are PNG)
          const finalFilename = `img_p${pageNumber}_${imageIndex}.png`;
          let finalFilepath: string | undefined;

          // Copy to final location if requested
          if (options.extractImageFiles && options.imageOutputDir) {
            const imagesDir = path.join(options.imageOutputDir, "images");
            if (!fs.existsSync(imagesDir)) {
              fs.mkdirSync(imagesDir, { recursive: true });
            }
            finalFilepath = path.join(imagesDir, finalFilename);
            fs.copyFileSync(tempFilePath, finalFilepath);

            if (options.verbose) {
              console.log(
                `   💾 Extracted image: ${finalFilename} (${stats.size} bytes)`
              );
            }
          }

          const imageItem: ImageItem = {
            id: `img_${imageIndex}`,
            filename: `images/${finalFilename}`, // Include images/ path
            filepath: finalFilepath || "",
            page: pageNumber,
            width: metadata.width,
            height: metadata.height,
            format: "PNG", // All images are converted to PNG
            mimeType: "image/png",
            size: stats.size,
            position: {
              x: 0, // Poppler doesn't provide position data
              y: 0, // Poppler doesn't provide position data
              width: metadata.width,
              height: metadata.height,
            },
          };

          images.push(imageItem);
        }

        if (options.verbose) {
          console.log(`   ✅ Processed ${images.length} images with Poppler`);
        }

        return {
          success: true,
          images,
        };
      } finally {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Poppler extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  private parseImageList(output: string): Array<{
    page: number;
    index: number;
    width: number;
    height: number;
    format: string;
  }> {
    const images: Array<{
      page: number;
      index: number;
      width: number;
      height: number;
      format: string;
    }> = [];

    const lines = output.split("\n");

    for (const line of lines) {
      // Parse pdfimages -list output format
      // Example: page   num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
      //          1       0 image    1247  1247  rgb     3   8  jpeg   no        15  0   150   150 187K  23%

      const match = line.match(
        /^\s*(\d+)\s+(\d+)\s+\w+\s+(\d+)\s+(\d+)\s+\w+\s+\d+\s+\d+\s+(\w+)/
      );

      if (match) {
        const page = parseInt(match[1]!, 10);
        const index = parseInt(match[2]!, 10);
        const width = parseInt(match[3]!, 10);
        const height = parseInt(match[4]!, 10);
        const format = match[5]?.toUpperCase();

        images.push({
          page,
          index,
          width,
          height,
          format,
        });
      }
    }

    return images;
  }

  // Removed getMimeTypeFromExtension - all images are now PNG
}
