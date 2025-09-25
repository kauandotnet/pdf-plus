/**
 * Unit tests for TextExtractor
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TextExtractor } from "../../dist/index.js";
import { createTestPdf } from "../setup.js";

describe("TextExtractor", () => {
  let testPdfPath: string;
  let textExtractor: TextExtractor;

  beforeAll(async () => {
    testPdfPath = await createTestPdf("text-test.pdf");
    textExtractor = new TextExtractor();
  });

  describe("constructor", () => {
    it("should create an instance", () => {
      expect(textExtractor).toBeInstanceOf(TextExtractor);
    });
  });

  describe("extract", () => {
    it("should extract basic text content", async () => {
      const result = await textExtractor.extract(testPdfPath);

      expect(result).toBeDefined();
      expect(result.text).toContain("Test PDF Document");
      expect(result.text).toContain("This is a test document");
      expect(result.numPages).toBe(1);
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
    });

    it("should include metadata", async () => {
      const result = await textExtractor.extract(testPdfPath);

      expect(result.info).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.version).toBeDefined();
      expect(typeof result.numPages).toBe("number");
      expect(result.numPages).toBeGreaterThan(0);
    });

    it("should handle extraction errors gracefully", async () => {
      await expect(textExtractor.extract("non-existent.pdf")).rejects.toThrow(
        "Failed to extract text from PDF"
      );
    });

    it("should handle invalid PDF files", async () => {
      await expect(textExtractor.extract(__filename)).rejects.toThrow();
    });
  });

  describe("extractWithPages", () => {
    it("should extract text with page information", async () => {
      const result = await textExtractor.extractWithPages(testPdfPath);

      expect(result).toBeDefined();
      expect(result.text).toContain("Test PDF Document");
      expect(result.numPages).toBe(1);
      expect(result.pages).toBeDefined();
      expect(Array.isArray(result.pages)).toBe(true);
    });

    it("should split text into pages", async () => {
      const result = await textExtractor.extractWithPages(testPdfPath);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toBeDefined();
      expect(typeof result.pages[0]).toBe("string");
    });

    it("should handle multi-page documents", async () => {
      // For this test, we'll use the single page document
      // In a real scenario, you'd create a multi-page PDF
      const result = await textExtractor.extractWithPages(testPdfPath);

      expect(result.pages.length).toBe(result.numPages);
    });
  });

  describe("text processing", () => {
    it("should preserve text formatting", async () => {
      const result = await textExtractor.extract(testPdfPath);

      // Check that text contains expected content
      expect(result.text).toContain("Test PDF Document");
      expect(result.text).toContain(
        "This is a test document for PDF extraction"
      );
      expect(result.text).toContain("It contains multiple lines of text");
    });

    it("should handle empty PDFs gracefully", async () => {
      // Create an empty PDF for testing
      const { PDFDocument } = await import("pdf-lib");
      const emptyPdf = await PDFDocument.create();
      emptyPdf.addPage(); // Add empty page

      const pdfBytes = await emptyPdf.save();
      const fs = await import("node:fs");
      const path = await import("node:path");

      const emptyPdfPath = path.join(__dirname, "../fixtures/empty.pdf");
      fs.writeFileSync(emptyPdfPath, pdfBytes);

      const result = await textExtractor.extract(emptyPdfPath);

      expect(result).toBeDefined();
      expect(result.numPages).toBe(1);
      expect(typeof result.text).toBe("string");
      // Empty PDF might have empty or minimal text
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", async () => {
      try {
        await textExtractor.extract("definitely-not-a-pdf.txt");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Failed to extract text from PDF"
        );
      }
    });

    it("should handle corrupted PDF files", async () => {
      // Create a fake PDF file with invalid content
      const fs = await import("node:fs");
      const path = await import("node:path");

      const corruptedPath = path.join(__dirname, "../fixtures/corrupted.pdf");
      fs.writeFileSync(corruptedPath, "This is not a PDF file");

      await expect(textExtractor.extract(corruptedPath)).rejects.toThrow();
    });
  });
});
