/**
 * PDF Page to Image Converter using pdf.js
 *
 * Converts PDF pages to image files (PNG, JPG, WebP) with customizable options.
 * Uses Mozilla's pdf.js for high-quality rendering without external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  PageToImageOptions,
  PageToImageResult,
  PageImageResult,
  SinglePageOptions,
  ThumbnailOptions,
  PageImageFormat,
} from "../../types/page-to-image-types.js";

/**
 * Page to Image Converter
 *
 * @example
 * ```typescript
 * const converter = new PageToImageConverter();
 * const result = await converter.convertToImages('document.pdf', {
 *   outputDir: './pages',
 *   format: 'png',
 *   dpi: 150
 * });
 * ```
 */
export class PageToImageConverter {
  private pdfjs: any = null;

  /**
   * Get or load pdf.js module with proper worker configuration
   * Based on pdf-to-img library approach
   */
  private async getPdfjs() {
    if (!this.pdfjs) {
      // Dynamic import to load pdf.js
      this.pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

      // Configure worker path for Node.js environment (same as pdf-to-img)
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      const pdfjsPath = path.dirname(
        require.resolve("pdfjs-dist/package.json")
      );

      // Set worker source and other required paths
      this.pdfjs.GlobalWorkerOptions.workerSrc = path.join(
        pdfjsPath,
        "legacy",
        "build",
        "pdf.worker.mjs"
      );
    }
    return this.pdfjs;
  }

  /**
   * Convert all pages of a PDF to images
   *
   * @param pdfPath - Path to PDF file
   * @param options - Conversion options
   * @returns Conversion result with image paths
   */
  async convertToImages(
    pdfPath: string,
    options: PageToImageOptions = {}
  ): Promise<PageToImageResult> {
    const {
      outputDir = "./page-images",
      format = "png",
      quality = 90,
      dpi = 72,
      scale = 1,
      pages,
      pageRange,
      filenamePattern = "page-{page}.{ext}",
      backgroundColor = "#FFFFFF",
      transparent = false,
      onProgress,
      onPageComplete,
      verbose = false,
    } = options;

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Load PDF
    const pdfjs = await this.getPdfjs();
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdfDocument = await loadingTask.promise;

    const totalPages = pdfDocument.numPages;

    // Determine which pages to convert
    const pagesToConvert = this.getPageNumbers(totalPages, pages, pageRange);

    if (verbose) {
      console.log(
        `Converting ${pagesToConvert.length} pages from ${path.basename(
          pdfPath
        )}...`
      );
    }

    const images: PageImageResult[] = [];
    let totalSize = 0;

    // Convert each page
    for (let i = 0; i < pagesToConvert.length; i++) {
      const pageNum = pagesToConvert[i];
      if (!pageNum) continue; // Type guard

      if (verbose) {
        console.log(`Converting page ${pageNum}/${totalPages}...`);
      }

      // Progress callback
      if (onProgress) {
        const percentage = Math.round(((i + 1) / pagesToConvert.length) * 100);
        onProgress(i + 1, pagesToConvert.length, percentage);
      }

      // Get page
      const page = await pdfDocument.getPage(pageNum);

      // Render page to image
      const imageBuffer = await this.renderPageToBuffer(
        page,
        {
          format,
          quality,
          dpi,
          scale,
          backgroundColor,
          transparent,
        },
        pdfDocument
      );

      // Generate filename
      const filename = this.generateFilename(
        filenamePattern,
        pageNum,
        totalPages,
        path.basename(pdfPath, ".pdf"),
        format
      );
      const filepath = path.join(outputDir, filename);

      // Write file
      fs.writeFileSync(filepath, imageBuffer);

      const fileSize = imageBuffer.length;
      totalSize += fileSize;

      // Get image dimensions
      const viewport = page.getViewport({ scale: scale * (dpi / 72) });

      const imageResult: PageImageResult = {
        page: pageNum,
        filepath,
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        fileSize,
        format,
      };

      images.push(imageResult);

      // Page complete callback
      if (onPageComplete) {
        onPageComplete(pageNum, filepath);
      }

      if (verbose) {
        console.log(`✓ Saved: ${filename} (${this.formatBytes(fileSize)})`);
      }
    }

    if (verbose) {
      console.log(
        `\n✓ Converted ${images.length} pages (${this.formatBytes(totalSize)})`
      );
    }

    return {
      images,
      totalPages: pagesToConvert.length,
      outputDir,
      totalSize,
    };
  }

  /**
   * Convert a single page to an image file
   *
   * @param pdfPath - Path to PDF file
   * @param pageNumber - Page number (1-based)
   * @param outputPath - Output file path
   * @param options - Conversion options
   */
  async convertPage(
    pdfPath: string,
    pageNumber: number,
    outputPath: string,
    options: SinglePageOptions = {}
  ): Promise<PageImageResult> {
    const buffer = await this.convertPageToBuffer(pdfPath, pageNumber, options);

    // Create output directory if needed
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);

