/**
 * PDF.js-based page-by-page text extractor
 * This ensures text extraction page numbers match actual PDF page structure
 */

import * as fs from "node:fs";

export class PDFJSPageExtractor {
  private pdfjsLib: any;

  constructor() {
    // Initialize PDF.js
    this.initializePDFJS();
  }

  private async initializePDFJS() {
    try {
      // Use the legacy build for Node.js compatibility
      this.pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

      // Set up Node.js environment polyfills
      if (typeof globalThis.DOMMatrix === "undefined") {
        // Simple DOMMatrix polyfill for Node.js
        (globalThis as any).DOMMatrix = class DOMMatrix {
          constructor(init?: any) {
            if (Array.isArray(init)) {
              this.a = init[0] || 1;
              this.b = init[1] || 0;
              this.c = init[2] || 0;
              this.d = init[3] || 1;
              this.e = init[4] || 0;
              this.f = init[5] || 0;
            } else {
              this.a = 1;
              this.b = 0;
              this.c = 0;
              this.d = 1;
              this.e = 0;
              this.f = 0;
            }
          }
          a: number;
          b: number;
          c: number;
          d: number;
          e: number;
          f: number;
        };
      }

      // Set worker source for Node.js environment
      const workerPath = require.resolve(
        "pdfjs-dist/legacy/build/pdf.worker.js"
      );
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    } catch (error) {
      throw new Error(
        `Failed to initialize PDF.js: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text page by page using PDF.js
   */
  async extractPageByPage(pdfPath: string): Promise<{
    pages: Array<{
      pageNumber: number;
      text: string;
      wordCount: number;
      characterCount: number;
    }>;
    totalPages: number;
    fullText: string;
  }> {
    try {
      // Ensure PDF.js is initialized
      if (!this.pdfjsLib) {
        await this.initializePDFJS();
      }

      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      const uint8Array = new Uint8Array(pdfBuffer);

      // Load PDF document
      const loadingTask = this.pdfjsLib.getDocument({
        data: uint8Array,
        verbosity: 0, // Suppress console output
      });

      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;

      console.log(`📄 PDF.js detected ${totalPages} pages`);

      // Extract text from each page
      const pages: Array<{
        pageNumber: number;
        text: string;
        wordCount: number;
        characterCount: number;
      }> = [];

      let fullText = "";

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Extract text items and combine them
          const pageText = textContent.items
            .map((item: any) => {
              // Handle different types of text items
              if (typeof item.str === "string") {
                return item.str;
              }
              return "";
            })
            .join(" ")
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

          const wordCount = this.countWords(pageText);
          const characterCount = pageText.length;

          pages.push({
            pageNumber: pageNum,
            text: pageText,
            wordCount,
            characterCount,
          });

          fullText += `${pageText}\n`;

          console.log(
            `   Page ${pageNum}: ${characterCount} chars, ${wordCount} words`
          );
        } catch (pageError) {
          console.warn(
            `⚠️  Warning: Failed to extract text from page ${pageNum}:`,
            pageError
          );
          // Add empty page to maintain page numbering
          pages.push({
            pageNumber: pageNum,
            text: "",
            wordCount: 0,
            characterCount: 0,
          });
        }
      }

      // Clean up
      await pdfDocument.destroy();

      return {
        pages,
        totalPages,
        fullText: fullText.trim(),
      };
    } catch (error) {
      throw new Error(
        `Failed to extract text with PDF.js: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text with page markers using PDF.js page-by-page extraction
   */
  async extractWithPageMarkers(
    pdfPath: string,
    pageMarkerFormat: string = "--- PAGE {page} ---"
  ): Promise<{
    text: string;
    cleanText: string;
    numPages: number;
    pages: Array<{ pageNumber: number; text: string }>;
  }> {
    const pageData = await this.extractPageByPage(pdfPath);

    let textWithMarkers = "";

    pageData.pages.forEach((page) => {
      const marker = pageMarkerFormat.replace(
        "{page}",
        page.pageNumber.toString()
      );
      if (page.text.trim()) {
        textWithMarkers += `${marker}\n\n${page.text}\n`;
      } else {
        // For empty pages, still add the marker
        textWithMarkers += `${marker}\n\n\n`;
      }
    });

    return {
      text: textWithMarkers.trim(),
      cleanText: pageData.fullText,
      numPages: pageData.totalPages,
      pages: pageData.pages,
    };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text || text.trim() === "") return 0;
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Get detailed page information including text positioning
   */
  async extractDetailedPageInfo(
    pdfPath: string,
    pageNumber: number
  ): Promise<{
    pageNumber: number;
    text: string;
    textItems: Array<{
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontName?: string;
      fontSize?: number;
    }>;
    dimensions: {
      width: number;
      height: number;
    };
  } | null> {
    try {
      // Ensure PDF.js is initialized
      if (!this.pdfjsLib) {
        await this.initializePDFJS();
      }

      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      const uint8Array = new Uint8Array(pdfBuffer);

      // Load PDF document
      const loadingTask = this.pdfjsLib.getDocument({
        data: uint8Array,
        verbosity: 0,
      });

      const pdfDocument = await loadingTask.promise;

      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        await pdfDocument.destroy();
        return null;
      }

      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      // Extract detailed text items with positioning
      const textItems = textContent.items.map((item: any) => ({
        text: item.str || "",
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        fontSize: item.transform[0], // Font size is in the transform matrix
      }));

      // Combine all text
      const pageText = textItems
        .map((item: any) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      await pdfDocument.destroy();

      return {
        pageNumber,
        text: pageText,
        textItems,
        dimensions: {
          width: viewport.width,
          height: viewport.height,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to extract detailed page info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
