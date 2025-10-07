import type {
  StructuredPageData,
  PageData,
  PageImageData,
  ImageItem,
  ExtractionOptions,
} from "../types/index.js";

/**
 * Generates structured page-based data from extracted content
 */
export class StructuredDataGenerator {
  /**
   * Extract raw text without page markers, image references, or formatting
   */
  private extractRawText(text: string): string {
    const withoutPageMarkers = text
      .replace(/--- PAGE \d+ ---\s*/g, "")
      .replace(/🎨 ART BASEL PAGE \d+ 🎨\s*/g, "")
      .replace(/PAGE \d+\s*/g, "");

    const withoutImageRefs = withoutPageMarkers
      .replace(/\[IMG:\w+\]\s*\w*\s*/g, "")
      .replace(/\[IMG-\w+\]\s*[^[\n]*\s*/g, "")
      .replace(/📷\s*[^-\n]*-\s*Page\s*\d+\s*-\s*Image\s*#\d+\s*/g, "")
      .replace(/🎨\s*Art\s*Basel\s*Image\s*\d+\s*\(Page\s*\d+\)\s*/g, "");

    const cleaned = withoutImageRefs
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Max 2 consecutive newlines
      .replace(/^\s+|\s+$/g, "") // Trim start/end
      .replace(/[ \t]+/g, " "); // Multiple spaces to single space

    return cleaned;
  }
  /**
   * Generate structured page data from extracted text and images
   */
  generateStructuredData(
    filename: string,
    text: string,
    images: ImageItem[],
    totalPages: number,
    options: ExtractionOptions,
    pageImagesData?: Map<number, any> | null,
    thumbnailsData?: Map<number, any> | null
  ): StructuredPageData {
    const pages = this.splitTextIntoPages(text, totalPages);
    const pageDataArray = this.createPageDataArray(
      pages,
      images,
      totalPages,
      pageImagesData,
      thumbnailsData
    );

    return {
      metadata: {
        filename,
        extractedAt: new Date().toISOString(),
        totalPages,
        totalTextLength: text.length,
        totalImages: images.length,
        extractionOptions: options,
      },
      pages: pageDataArray,
    };
  }

  /**
   * Split text into estimated pages
   */
  private splitTextIntoPages(text: string, totalPages: number): string[] {
    if (totalPages <= 1) {
      return [text];
    }

    // Check if text already has page markers
    const pageMarkerRegex =
      /(?:--- PAGE \d+ ---|🎨 ART BASEL PAGE \d+ 🎨|PAGE \d+)/g;
    const pageMarkers = text.match(pageMarkerRegex);

    if (pageMarkers && pageMarkers.length > 0) {
      // Split by existing page markers
      return this.splitByPageMarkers(text, pageMarkerRegex);
    } else {
      // Estimate page breaks by content length
      return this.splitByEstimatedLength(text, totalPages);
    }
  }

  /**
   * Split text by existing page markers
   */
  private splitByPageMarkers(text: string, pageMarkerRegex: RegExp): string[] {
    // Split by page markers (e.g., "--- PAGE 4 ---")
    // The format is: "--- PAGE {number} ---\n\n{page text}\n"
    const parts = text.split(pageMarkerRegex);

    // The first part is before any page marker (usually empty or intro text)
    // After split, we get: [before, text1, text2, ...]
    // where text1 is the content after PAGE 1 marker, text2 after PAGE 2, etc.

    // Skip the first part (before first page marker) and take the rest
    // IMPORTANT: Don't filter out empty pages! Trim each part but keep empty strings
    // to preserve page numbering (e.g., image-only pages have empty text)
    const pages = parts.slice(1).map((part) => part.trim());

    // If no pages found, return the whole text
    return pages.length === 0 ? [text] : pages;
  }

  /**
   * Split text by estimated length
   */
  private splitByEstimatedLength(text: string, totalPages: number): string[] {
    const lines = text.split("\n");
    const linesPerPage = Math.ceil(lines.length / totalPages);

    const pageIndices = Array.from({ length: totalPages }, (_, i) => i);
    const pages = pageIndices.map((i) => {
      const startLine = i * linesPerPage;
      const endLine = Math.min((i + 1) * linesPerPage, lines.length);
      return lines.slice(startLine, endLine).join("\n");
    });

    return pages;
  }

  /**
   * Create page data array with text and images
   */
  private createPageDataArray(
    pageTexts: string[],
    images: ImageItem[],
    totalPages: number,
    pageImagesData?: Map<number, any> | null,
    thumbnailsData?: Map<number, any> | null
  ): PageData[] {
    const pageIndices = Array.from({ length: totalPages }, (_, i) => i);

    const pageDataArray = pageIndices.map((i) => {
      const pageNumber = i + 1;
      const pageText = pageTexts[i] || "";
      const pageImages = this.getImagesForPage(images, pageNumber);

      const rawText = this.extractRawText(pageText);

      const pageData: PageData = {
        pageNumber,
        text: {
          content: pageText,
          rawText: rawText,
          wordCount: this.countWords(rawText), // Count words from raw text
          characterCount: rawText.length, // Count characters from raw text
        },
        images: pageImages,
        imageCount: pageImages.length,
      };

      // Add page image if available
      if (pageImagesData && pageImagesData.has(pageNumber)) {
        pageData.pageImage = pageImagesData.get(pageNumber);
      }

      // Add thumbnail if available
      if (thumbnailsData && thumbnailsData.has(pageNumber)) {
        pageData.thumbnail = thumbnailsData.get(pageNumber);
      }

      // Add page image variants if available
      if (pageImagesData && pageImagesData.has(pageNumber)) {
        const pageImageData = pageImagesData.get(pageNumber);
        if (pageImageData.variants && pageImageData.variants.length > 0) {
          pageData.pageImageVariants = pageImageData.variants;
        }
      }

      return pageData;
    });

    return pageDataArray;
  }

  /**
   * Get images for a specific page
   */
  private getImagesForPage(
    images: ImageItem[],
    pageNumber: number
  ): PageImageData[] {
    return images
      .filter((image) => image.page === pageNumber)
      .map((image): PageImageData => {
        const result: PageImageData = {
          id: image.id,
          name: image.name || `image_${image.id}`,
          position: image.position,
          format: image.format || "unknown",
        };

        // Add optional fields if they exist
        if ("filename" in image && image.filename !== undefined) {
          result.filename = image.filename;
        }

        if ("path" in image) {
          const imagePath = (image as { path?: string }).path;
          if (imagePath !== undefined) {
            result.path = imagePath;
          }
        }

        // Check for filepath (lowercase 'p') - primary property
        if ("filepath" in image && image.filepath !== undefined) {
          result.path = image.filepath;
        }

        // Check for filePath (camelCase) - legacy compatibility
        if ("filePath" in image) {
          const filePath = (image as { filePath?: string }).filePath;
          if (filePath !== undefined) {
            result.path = filePath;
          }
        }

        if ("size" in image && image.size !== undefined) {
          result.size = image.size;
        }

        // Add image dimensions
        if ("width" in image && image.width !== undefined) {
          result.width = image.width;
        }

        if ("height" in image && image.height !== undefined) {
          result.height = image.height;
        }

        // Add MIME type
        if ("mimeType" in image && image.mimeType !== undefined) {
          result.mimeType = image.mimeType;
        }

        return result;
      });
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Generate JSON string with pretty formatting
   */
  generateJSONString(
    structuredData: StructuredPageData,
    indent: number = 2
  ): string {
    return JSON.stringify(structuredData, null, indent);
  }

  /**
   * Generate summary statistics
   */
  generateSummary(structuredData: StructuredPageData): {
    totalWords: number;
    totalCharacters: number;
    averageWordsPerPage: number;
    averageImagesPerPage: number;
    pagesWithText: number;
    pagesWithImages: number;
  } {
    const totalWords = structuredData.pages.reduce(
      (sum, page) => sum + page.text.wordCount,
      0
    );
    const totalCharacters = structuredData.pages.reduce(
      (sum, page) => sum + page.text.characterCount,
      0
    );
    const pagesWithText = structuredData.pages.filter(
      (page) => page.text.content.trim().length > 0
    ).length;
    const pagesWithImages = structuredData.pages.filter(
      (page) => page.imageCount > 0
    ).length;

    return {
      totalWords,
      totalCharacters,
      averageWordsPerPage: Math.round(totalWords / structuredData.pages.length),
      averageImagesPerPage:
        Math.round(
          (structuredData.metadata.totalImages / structuredData.pages.length) *
            10
        ) / 10,
      pagesWithText,
      pagesWithImages,
    };
  }
}
