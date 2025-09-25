/**
 * Combined PDF processor using both pdf-lib and pdf-parse for accurate page-by-page extraction
 * This ensures text extraction page numbers match actual PDF page structure
 */

import * as fs from "fs";
import { PDFDocument } from "pdf-lib";
import pdfParse from "pdf-parse";

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

export class CombinedPageExtractor {
  private pdfLibDoc: PDFDocument | null = null;
  private pdfLibPages: any[] = [];
  private textData: PageData[] = [];

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
    const [pdfLibResult, pdfParseResult] = await Promise.all([
      this.processPDFLib(pdfBuffer),
      this.processPDFParse(pdfBuffer),
    ]);

    // Combine the results
    this.textData = this.combineResults(pdfLibResult, pdfParseResult);

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
        rotation: page.getRotation(),
        mediaBox: page.getMediaBox(),
      };
    });
  }

  /**
   * Process with pdf-parse to extract text page by page
   */
  private async processPDFParse(pdfBuffer: Buffer) {
    const pages: any[] = [];

    const options = {
      pagerender: async (pageData: any) => {
        try {
          const textContent = await pageData.getTextContent();
          const viewport = pageData.getViewport({ scale: 1 });

          // Extract text from text items, preserving line breaks
          const textItems = textContent.items.filter(
            (item: any) => typeof item.str === "string"
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
          let currentY = null;
          let lineText = "";

          for (const item of textItems) {
            const y = item.transform[5];

            if (currentY === null) {
              currentY = y;
              lineText = item.str;
            } else if (Math.abs(y - currentY) > 2) {
              // New line
              text += lineText + "\n";
              currentY = y;
              lineText = item.str;
            } else {
              // Same line
              lineText += " " + item.str;
            }
          }

          // Add the last line
          if (lineText) {
            text += lineText;
          }

          text = text.trim();

          const pageInfo = {
            pageNumber: pageData.pageIndex + 1,
            text,
            textItems: textContent.items,
            pdfParseWidth: viewport.width,
            pdfParseHeight: viewport.height,
          };

          pages.push(pageInfo);
          return text;
        } catch (error) {
          console.warn(
            `⚠️  Warning: Error processing page ${pageData.pageIndex + 1}:`,
            error
          );

          // Add empty page to maintain page numbering
          pages.push({
            pageNumber: pageData.pageIndex + 1,
            text: "",
            textItems: [],
            pdfParseWidth: 0,
            pdfParseHeight: 0,
          });

          return "";
        }
      },
    };

    await pdfParse(pdfBuffer, options);
    return pages.sort((a, b) => a.pageNumber - b.pageNumber); // Ensure correct order
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
      imageEngine?: import("../types/index.js").ImageExtractionEngine;
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
        const { ImageExtractor } = await import("./image-extractor.js");
        const imageExtractor = new ImageExtractor();
        const imageResult = await imageExtractor.extract(pdfPath, {
          extractImageFiles: false, // Just get metadata
          verbose: false,
          imageEngine: options.imageEngine || "auto", // Use specified engine
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
              pageText = pageText + "\n" + imageRefs;
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

      // Create single page PDF
      const singlePagePDF = await PDFDocument.create();
      const [copiedPage] = await singlePagePDF.copyPages(sourcePDF, [
        pageNumber - 1,
      ]);
      singlePagePDF.addPage(copiedPage);

      // Extract text with pdf-parse
      const singlePageBuffer = await singlePagePDF.save();

      let textItems: any[] = [];
      const options = {
        pagerender: async (pageData: any) => {
          try {
            const textContent = await pageData.getTextContent();
            textItems = textContent.items;
            return textContent.items
              .map((item: any) => item.str || "")
              .join(" ");
          } catch {
            return "";
          }
        },
      };

      const singlePageBufferNode = Buffer.from(singlePageBuffer);
      const parseResult = await pdfParse(singlePageBufferNode, options);
      const text = parseResult.text.replace(/\s+/g, " ").trim();

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
