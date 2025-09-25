import type { ImageItem, FormatContext } from "../types/index.js";

/**
 * Handles formatting of image references and text processing
 */
export class FormatProcessor {
  /**
   * Generate text with image references inserted
   */
  generateTextWithImageRefs(
    text: string,
    images: ImageItem[],
    format: string,
    totalPages: number
  ): string {
    if (!text || images.length === 0) {
      return text || "";
    }

    const textLines = text.split("\n");
    const linesPerPage = Math.ceil(textLines.length / totalPages);
    let result = "";

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const startLine = (pageNum - 1) * linesPerPage;
      const endLine = Math.min(startLine + linesPerPage, textLines.length);
      const pageText = textLines.slice(startLine, endLine).join("\n");

      // Add page text
      if (pageText.trim()) {
        result += pageText;
      }

      // Add image references for this page
      const pageImages = images.filter((img) => img.page === pageNum);
      for (const image of pageImages) {
        const imageRef = this.formatImageReference(
          image,
          format,
          images.indexOf(image) + 1
        );
        result += `\n${imageRef}\n`;
      }

      // Add page separator (except for last page)
      if (pageNum < totalPages && pageText.trim()) {
        result += "\n";
      }
    }

    return result.trim();
  }

  /**
   * Generate image-only reference list
   */
  generateImageOnlyRefs(images: ImageItem[], format: string): string {
    return images
      .map((image, index) =>
        this.formatImageReference(image, format, index + 1)
      )
      .join("\n");
  }

  /**
   * Format a single image reference
   */
  formatImageReference(
    image: ImageItem,
    format: string,
    globalIndex: number
  ): string {
    const context: FormatContext = {
      id: image.id,
      name: image.name || image.id,
      page: image.page,
      index: globalIndex,
      path: image.filePath || image.id,
    };

    return this.replacePlaceholders(format, context);
  }

  /**
   * Replace placeholders in format string
   */
  private replacePlaceholders(format: string, context: FormatContext): string {
    return format
      .replace(/\{id\}/g, context.id)
      .replace(/\{name\}/g, context.name || context.id)
      .replace(/\{page\}/g, context.page.toString())
      .replace(/\{index\}/g, context.index.toString())
      .replace(/\{path\}/g, context.path || context.id);
  }

  /**
   * Extract placeholders from format string
   */
  extractPlaceholders(format: string): string[] {
    const placeholderPattern = /\{([^}]+)\}/g;
    const placeholders: string[] = [];
    let match: RegExpExecArray | null = null;

    while ((match = placeholderPattern.exec(format)) !== null) {
      if (match[1]) {
        placeholders.push(match[1]);
      }
    }

    return [...new Set(placeholders)]; // Remove duplicates
  }

  /**
   * Validate format string
   */
  isValidFormat(format: string): boolean {
    const validPlaceholders = ["id", "name", "page", "index", "path"];
    const extractedPlaceholders = this.extractPlaceholders(format);

    // Check if all placeholders are valid
    return extractedPlaceholders.every((placeholder) =>
      validPlaceholders.includes(placeholder)
    );
  }

  /**
   * Get default format based on options
   */
  getDefaultFormat(useImagePaths: boolean = false): string {
    return useImagePaths ? "[IMAGE:{path}]" : "[IMAGE:{id}]";
  }

  /**
   * Clean text by removing image references
   */
  cleanTextFromImageRefs(textWithRefs: string, format: string): string {
    // Create a regex pattern from the format string
    const escapedFormat = format
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // Escape special regex characters
      .replace(/\\?\{id\\?\}/g, "[^\\s\\]]+") // Replace {id} with pattern for non-whitespace
      .replace(/\\?\{name\\?\}/g, "[^\\s\\]]+") // Replace {name} with pattern
      .replace(/\\?\{page\\?\}/g, "\\d+") // Replace {page} with digit pattern
      .replace(/\\?\{index\\?\}/g, "\\d+") // Replace {index} with digit pattern
      .replace(/\\?\{path\\?\}/g, "[^\\s\\]]+"); // Replace {path} with pattern

    const imageRefPattern = new RegExp(escapedFormat, "g");
    return textWithRefs
      .replace(imageRefPattern, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();
  }

  /**
   * Count image references in text
   */
  countImageReferences(text: string, format: string): number {
    const escapedFormat = format
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\?\{id\\?\}/g, "[^\\s\\]]+")
      .replace(/\\?\{name\\?\}/g, "[^\\s\\]]+")
      .replace(/\\?\{page\\?\}/g, "\\d+")
      .replace(/\\?\{index\\?\}/g, "\\d+")
      .replace(/\\?\{path\\?\}/g, "[^\\s\\]]+");

    const imageRefPattern = new RegExp(escapedFormat, "g");
    const matches = text.match(imageRefPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Generate summary text
   */
  generateSummary(
    totalPages: number,
    totalTextItems: number,
    totalImages: number,
    totalTextLength: number,
    processingTime?: number
  ): string {
    const averageImagesPerPage = (totalImages / totalPages).toFixed(2);
    const summary = [
      `📄 Document Summary`,
      `   Pages: ${totalPages}`,
      `   Text items: ${totalTextItems}`,
      `   Images: ${totalImages} (avg ${averageImagesPerPage} per page)`,
      `   Text length: ${totalTextLength.toLocaleString()} characters`,
    ];

    if (processingTime) {
      summary.push(`   Processing time: ${processingTime}ms`);
    }

    return summary.join("\n");
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format duration
   */
  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}
