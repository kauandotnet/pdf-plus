import fs from "node:fs";
import { CombinedPageExtractor } from "./combined-page-extractor.js";
import type { ExtractionOptions, TextItem, PageData } from "../types/index.js";

/**
 * Text extraction from PDF files
 *
 * Handles text extraction using pdf-parse library with support for
 * page-by-page extraction and metadata retrieval.
 *
 * @example
 * ```typescript
 * const textExtractor = new TextExtractor();
 * const result = await textExtractor.extract('document.pdf');
 * console.log(result.text);
 * ```
 */
export class TextExtractor {
  /**
   * Extract text content from PDF
   *
   * @param pdfPath - Path to the PDF file
   * @returns Promise resolving to extraction result with text and metadata
   * @throws {Error} When PDF extraction fails
   */
  async extract(pdfPath: string): Promise<any> {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);

      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version,
      };
    } catch (error) {
      throw new Error(
        `Failed to extract text from PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text with page information
   *
   * @param pdfPath - Path to the PDF file
   * @returns Promise resolving to extraction result with page-separated text
   * @throws {Error} When PDF extraction fails
   */
  async extractWithPages(pdfPath: string): Promise<any> {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const dataBuffer = fs.readFileSync(pdfPath);

      // Custom render function to get page-by-page text
      const options = {
        pagerender: (pageData: any) => {
          // Return text content for each page
          return pageData.getTextContent().then((textContent: any) => {
            return textContent.items.map((item: any) => item.str).join(" ");
          });
        },
      };

      const data = await pdfParse(dataBuffer, options);

      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version,
        pages: data.text
          ? this.splitTextIntoPages(data.text, data.numpages)
          : [],
      };
    } catch (error) {
      throw new Error(
        `Failed to extract text with pages: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Split text into approximate pages
   */
  private splitTextIntoPages(text: string, numPages: number): string[] {
    const lines = text.split("\n");
    const linesPerPage = Math.ceil(lines.length / numPages);
    const pages: string[] = [];

    for (let i = 0; i < numPages; i++) {
      const startLine = i * linesPerPage;
      const endLine = Math.min(startLine + linesPerPage, lines.length);
      const pageText = lines.slice(startLine, endLine).join("\n");
      pages.push(pageText);
    }

    return pages;
  }

  /**
   * Extract text items with position and metadata
   */
  async extractTextItems(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<TextItem[]> {
    try {
      const data = await this.extract(pdfPath);
      const text = data.text;
      const totalPages = data.numpages || 1;

      // Split text into lines and create text items
      const lines = text.split("\n");
      const textItems: TextItem[] = [];
      let currentPage = 1;
      const linesPerPage = Math.ceil(lines.length / totalPages);

      lines.forEach((line: string, index: number) => {
        if (line.trim()) {
          // Calculate page number
          currentPage = Math.ceil((index + 1) / linesPerPage);

          // Determine text type based on content
          let textType: "text" | "heading" | "paragraph" | "caption" = "text";
          if (line.length < 50 && line.trim().match(/^[A-Z\s]+$/)) {
            textType = "heading";
          } else if (line.length > 100) {
            textType = "paragraph";
          } else if (line.length < 30) {
            textType = "caption";
          }

          // Estimate font size based on text type
          let fontSize = 12;
          if (textType === "heading") fontSize = 16;
          else if (textType === "caption") fontSize = 10;

          const textItem: TextItem = {
            id: `text_${index + 1}`,
            content: line.trim(),
            position: {
              x: 0, // Estimated position
              y: (index % linesPerPage) * 15, // Estimated line height
              width: line.length * 8, // Estimated character width
              height: fontSize,
            },
            font: {
              name: "Unknown",
              size: fontSize,
              style: textType === "heading" ? "bold" : "normal",
            },
            page: currentPage,
            type: textType,
            fontSize,
            color: "#000000",
          };

          textItems.push(textItem);
        }
      });

      if (options.verbose) {
        console.log(
          `📝 Extracted ${textItems.length} text items from ${totalPages} pages`
        );
      }

      return textItems;
    } catch (error) {
      throw new Error(
        `Failed to extract text items: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text statistics
   */
  async extractStatistics(pdfPath: string): Promise<{
    characterCount: number;
    wordCount: number;
    lineCount: number;
    pageCount: number;
    averageWordsPerPage: number;
    readingTime: number; // in minutes
  }> {
    const data = await this.extract(pdfPath);
    const text = data.text;

    const characterCount = text.length;
    const wordCount = text
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    const lineCount = text.split("\n").length;
    const pageCount = data.numPages;
    const averageWordsPerPage = Math.round(wordCount / pageCount);
    const readingTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute

    return {
      characterCount,
      wordCount,
      lineCount,
      pageCount,
      averageWordsPerPage,
      readingTime,
    };
  }

  /**
   * Extract text with font information (requires PDF.js)
   */
  async extractWithFontInfo(pdfPath: string): Promise<any> {
    // This would require PDF.js implementation
    // For now, return basic extraction
    return this.extract(pdfPath);
  }

  /**
   * Clean extracted text
   */
  cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, "\n") // Replace multiple newlines with single newline
      .trim();
  }

  /**
   * Extract text from specific page range
   */
  async extractPageRange(
    pdfPath: string,
    startPage: number,
    endPage: number
  ): Promise<string> {
    const data = await this.extractWithPages(pdfPath);

    if (startPage < 1 || endPage > data.numPages || startPage > endPage) {
      throw new Error(
        `Invalid page range: ${startPage}-${endPage}. Document has ${data.numPages} pages.`
      );
    }

    const selectedPages = data.pages.slice(startPage - 1, endPage);
    return selectedPages.join("\n\n");
  }

  /**
   * Search for text in PDF
   */
  async searchText(
    pdfPath: string,
    searchTerm: string,
    caseSensitive: boolean = false
  ): Promise<{
    found: boolean;
    occurrences: number;
    pages: number[];
    context: string[];
  }> {
    const data = await this.extractWithPages(pdfPath);
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(searchTerm, flags);

    let totalOccurrences = 0;
    const pagesWithMatches: number[] = [];
    const contexts: string[] = [];

    data.pages.forEach((pageText: string, index: number) => {
      const matches = pageText.match(regex);
      if (matches) {
        totalOccurrences += matches.length;
        pagesWithMatches.push(index + 1);

        // Extract context around matches
        const lines = pageText.split("\n");
        lines.forEach((line, lineIndex) => {
          if (regex.test(line)) {
            const contextStart = Math.max(0, lineIndex - 1);
            const contextEnd = Math.min(lines.length, lineIndex + 2);
            const context = lines.slice(contextStart, contextEnd).join("\n");
            contexts.push(`Page ${index + 1}: ${context}`);
          }
        });
      }
    });

    return {
      found: totalOccurrences > 0,
      occurrences: totalOccurrences,
      pages: pagesWithMatches,
      context: contexts,
    };
  }

  /**
   * Extract text with page markers
   */
  async extractWithPageMarkers(
    pdfPath: string,
    pageMarkerFormat: string = "--- PAGE {page} ---",
    options: {
      pageOffset?: number;
      includeImageRefs?: boolean;
      imageRefFormat?: string;
      imageEngine?: import("../types/index.js").ImageExtractionEngine;
    } = {}
  ): Promise<{ text: string; pages: PageData[] }> {
    try {
      // Use the CombinedPageExtractor for accurate page boundaries and image refs
      const combinedExtractor = new CombinedPageExtractor();
      const extractOptions: {
        includeImageRefs: boolean;
        imageRefFormat: string;
        imageEngine?: import("../types/index.js").ImageExtractionEngine;
      } = {
        includeImageRefs: options.includeImageRefs ?? true, // Default to true
        imageRefFormat: options.imageRefFormat || "[IMG:{id}] {name}",
      };

      // Only add imageEngine if it's defined
      if (options.imageEngine) {
        extractOptions.imageEngine = options.imageEngine;
      }

      const result = await combinedExtractor.extractWithPageMarkers(
        pdfPath,
        pageMarkerFormat,
        extractOptions
      );

      // Convert CombinedPageExtractor format to TextExtractor format
      const pages: PageData[] = result.pages.map((page) => ({
        pageNumber: page.pageNumber + (options.pageOffset || 0),
        text: {
          content: page.text,
          rawText: page.text,
          wordCount: page.wordCount,
          characterCount: page.characterCount,
        },
        images: [],
        imageCount: 0,
      }));

      return {
        text: result.text,
        pages,
      };
    } catch (error) {
      throw new Error(
        `Failed to extract text with page markers: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text with accurate page boundaries using pdf-lib + pdf-parse
   */
  async extractWithAccuratePages(pdfPath: string): Promise<{
    fullText: string;
    pages: PageData[];
    totalPages: number;
  }> {
    // Use the CombinedPageExtractor for accurate page boundaries
    const combinedExtractor = new CombinedPageExtractor();
    const result = await combinedExtractor.processPDF(pdfPath);

    // Convert CombinedPageExtractor format to TextExtractor format
    const pages: PageData[] = result.pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: {
        content: page.text,
        rawText: page.text,
        wordCount: page.wordCount,
        characterCount: page.characterCount,
      },
      images: [],
      imageCount: 0,
    }));

    return {
      fullText: result.fullText,
      pages,
      totalPages: result.totalPages,
    };
  }
}
