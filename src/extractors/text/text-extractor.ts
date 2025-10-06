import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { StructuredTextExtractor } from "./structured-text-extractor.js";
import type {
  ExtractionOptions,
  TextItem,
  PageData,
} from "../../types/index.js";

/**
 * Text extraction from PDF files using pdf.js
 *
 * Direct pdf.js-based text extraction with support for:
 * - Page-by-page extraction with accurate boundaries
 * - Text positioning and font information
 * - Metadata retrieval
 * - No external dependencies (uses pdf.js directly)
 *
 * @example
 * ```typescript
 * const textExtractor = new TextExtractor();
 * const result = await textExtractor.extract('document.pdf');
 * console.log(result.text);
 * ```
 */
export class TextExtractor {
  constructor() {
    this.initializePdfjs();
  }

  /**
   * Initialize pdf.js worker
   */
  private initializePdfjs(): void {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      const require = createRequire(import.meta.url);
      const pdfjsPath = path.dirname(
        require.resolve("pdfjs-dist/package.json")
      );
      pdfjs.GlobalWorkerOptions.workerSrc = path.join(
        pdfjsPath,
        "legacy",
        "build",
        "pdf.worker.mjs"
      );
    }
  }

  /**
   * Load PDF document
   */
  private async loadDocument(pdfPath: string): Promise<PDFDocumentProxy> {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = new Uint8Array(dataBuffer);

    const loadingTask = pdfjs.getDocument({
      data,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    });

    return await loadingTask.promise;
  }

  /**
   * Extract text from a single page
   */
  private async getPageText(page: PDFPageProxy): Promise<string> {
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });

    const textItems: string[] = [];

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      textItems.push(item.str);
      if (item.hasEOL) {
        textItems.push("\n");
      }
    }

    return textItems.join("");
  }

  /**
   * Extract text content from PDF
   *
   * @param pdfPath - Path to the PDF file
   * @returns Promise resolving to extraction result with text and metadata
   * @throws {Error} When PDF extraction fails
   */
  async extract(pdfPath: string): Promise<any> {
    let doc: PDFDocumentProxy | null = null;

    try {
      doc = await this.loadDocument(pdfPath);
      const metadata = await doc.getMetadata();
      const pageTexts: string[] = [];

      // Extract text from all pages
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const text = await this.getPageText(page);
        pageTexts.push(text);
        page.cleanup();
      }

      // Combine page texts
      const combinedText = pageTexts
        .filter((text) => text && text.length > 0)
        .join("\n\n");

      return {
        text: combinedText,
        numPages: doc.numPages,
        info: metadata.info,
        metadata: metadata.metadata,
        version: (metadata.info as any)?.PDFFormatVersion || "1.0",
      };
    } catch (error) {
      throw new Error(
        `Failed to extract text from PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      if (doc) {
        await doc.destroy();
      }
    }
  }

  /**
   * Extract text with metadata
   *
   * @param pdfPath - Path to the PDF file
   * @returns Promise resolving to extraction result with text and metadata
   * @throws {Error} When PDF extraction fails
   */
  async extractWithMetadata(pdfPath: string): Promise<{
    text: string;
    metadata: any;
  }> {
    const result = await this.extract(pdfPath);
    return {
      text: result.text,
      metadata: {
        numPages: result.numPages,
        info: result.info,
        metadata: result.metadata,
        version: result.version,
      },
    };
  }

  /**
   * Extract text with page information
   *
   * @param pdfPath - Path to the PDF file
   * @returns Promise resolving to extraction result with page-separated text
   * @throws {Error} When PDF extraction fails
   */
  async extractWithPages(pdfPath: string): Promise<any> {
    let doc: PDFDocumentProxy | null = null;

    try {
      doc = await this.loadDocument(pdfPath);
      const metadata = await doc.getMetadata();
      const pages: string[] = [];

      // Extract text from each page separately
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const text = await this.getPageText(page);
        pages.push(text);
        page.cleanup();
      }

      // Combine all pages
      const combinedText = pages
        .filter((text) => text && text.length > 0)
        .join("\n\n");

      return {
        text: combinedText,
        numPages: doc.numPages,
        info: metadata.info,
        metadata: metadata.metadata,
        version: (metadata.info as any)?.PDFFormatVersion || "1.0",
        pages: pages,
      };
    } catch (error) {
      throw new Error(
        `Failed to extract text with pages: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      if (doc) {
        await doc.destroy();
      }
    }
  }

  /**
   * Extract text items with position and metadata using pdf.js
   */
  async extractTextItems(
    pdfPath: string,
    options: ExtractionOptions = {}
  ): Promise<TextItem[]> {
    let doc: PDFDocumentProxy | null = null;

    try {
      doc = await this.loadDocument(pdfPath);
      const textItems: TextItem[] = [];
      let itemIndex = 0;

      // Extract text items from each page with actual positioning
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });

        for (const item of textContent.items) {
          if (!("str" in item) || !item.str.trim()) continue;

          // Determine text type based on content and font size
          let textType: "text" | "heading" | "paragraph" | "caption" = "text";
          const fontSize = item.height || 12;

          if (fontSize > 14) {
            textType = "heading";
          } else if (item.str.length > 100) {
            textType = "paragraph";
          } else if (item.str.length < 30) {
            textType = "caption";
          }

          const textItem: TextItem = {
            id: `text_${++itemIndex}`,
            content: item.str,
            position: {
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height,
            },
            font: {
              name: item.fontName || "Unknown",
              size: fontSize,
              style: "normal",
            },
            page: pageNum,
            type: textType,
            fontSize: fontSize,
            color: "#000000",
          };

          textItems.push(textItem);
        }

        page.cleanup();
      }

      if (options.verbose) {
        console.log(
          `📝 Extracted ${textItems.length} text items from ${doc.numPages} pages`
        );
      }

      return textItems;
    } catch (error) {
      throw new Error(
        `Failed to extract text items: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      if (doc) {
        await doc.destroy();
      }
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
    } = {}
  ): Promise<{ text: string; pages: PageData[] }> {
    try {
      // Use the StructuredTextExtractor for accurate page boundaries and image refs
      const structuredExtractor = new StructuredTextExtractor();
      const extractOptions: {
        includeImageRefs: boolean;
        imageRefFormat: string;
      } = {
        includeImageRefs: options.includeImageRefs ?? true, // Default to true
        imageRefFormat: options.imageRefFormat || "[IMG:{id}] {name}",
      };

      const result = await structuredExtractor.extractWithPageMarkers(
        pdfPath,
        pageMarkerFormat,
        extractOptions
      );

      // Convert StructuredTextExtractor format to TextExtractor format
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
    // Use the StructuredTextExtractor for accurate page boundaries
    const structuredExtractor = new StructuredTextExtractor();
    const result = await structuredExtractor.processPDF(pdfPath);

    // Convert StructuredTextExtractor format to TextExtractor format
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
