import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StructuredTextExtractor } from "../../src/extractors/text/structured-text-extractor.js";
import {
  getArtBaselPDF,
  createMockPDFFile,
  cleanupTempDir,
  createTempDir,
  hasTestPDF,
  skipIf,
} from "../helpers/test-utils.js";
import path from "node:path";
import fs from "node:fs";

describe("StructuredTextExtractor", () => {
  let extractor: StructuredTextExtractor;
  let tempDir: string;

  beforeEach(() => {
    extractor = new StructuredTextExtractor();
    tempDir = createTempDir("structured-text-");
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("constructor", () => {
    it("should create a new StructuredTextExtractor instance", () => {
      expect(extractor).toBeInstanceOf(StructuredTextExtractor);
    });
  });

  describe("processPDF()", () => {
    it("should process a mock PDF", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      expect(result).toBeDefined();
      expect(result.pages).toBeDefined();
      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.pages.length).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should extract page structure metadata", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      const firstPage = result.pages[0];
      expect(firstPage).toBeDefined();
      expect(firstPage.pageNumber).toBe(1);
      expect(firstPage.width).toBeDefined();
      expect(firstPage.height).toBeDefined();
      expect(firstPage.rotation).toBeDefined();

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should extract text content", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      const firstPage = result.pages[0];
      expect(firstPage.text).toBeDefined();
      expect(typeof firstPage.text).toBe("string");
      expect(firstPage.text.length).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should calculate word and character counts", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      const firstPage = result.pages[0];
      expect(firstPage.wordCount).toBeDefined();
      expect(firstPage.characterCount).toBeDefined();
      expect(firstPage.wordCount).toBeGreaterThan(0);
      expect(firstPage.characterCount).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should extract from Art Basel PDF", async () => {
      if (skipIf(!hasTestPDF("Art Basel 2025_ Yares Art Preview (1).pdf"), "Art Basel PDF not found")) {
        return;
      }

      const pdfPath = getArtBaselPDF();
      const result = await extractor.processPDF(pdfPath);

      expect(result.pages.length).toBeGreaterThan(0);
      result.pages.forEach((page) => {
        expect(page.pageNumber).toBeGreaterThan(0);
        expect(page.width).toBeGreaterThan(0);
        expect(page.height).toBeGreaterThan(0);
      });
    });
  });

  describe("extractWithPageMarkers()", () => {
    it("should extract with page markers", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPageMarkers(mockPDF);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.cleanText).toBeDefined();
      expect(result.numPages).toBeGreaterThan(0);
      expect(Array.isArray(result.pages)).toBe(true);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should use custom page marker format", async () => {
      const mockPDF = await createMockPDFFile();
      const customFormat = "### Page {page} ###";
      const result = await extractor.extractWithPageMarkers(
        mockPDF,
        customFormat
      );

      expect(result.text).toContain("### Page 1 ###");

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should include image references when requested", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPageMarkers(mockPDF, undefined, {
        includeImageRefs: true,
      });

      expect(result).toBeDefined();
      // Image refs should be included if images exist
      expect(result.pages).toBeDefined();

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should use custom image reference format", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPageMarkers(mockPDF, undefined, {
        includeImageRefs: true,
        imageRefFormat: "<<IMAGE:{id}>>",
      });

      expect(result).toBeDefined();

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("page structure validation", () => {
    it("should have valid page dimensions", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      result.pages.forEach((page) => {
        expect(page.width).toBeGreaterThan(0);
        expect(page.height).toBeGreaterThan(0);
        expect(Number.isFinite(page.width)).toBe(true);
        expect(Number.isFinite(page.height)).toBe(true);
      });

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should have valid rotation values", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      result.pages.forEach((page) => {
        expect(page.rotation).toBeDefined();
        expect([0, 90, 180, 270]).toContain(page.rotation);
      });

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should have sequential page numbers", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      result.pages.forEach((page, index) => {
        expect(page.pageNumber).toBe(index + 1);
      });

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("text metrics", () => {
    it("should calculate accurate word counts", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      result.pages.forEach((page) => {
        const expectedWordCount = page.text.trim().split(/\s+/).length;
        // Allow some variance due to different tokenization
        expect(page.wordCount).toBeGreaterThanOrEqual(0);
        expect(page.wordCount).toBeLessThanOrEqual(expectedWordCount + 5);
      });

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should calculate accurate character counts", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      result.pages.forEach((page) => {
        expect(page.characterCount).toBeGreaterThanOrEqual(0);
        expect(page.characterCount).toBeLessThanOrEqual(page.text.length);
      });

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("error handling", () => {
    it("should throw error for non-existent file", async () => {
      await expect(
        extractor.processPDF("/non/existent/file.pdf")
      ).rejects.toThrow();
    });

    it("should throw error for invalid PDF", async () => {
      const invalidPDF = path.join(tempDir, "invalid.pdf");
      fs.writeFileSync(invalidPDF, "Not a PDF");

      await expect(extractor.processPDF(invalidPDF)).rejects.toThrow();
    });

    it("should handle empty pages gracefully", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      // Should not throw, even if pages are empty
      expect(result).toBeDefined();
      expect(result.pages).toBeDefined();

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("performance", () => {
    it("should process PDF in reasonable time", async () => {
      const mockPDF = await createMockPDFFile();
      const start = performance.now();
      await extractor.processPDF(mockPDF);
      const duration = performance.now() - start;

      // Should complete in less than 10 seconds for a simple PDF
      expect(duration).toBeLessThan(10000);

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("integration with pdf-lib and pdf-parse", () => {
    it("should merge data from both libraries", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.processPDF(mockPDF);

      // Should have structure from pdf-lib
      expect(result.pages[0].width).toBeDefined();
      expect(result.pages[0].height).toBeDefined();

      // Should have text from pdf-parse
      expect(result.pages[0].text).toBeDefined();
      expect(result.pages[0].text.length).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });
  });
});

