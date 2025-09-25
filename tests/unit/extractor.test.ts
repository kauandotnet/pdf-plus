/**
 * Unit tests for PDFExtractor core functionality
 */

import { describe, it, expect, beforeAll } from "vitest";
import { PDFExtractor } from "../../dist/index.js";
import { createTestPdf, getOutputPath } from "../setup.js";
import type { ExtractionOptions } from "../../dist/index.js";

describe("PDFExtractor", () => {
  let testPdfPath: string;
  let extractor: PDFExtractor;

  beforeAll(async () => {
    testPdfPath = await createTestPdf("test-document.pdf");
    extractor = new PDFExtractor();
  });

  describe("constructor", () => {
    it("should create an instance", () => {
      expect(extractor).toBeInstanceOf(PDFExtractor);
    });
  });

  describe("extract", () => {
    it("should extract text content by default", async () => {
      const result = await extractor.extract(testPdfPath);

      expect(result).toBeDefined();
      expect(result.cleanText).toContain("Test PDF Document");
      expect(result.cleanText).toContain("This is a test document");
      expect(result.document.pages).toBe(1);
      expect(result.document.textLength).toBeGreaterThan(0);
    });

    it("should extract with custom options", async () => {
      const options: ExtractionOptions = {
        extractText: true,
        extractImages: true,
        verbose: false,
      };

      const result = await extractor.extract(testPdfPath, options);

      expect(result).toBeDefined();
      expect(result.cleanText).toContain("Test PDF Document");
      expect(result.images).toBeDefined();
      expect(Array.isArray(result.images)).toBe(true);
    });

    it("should handle text-only extraction", async () => {
      const options: ExtractionOptions = {
        extractText: true,
        extractImages: false,
      };

      const result = await extractor.extract(testPdfPath, options);

      expect(result.cleanText).toContain("Test PDF Document");
      expect(result.images).toHaveLength(0);
    });

    it("should handle images-only extraction", async () => {
      const options: ExtractionOptions = {
        extractText: false,
        extractImages: true,
      };

      const result = await extractor.extract(testPdfPath, options);

      expect(result.cleanText).toBe("");
      expect(result.images).toBeDefined();
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        extractor.extract("non-existent-file.pdf")
      ).rejects.toThrow();
    });

    it("should throw error for invalid file", async () => {
      await expect(
        extractor.extract(__filename) // This TypeScript file
      ).rejects.toThrow();
    });
  });

  describe("extractText", () => {
    it("should extract only text content", async () => {
      const text = await extractor.extractText(testPdfPath);

      expect(typeof text).toBe("string");
      expect(text).toContain("Test PDF Document");
      expect(text).toContain("This is a test document");
    });

    it("should handle empty options", async () => {
      const text = await extractor.extractText(testPdfPath, {});

      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe("extractImages", () => {
    it("should extract image references", async () => {
      const images = await extractor.extractImages(testPdfPath);

      expect(Array.isArray(images)).toBe(true);
      // Test PDF likely has no images, so should be empty
      expect(images).toHaveLength(0);
    });

    it("should handle extraction options", async () => {
      const images = await extractor.extractImages(testPdfPath, {
        verbose: true,
      });

      expect(Array.isArray(images)).toBe(true);
    });
  });

  describe("extractImageFiles", () => {
    it("should extract image files to directory", async () => {
      const outputDir = getOutputPath("test-images");

      const filePaths = await extractor.extractImageFiles(
        testPdfPath,
        outputDir
      );

      expect(Array.isArray(filePaths)).toBe(true);
      // Test PDF likely has no images
      expect(filePaths).toHaveLength(0);
    });

    it("should handle custom options", async () => {
      const outputDir = getOutputPath("test-images-custom");

      const filePaths = await extractor.extractImageFiles(
        testPdfPath,
        outputDir,
        { verbose: true }
      );

      expect(Array.isArray(filePaths)).toBe(true);
    });
  });

  describe("getPage", () => {
    it("should extract specific page data", async () => {
      const pageResult = await extractor.getPage(testPdfPath, 1);

      expect(pageResult).toBeDefined();
      expect(pageResult.pageNumber).toBe(1);
      expect(pageResult.text).toContain("Test PDF Document");
      expect(pageResult.rawText).toContain("Test PDF Document");
      expect(pageResult.metadata).toBeDefined();
      expect(pageResult.metadata.wordCount).toBeGreaterThan(0);
      expect(pageResult.metadata.characterCount).toBeGreaterThan(0);
    });

    it("should handle invalid page number", async () => {
      await expect(extractor.getPage(testPdfPath, 999)).rejects.toThrow();
    });
  });

  describe("validation", () => {
    it("should validate configuration", async () => {
      const invalidOptions = {
        extractText: false,
        extractImages: false,
      } as ExtractionOptions;

      await expect(
        extractor.extract(testPdfPath, invalidOptions)
      ).rejects.toThrow();
    });

    it("should validate file path", async () => {
      await expect(extractor.extract("")).rejects.toThrow();
    });
  });
});
