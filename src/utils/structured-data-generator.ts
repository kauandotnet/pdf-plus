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
    let rawText = text;

    // Remove page markers (various formats)
    rawText = rawText.replace(/--- PAGE \d+ ---\s*/g, "");
    rawText = rawText.replace(/🎨 ART BASEL PAGE \d+ 🎨\s*/g, "");
    rawText = rawText.replace(/PAGE \d+\s*/g, "");

    // Remove image references (various formats)
    rawText = rawText.replace(/\[IMG:\w+\]\s*\w*\s*/g, "");
    rawText = rawText.replace(/\[IMG-\w+\]\s*[^[\n]*\s*/g, "");
    rawText = rawText.replace(
      /📷\s*[^-\n]*-\s*Page\s*\d+\s*-\s*Image\s*#\d+\s*/g,
      ""
    );
    rawText = rawText.replace(
      /🎨\s*Art\s*Basel\s*Image\s*\d+\s*\(Page\s*\d+\)\s*/g,
      ""
    );

    // Clean up extra whitespace and newlines
    rawText = rawText.replace(/\n\s*\n\s*\n/g, "\n\n"); // Max 2 consecutive newlines
    rawText = rawText.replace(/^\s+|\s+$/g, ""); // Trim start/end
    rawText = rawText.replace(/[ \t]+/g, " "); // Multiple spaces to single space

    return rawText;
  }
  /**
   * Generate structured page data from extracted text and images
   */
  generateStructuredData(
    filename: string,
    text: string,
    images: ImageItem[],
    totalPages: number,
    options: ExtractionOptions
  ): StructuredPageData {
    const pages = this.splitTextIntoPages(text, totalPages);
    const pageDataArray = this.createPageDataArray(pages, images, totalPages);

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
    const parts = text.split(pageMarkerRegex);
    const pages: string[] = [];

    for (let i = 1; i < parts.length; i++) {
      // Skip the first part (before first page marker)
      const part = parts[i];
      if (part) {
        pages.push(part.trim());
      }
    }

    // If no pages found, return the whole text
    if (pages.length === 0) {
      pages.push(text);
    }

    return pages;
  }

  /**
   * Split text by estimated length
   */
  private splitByEstimatedLength(text: string, totalPages: number): string[] {
    const lines = text.split("\n");
    const linesPerPage = Math.ceil(lines.length / totalPages);
    const pages: string[] = [];

    for (let i = 0; i < totalPages; i++) {
      const startLine = i * linesPerPage;
      const endLine = Math.min((i + 1) * linesPerPage, lines.length);
      const pageText = lines.slice(startLine, endLine).join("\n");
      pages.push(pageText);
    }

    return pages;
  }

  /**
   * Create page data array with text and images
   */
  private createPageDataArray(
    pageTexts: string[],
    images: ImageItem[],
    totalPages: number
  ): PageData[] {
    const pageDataArray: PageData[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1;
      const pageText = pageTexts[i] || "";
      const pageImages = this.getImagesForPage(images, pageNumber);

      const rawText = this.extractRawText(pageText);

      pageDataArray.push({
        pageNumber,
        text: {
          content: pageText,
          rawText: rawText,
          wordCount: this.countWords(rawText), // Count words from raw text
          characterCount: rawText.length, // Count characters from raw text
        },
        images: pageImages,
        imageCount: pageImages.length,
      });
    }

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

        if ("filename" in image) {
          const filename = (image as { filename?: string }).filename;
          if (filename !== undefined) {
            result.filename = filename;
          }
        }

        if ("path" in image) {
          const imagePath = (image as { path?: string }).path;
          if (imagePath !== undefined) {
            result.path = imagePath;
          }
        }

        if ("size" in image) {
          const size = (image as { size?: number }).size;
          if (size !== undefined) {
            result.size = size;
          }
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
