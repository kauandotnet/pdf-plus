/**
 * Structured text extractor using both pdf-lib and pdf.js for accurate page-by-page extraction
 *
 * Extracts text with rich metadata including page dimensions, rotation, word counts, and character counts.
 * Uses pdf-lib for accurate page structure and pdf.js for text content.
 */

import * as fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { ImageExtractor } from "../image/image-extractor.js";

export interface PageData {
  pageNumber: number;
  text: string;
  width: number;
  height: number;
  rotation: number;
  mediaBox: number[];
  textItems?: any[];
  wordCount: number;
  characterCount: number;
}

export class StructuredTextExtractor {
  private pdfLibDoc: PDFDocument | null = null;
  private pdfLibPages: any[] = [];
  private textData: PageData[] = [];

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
   * Process PDF with accurate page-by-page extraction
   */
  async processPDF(pdfPath: string): Promise<{
    totalPages: number;
    pages: PageData[];
    fullText: string;
  }> {
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Process with both libraries simultaneously
    const [pdfLibResult, pdfjsResult] = await Promise.all([
      this.processPDFLib(pdfBuffer),
      this.processPDFjs(pdfBuffer),
    ]);

    // Combine the results
    this.textData = this.combineResults(pdfLibResult, pdfjsResult);

    // Generate full text
    const fullText = this.textData
      .map((page) => page.text)
      .join("\n")
      .trim();

    return {
      totalPages: this.textData.length,
      pages: this.textData,
      fullText,
    };
  }

