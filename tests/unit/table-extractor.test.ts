import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { TableExtractor, extractTables } from "../../src/index.js";
import { createTempDir, cleanupTempDir } from "../helpers/test-utils.js";

describe("TableExtractor", () => {
  let tempDir: string;
  let tablePdfPath: string;
  let emptyPdfPath: string;

  /**
   * Create a PDF with a simple table structure
   */
  async function createTablePDF(): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Draw a simple 3x3 table
    // Header row
    const startY = 700;
    const rowHeight = 20;
    const colWidth = 100;
    const startX = 100;

    // Header row (bold)
    page.drawText("Name", {
      x: startX,
      y: startY,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText("Age", {
      x: startX + colWidth,
      y: startY,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText("City", {
      x: startX + colWidth * 2,
      y: startY,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Data row 1
    page.drawText("Alice", {
      x: startX,
      y: startY - rowHeight,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("30", {
      x: startX + colWidth,
      y: startY - rowHeight,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("New York", {
      x: startX + colWidth * 2,
      y: startY - rowHeight,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Data row 2
    page.drawText("Bob", {
      x: startX,
      y: startY - rowHeight * 2,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("25", {
      x: startX + colWidth,
      y: startY - rowHeight * 2,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Boston", {
      x: startX + colWidth * 2,
      y: startY - rowHeight * 2,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Data row 3
    page.drawText("Charlie", {
      x: startX,
      y: startY - rowHeight * 3,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("35", {
      x: startX + colWidth,
      y: startY - rowHeight * 3,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Chicago", {
      x: startX + colWidth * 2,
      y: startY - rowHeight * 3,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Create a PDF with no table (just text)
   */
  async function createEmptyPDF(): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("This is a document without any tables.", {
      x: 100,
      y: 700,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    page.drawText("Just some regular text content.", {
      x: 100,
      y: 680,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  beforeAll(async () => {
    tempDir = createTempDir("table-test-");

    // Create test PDFs
    const tableBuffer = await createTablePDF();
    tablePdfPath = path.join(tempDir, "table.pdf");
    fs.writeFileSync(tablePdfPath, tableBuffer);

    const emptyBuffer = await createEmptyPDF();
    emptyPdfPath = path.join(tempDir, "empty.pdf");
    fs.writeFileSync(emptyPdfPath, emptyBuffer);
  });

  afterAll(() => {
    cleanupTempDir(tempDir);
  });

  describe("constructor", () => {
    it("should create a new TableExtractor instance", () => {
      const extractor = new TableExtractor();
      expect(extractor).toBeInstanceOf(TableExtractor);
    });
  });

  describe("extract()", () => {
    it("should extract tables from a PDF with table content", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      expect(result).toBeDefined();
      expect(result.pagesProcessed).toBe(1);
      expect(result.tables).toBeDefined();
      expect(Array.isArray(result.tables)).toBe(true);
    });

    it("should detect table structure with rows and columns", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath, {
        minRows: 2,
        minColumns: 2,
      });

      if (result.tables.length > 0) {
        const table = result.tables[0];
        expect(table.rowCount).toBeGreaterThanOrEqual(2);
        expect(table.columnCount).toBeGreaterThanOrEqual(2);
        expect(table.rows).toBeDefined();
        expect(table.columns).toBeDefined();
      }
    });

    it("should return empty tables array for PDF without tables", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(emptyPdfPath);

      expect(result).toBeDefined();
      expect(result.tables).toBeDefined();
      expect(result.tableCount).toBe(0);
    });

    it("should include extraction metadata", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.extractionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.options).toBeDefined();
    });

    it("should respect page filter option", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath, {
        pages: [1],
      });

      expect(result.pagesProcessed).toBe(1);
    });
  });

  describe("extractTables() convenience function", () => {
    it("should extract tables using convenience function", async () => {
      const result = await extractTables(tablePdfPath);

      expect(result).toBeDefined();
      expect(result.pagesProcessed).toBe(1);
      expect(result.tables).toBeDefined();
    });

    it("should accept options", async () => {
      const result = await extractTables(tablePdfPath, {
        detectHeaders: true,
        minRows: 2,
      });

      expect(result).toBeDefined();
      expect(result.metadata.options.detectHeaders).toBe(true);
      expect(result.metadata.options.minRows).toBe(2);
    });
  });

  describe("tableToCSV()", () => {
    it("should convert table to CSV format", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const csv = extractor.tableToCSV(result.tables[0]);
        expect(typeof csv).toBe("string");
        expect(csv.length).toBeGreaterThan(0);
      }
    });

    it("should use custom delimiter", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const csv = extractor.tableToCSV(result.tables[0], ";");
        expect(csv).toContain(";");
      }
    });
  });

  describe("tableToMarkdown()", () => {
    it("should convert table to Markdown format", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const md = extractor.tableToMarkdown(result.tables[0]);
        expect(typeof md).toBe("string");
        expect(md).toContain("|");
        expect(md).toContain("-");
      }
    });
  });

  describe("tableToHTML()", () => {
    it("should convert table to HTML format", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const html = extractor.tableToHTML(result.tables[0]);
        expect(typeof html).toBe("string");
        expect(html).toContain("<table>");
        expect(html).toContain("</table>");
      }
    });

    it("should include custom class when specified", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const html = extractor.tableToHTML(result.tables[0], {
          tableClass: "my-table",
        });
        expect(html).toContain('class="my-table"');
      }
    });
  });

  describe("tableToArray()", () => {
    it("should convert table to 2D array", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const arr = extractor.tableToArray(result.tables[0]);
        expect(Array.isArray(arr)).toBe(true);
        expect(Array.isArray(arr[0])).toBe(true);
      }
    });
  });

  describe("tableToObjects()", () => {
    it("should convert table to array of objects", async () => {
      const extractor = new TableExtractor();
      const result = await extractor.extract(tablePdfPath);

      if (result.tables.length > 0) {
        const objects = extractor.tableToObjects(result.tables[0]);
        expect(Array.isArray(objects)).toBe(true);
        if (objects.length > 0) {
          expect(typeof objects[0]).toBe("object");
        }
      }
    });
  });

  describe("error handling", () => {
    it("should throw error for non-existent file", async () => {
      const extractor = new TableExtractor();
      await expect(
        extractor.extract("/non/existent/file.pdf")
      ).rejects.toThrow();
    });
  });
});