    const format = options.format || "png";
    const pdfjs = await this.getPdfjs();
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({
      scale: (options.scale || 1) * ((options.dpi || 72) / 72),
    });

    return {
      page: pageNumber,
      filepath: outputPath,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height),
      fileSize: buffer.length,
      format,
    };
  }

  /**
   * Convert a page to a buffer (no file write)
   *
   * @param pdfPath - Path to PDF file
   * @param pageNumber - Page number (1-based)
   * @param options - Conversion options
   * @returns Image buffer
   */
  async convertPageToBuffer(
    pdfPath: string,
    pageNumber: number,
    options: SinglePageOptions = {}
  ): Promise<Buffer> {
    const pdfjs = await this.getPdfjs();
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(pageNumber);

    return this.renderPageToBuffer(page, options, pdfDocument);
  }

  /**
   * Convert a page to base64 string
   *
   * @param pdfPath - Path to PDF file
   * @param pageNumber - Page number (1-based)
   * @param options - Conversion options
   * @returns Base64 encoded image
   */
  async convertPageToBase64(
    pdfPath: string,
    pageNumber: number,
    options: SinglePageOptions = {}
  ): Promise<string> {
    const buffer = await this.convertPageToBuffer(pdfPath, pageNumber, options);
    return buffer.toString("base64");
  }

  /**
   * Generate thumbnails for all pages
   *
   * @param pdfPath - Path to PDF file
   * @param options - Thumbnail options
   * @returns Conversion result
   */
  async generateThumbnails(
    pdfPath: string,
    options: ThumbnailOptions & { outputDir?: string } = {}
  ): Promise<PageToImageResult> {
    const {
      maxWidth = 200,
      maxHeight = 200,
      maintainAspectRatio = true,
      ...restOptions
    } = options;

    // Calculate scale to fit within max dimensions
    // This will be refined per-page based on actual dimensions
    const thumbnailOptions: PageToImageOptions = {
      ...restOptions,
      outputDir: options.outputDir || "./thumbnails",
      format: options.format || "jpg",
      quality: options.quality || 70,
      dpi: 72, // Low DPI for thumbnails
      scale: 0.25, // Start with 25% scale, will adjust per page
      filenamePattern: "thumb-{page}.{ext}",
    };

    return this.convertToImages(pdfPath, thumbnailOptions);
  }

  /**
   * Render a PDF page to image buffer
   *
   * Based on pdf-to-img library approach - let pdf.js handle canvas creation
   * @see https://github.com/k-yle/pdf-to-img
   */
  private async renderPageToBuffer(
    page: any,
    options: SinglePageOptions,
    pdfDocument: any
  ): Promise<Buffer> {
    const {
      format = "png",
      quality = 90,
      dpi = 72,
      scale = 1,
      backgroundColor = "#FFFFFF",
      transparent = false,
    } = options;

    // Calculate viewport with DPI and scale
    const viewport = page.getViewport({ scale: scale * (dpi / 72) });

    // Use pdf.js's built-in canvas factory (automatically uses Node.js canvas package)
    // This is the key - pdf.js creates its own canvas factory that properly handles inline images
    const { canvas } = pdfDocument.canvasFactory.create(
      viewport.width,
      viewport.height,
      transparent
    );

    // Render PDF page to canvas using simple render context
    // pdf.js will handle inline images automatically through its canvas factory
    await page.render({
      canvas,
      viewport,
      background: transparent ? "transparent" : backgroundColor,
    }).promise;

    // Convert canvas to buffer
    return this.canvasToBuffer(canvas, format, quality);
  }

  /**
   * Convert canvas to image buffer
   */
  private canvasToBuffer(
    canvas: any,
    format: PageImageFormat,
    quality: number
  ): Buffer {
    const normalizedFormat = format === "jpg" ? "jpeg" : format;

    if (normalizedFormat === "png") {
      return canvas.toBuffer("image/png");
    } else if (normalizedFormat === "jpeg") {
      return canvas.toBuffer("image/jpeg", { quality: quality / 100 });
    } else if (normalizedFormat === "webp") {
      return canvas.toBuffer("image/webp", { quality: quality / 100 });
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * Get page numbers to convert based on options
   */
  private getPageNumbers(
    totalPages: number,
    pages?: number[],
    pageRange?: string
  ): number[] {
    if (pages && pages.length > 0) {
      return pages.filter((p) => p >= 1 && p <= totalPages);
    }

    if (pageRange) {
      return this.parsePageRange(pageRange, totalPages);
    }

    // All pages
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  /**
   * Parse page range string (e.g., "1-5", "1,3,5-10")
   */
  private parsePageRange(range: string, totalPages: number): number[] {
    const pages = new Set<number>();
    const parts = range.split(",");

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr?.trim() || "0");
        const end = parseInt(endStr?.trim() || "0");
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end && i <= totalPages; i++) {
            if (i >= 1) pages.add(i);
          }
        }
      } else {
        const pageNum = parseInt(trimmed);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
          pages.add(pageNum);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  /**
   * Generate filename from pattern
   */
  private generateFilename(
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
