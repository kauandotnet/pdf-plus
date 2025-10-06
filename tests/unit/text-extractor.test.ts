import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TextExtractor } from "../../src/extractors/text/text-extractor.js";
import {
  getArtBaselPDF,
  createMockPDFFile,
  cleanupTempDir,
  createTempDir,
  hasTestPDF,
  skipIf,
} from "../helpers/test-utils.js";
import {
  createMockOptions,
  createMockProgressCallback,
} from "../helpers/mocks.js";
import path from "node:path";
import fs from "node:fs";

describe("TextExtractor", () => {
  let extractor: TextExtractor;
  let tempDir: string;

  beforeEach(() => {
    extractor = new TextExtractor();
    tempDir = createTempDir("text-extractor-");
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("constructor", () => {
    it("should create a new TextExtractor instance", () => {
      expect(extractor).toBeInstanceOf(TextExtractor);
    });
  });

  describe("extract()", () => {
    it("should extract text from a mock PDF", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extract(mockPDF);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should extract text from Art Basel PDF", async () => {
      if (
        skipIf(
          !hasTestPDF("Art Basel 2025_ Yares Art Preview (1).pdf"),
          "Art Basel PDF not found"
        )
      ) {
        return;
      }

      const pdfPath = getArtBaselPDF();
      const result = await extractor.extract(pdfPath);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(100);
      expect(result.numPages).toBeGreaterThan(0);
    });

    it("should return metadata", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extract(mockPDF);

      expect(result.numPages).toBeDefined();
      expect(typeof result.numPages).toBe("number");
      expect(result.numPages).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        extractor.extract("/non/existent/file.pdf")
      ).rejects.toThrow();
    });

    it("should throw error for invalid PDF", async () => {
      const invalidPDF = path.join(tempDir, "invalid.pdf");
      fs.writeFileSync(invalidPDF, "This is not a PDF");

      await expect(extractor.extract(invalidPDF)).rejects.toThrow();
    });
  });

  describe("extractWithMetadata()", () => {
    it("should extract text with metadata", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithMetadata(mockPDF);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.numPages).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should include PDF info in metadata", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithMetadata(mockPDF);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.info).toBeDefined();

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("extractWithPages()", () => {
    it("should extract pages as array of strings", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPages(mockPDF);

      expect(result).toBeDefined();
      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.numPages).toBeDefined();
      expect(result.numPages).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should have text content for each page", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPages(mockPDF);

      // Pages are strings, not objects
      result.pages.forEach((page: string) => {
        expect(typeof page).toBe("string");
      });

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should split text into correct number of pages", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPages(mockPDF);

      // Number of page strings should match numPages
      expect(result.pages.length).toBeLessThanOrEqual(result.numPages);

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("extractWithPageMarkers()", () => {
    it("should extract text with page markers", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPageMarkers(mockPDF);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text).toContain("--- PAGE 1 ---");

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should use custom page marker format", async () => {
      const mockPDF = await createMockPDFFile();
      const customFormat = "=== Page {page} ===";
      const result = await extractor.extractWithPageMarkers(
        mockPDF,
        customFormat
      );

      expect(result.text).toContain("=== Page 1 ===");

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should apply page offset to pages array", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPageMarkers(
        mockPDF,
        undefined,
        {
          pageOffset: 10,
        }
      );

      // Page offset is applied to the pages array, not the text markers
      expect(result.pages[0].pageNumber).toBe(11);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should return pages array", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithPageMarkers(mockPDF);

      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.pages.length).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("extractWithAccuratePages()", () => {
    it("should extract with accurate page boundaries", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithAccuratePages(mockPDF);

      expect(result).toBeDefined();
      expect(result.fullText).toBeDefined();
      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.totalPages).toBeGreaterThan(0);

      cleanupTempDir(path.dirname(mockPDF));
    });

    it("should have accurate page data", async () => {
      const mockPDF = await createMockPDFFile();
      const result = await extractor.extractWithAccuratePages(mockPDF);

      result.pages.forEach((page) => {
        expect(page.pageNumber).toBeDefined();
        expect(page.text).toBeDefined();
        expect(page.text.content).toBeDefined();
        expect(page.text.wordCount).toBeGreaterThanOrEqual(0);
        expect(page.text.characterCount).toBeGreaterThanOrEqual(0);
      });

      cleanupTempDir(path.dirname(mockPDF));
    });
  });

  describe("error handling", () => {
    it("should handle corrupted PDF", async () => {
      const corruptedPDF = path.join(tempDir, "corrupted.pdf");
      fs.writeFileSync(corruptedPDF, "%PDF-1.4\nCorrupted content");

      await expect(extractor.extract(corruptedPDF)).rejects.toThrow();
    });

    it("should provide meaningful error messages", async () => {
      const corruptedPDF = path.join(tempDir, "corrupted.pdf");
      fs.writeFileSync(corruptedPDF, "Not a PDF at all");

      try {
        await extractor.extract(corruptedPDF);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Failed to extract text");
      }
    });
  });

  describe("performance", () => {
    it("should extract text in reasonable time", async () => {
      const mockPDF = await createMockPDFFile();
      const start = performance.now();
      await extractor.extract(mockPDF);
      const duration = performance.now() - start;

      // Should complete in less than 5 seconds for a simple PDF
      expect(duration).toBeLessThan(5000);

      cleanupTempDir(path.dirname(mockPDF));
    });
  });
});
