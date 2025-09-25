/**
 * Test setup and utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Test directories
export const TEST_FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");
export const TEST_OUTPUT_DIR = path.join(process.cwd(), "tests", "output");
export const TEST_TEMP_DIR = path.join(process.cwd(), "tests", "temp");

// Setup test environment
beforeAll(() => {
  // Create test directories
  [TEST_OUTPUT_DIR, TEST_TEMP_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
});

// Clean up after each test
afterEach(() => {
  // Clean test output directory
  if (fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }
});

// Clean up after all tests
afterAll(() => {
  // Clean up temp directories
  [TEST_OUTPUT_DIR, TEST_TEMP_DIR].forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * Create a minimal test PDF for testing
 */
export async function createTestPdf(filename: string): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  // Add a page with some text
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  page.drawText("Test PDF Document", {
    x: 50,
    y: height - 50,
    size: 30,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText("This is a test document for PDF extraction.", {
    x: 50,
    y: height - 100,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText("It contains multiple lines of text.", {
    x: 50,
    y: height - 120,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  const filepath = path.join(TEST_FIXTURES_DIR, filename);

  // Ensure fixtures directory exists
  if (!fs.existsSync(TEST_FIXTURES_DIR)) {
    fs.mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
  }

  fs.writeFileSync(filepath, pdfBytes);
  return filepath;
}

/**
 * Get test fixture path
 */
export function getFixturePath(filename: string): string {
  return path.join(TEST_FIXTURES_DIR, filename);
}

/**
 * Get test output path
 */
export function getOutputPath(filename: string): string {
  return path.join(TEST_OUTPUT_DIR, filename);
}

/**
 * Check if file exists and has content
 */
export function fileExistsAndHasContent(filepath: string): boolean {
  if (!fs.existsSync(filepath)) return false;
  const stats = fs.statSync(filepath);
  return stats.size > 0;
}

/**
 * Count files in directory
 */
export function countFilesInDir(dirPath: string, extension?: string): number {
  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath);
  if (extension) {
    return files.filter((file) => file.endsWith(extension)).length;
  }
  return files.length;
}