  /**
   * Process with pdf-lib to get accurate page structure
   */
  private async processPDFLib(pdfBuffer: Buffer) {
    this.pdfLibDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
    });
    this.pdfLibPages = this.pdfLibDoc.getPages();

    return this.pdfLibPages.map((page, index) => {
      const { width, height } = page.getSize();
      return {
        pageNumber: index + 1,
        width,
        height,
        rotation: page.getRotation().angle,
        mediaBox: page.getMediaBox(),
      };
    });
  }

  /**
   * Process with pdf.js to extract text page by page
   */
  private async processPDFjs(pdfBuffer: Buffer) {
    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjs.getDocument({
      data,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    });

    const doc = await loadingTask.promise;
    const pages: any[] = [];

    try {
      for (let i = 1; i <= doc.numPages; i++) {
        try {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent({
            includeMarkedContent: false,
            disableNormalization: false,
          });
          const viewport = page.getViewport({ scale: 1 });

          // Extract text from text items, preserving line breaks
          const textItems = textContent.items.filter(
            (item: any) => "str" in item && typeof item.str === "string"
          );

          // Sort items by Y position (top to bottom) then X position (left to right)
          textItems.sort((a: any, b: any) => {
            const yDiff = b.transform[5] - a.transform[5]; // Y position (inverted)
            if (Math.abs(yDiff) > 2) {
              // Different lines
              return yDiff;
            }
            return a.transform[4] - b.transform[4]; // X position (same line)
          });

          // Group items by line and reconstruct text with proper line breaks
          let text = "";
          let currentY: number | null = null;
          let lineText = "";

          for (const item of textItems) {
            if (!("str" in item)) continue;
            const y = item.transform[5];

            if (currentY === null) {
              currentY = y;
              lineText = item.str;
            } else if (Math.abs(y - currentY) > 2) {
              // New line
              text += `${lineText}\n`;
              currentY = y;
              lineText = item.str;
            } else {
              // Same line
              lineText += ` ${item.str}`;
            }
          }

          // Add the last line
          if (lineText) {
            text += lineText;
          }

          text = text.trim();

          const pageInfo = {
            pageNumber: i,
            text,
            textItems: textContent.items,
            pdfParseWidth: viewport.width,
            pdfParseHeight: viewport.height,
          };

          pages.push(pageInfo);
          page.cleanup();
        } catch (error) {
          console.warn(`⚠️  Warning: Error processing page ${i}:`, error);

          // Add empty page to maintain page numbering
          pages.push({
            pageNumber: i,
            text: "",
            textItems: [],
            pdfParseWidth: 0,
            pdfParseHeight: 0,
          });
        }
      }

      return pages.sort((a, b) => a.pageNumber - b.pageNumber); // Ensure correct order
    } finally {
      await doc.destroy();
    }
  }

  /**
   * Combine results from both libraries
   */
  private combineResults(
    pdfLibResults: any[],
    pdfParseResults: any[]
  ): PageData[] {
    return pdfLibResults.map((libPage) => {
      const parsePage = pdfParseResults.find(
        (p) => p.pageNumber === libPage.pageNumber
      );
      const text = parsePage?.text || "";

      return {
        pageNumber: libPage.pageNumber,
        text,
        width: libPage.width,
        height: libPage.height,
        rotation: libPage.rotation,
        mediaBox: libPage.mediaBox,
        textItems: parsePage?.textItems || [],
        wordCount: this.countWords(text),
        characterCount: text.length,
      };
    });
  }

  /**
   * Extract text with page markers using accurate page boundaries
   */
  async extractWithPageMarkers(
    pdfPath: string,
    pageMarkerFormat: string = "--- PAGE {page} ---",
    options: {
      includeImageRefs?: boolean;
      imageRefFormat?: string;
    } = {}
  ): Promise<{
    text: string;
    cleanText: string;
    numPages: number;
    pages: PageData[];
  }> {
    const result = await this.processPDF(pdfPath);

    // Get image data if image references are requested
    let imageData: any[] = [];
    if (options.includeImageRefs) {
      try {
        const imageExtractor = new ImageExtractor();
        const imageResult = await imageExtractor.extract(pdfPath, {
          extractImageFiles: false, // Just get metadata
          verbose: false,
        });
        imageData = imageResult.images || [];
      } catch (error) {
        console.warn("⚠️  Could not extract image references:", error);
      }
    }

    let textWithMarkers = "";

    result.pages.forEach((page) => {
      const marker = pageMarkerFormat.replace(
        "{page}",
        page.pageNumber.toString()
      );

      let pageText = page.text;

      // Insert image references if requested
      if (options.includeImageRefs && imageData.length > 0) {
        const pageImages = imageData.filter(
          (img) => img.page === page.pageNumber
        );
        if (pageImages.length > 0) {
          // Insert image references at the beginning of the page text
          const imageRefs = pageImages
            .map((img) => {
              const refFormat = options.imageRefFormat || "[IMG:{id}] {name}";
              return refFormat
                .replace("{id}", `img_${img.id}`)
                .replace(
                  "{name}",
                  img.filename || `img_p${img.page}_${img.id}.jpg`
                );
            })
            .join("\n");

          if (pageText.trim()) {
            // Insert image refs after the first line (usually the title)
            const lines = pageText.split("\n");
            if (lines.length > 1) {
              lines.splice(1, 0, imageRefs);
              pageText = lines.join("\n");
            } else {
              pageText = `${pageText}\n${imageRefs}`;
            }
          } else {
            pageText = imageRefs;
          }
        }
      }

      if (pageText.trim()) {
        textWithMarkers += `${marker}\n\n${pageText}\n`;
      } else {
        // For empty pages, still add the marker
        textWithMarkers += `${marker}\n\n\n`;
      }
    });

    return {
      text: textWithMarkers.trim(),
      cleanText: result.fullText,
      numPages: result.totalPages,
      pages: result.pages,
    };
  }

  /**
   * Get specific page data
   */
  getPage(pageNumber: number): PageData | null {
    return this.textData[pageNumber - 1] || null;
  }

  /**
   * Get detailed page information including text positioning
   */
  async getDetailedPageInfo(
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
    if (!this.textData.length) {
      await this.processPDF(pdfPath);
    }

    const pageData = this.getPage(pageNumber);
    if (!pageData) {
      return null;
    }

    // Extract detailed text items with positioning
    const textItems = (pageData.textItems || []).map((item: any) => ({
      text: item.str || "",
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
      width: item.width || 0,
      height: item.height || 0,
      fontName: item.fontName,
      fontSize: item.transform?.[0] || 12, // Font size is in the transform matrix
    }));

    return {
      pageNumber,
      text: pageData.text,
      textItems,
      dimensions: {
        width: pageData.width,
        height: pageData.height,
      },
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
   * Process single page (for streaming/batch processing)
   */
  async processSinglePage(
    pdfPath: string,
    pageNumber: number
  ): Promise<PageData | null> {
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Load with pdf-lib
      const sourcePDF = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
      });

      if (pageNumber < 1 || pageNumber > sourcePDF.getPageCount()) {
        return null;
      }

      const pages = sourcePDF.getPages();
      const page = pages[pageNumber - 1];
      if (!page) {
        return null;
      }
      const { width, height } = page.getSize();

      // Extract text with pdf.js
      const data = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjs.getDocument({
        data,
        verbosity: pdfjs.VerbosityLevel.ERRORS,
      });

      const doc = await loadingTask.promise;
      let textItems: any[] = [];
      let text = "";

      try {
        const pdfjsPage = await doc.getPage(pageNumber);
        const textContent = await pdfjsPage.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });

        textItems = textContent.items;
        text = textContent.items
          .filter((item: any) => "str" in item)
          .map((item: any) => item.str || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        pdfjsPage.cleanup();
      } finally {
        await doc.destroy();
      }

      return {
        pageNumber,
        text,
        width,
        height,
        rotation: page.getRotation().angle,
        mediaBox: [
          page.getMediaBox().x,
          page.getMediaBox().y,
          page.getMediaBox().width,
          page.getMediaBox().height,
        ],
        textItems,
        wordCount: this.countWords(text),
        characterCount: text.length,
      };
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to process page ${pageNumber}:`, error);
      return null;
    }
  }
}
