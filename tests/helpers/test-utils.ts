import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get path to test fixture file
 */
export function getFixturePath(filename: string): string {
  return path.join(__dirname, "../fixtures", filename);
}

/**
 * Check if a test PDF exists
 */
export function hasTestPDF(filename: string): boolean {
  const pdfPath = getFixturePath(filename);
  return fs.existsSync(pdfPath);
}

/**
 * Get the Art Basel test PDF path (from parent directory)
 */
export function getArtBaselPDF(): string {
  const parentDir = path.join(__dirname, "../../../");
  const pdfPath = path.join(
    parentDir,
    "Art Basel 2025_ Yares Art Preview (1).pdf"
  );
  if (!fs.existsSync(pdfPath)) {
    throw new Error(
      `Test PDF not found: ${pdfPath}. Please ensure the Art Basel PDF is in the workspace root.`
    );
  }
  return pdfPath;
}

/**
 * Create a temporary directory for test outputs
 */
export function createTempDir(prefix = "test-"): string {
  const tmpDir = path.join(__dirname, "../../tmp", `${prefix}${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

/**
 * Clean up temporary directory
 */
export function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Wait for a specified time (for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock PDF buffer using pdf-lib (proper PDF generation)
 */
export async function createMockPDFBuffer(): Promise<Buffer> {
  // Use dynamic import to avoid issues with ESM
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText("Test PDF", {
    x: 100,
    y: 700,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Create a temporary mock PDF file
 */
export async function createMockPDFFile(
  filename = "test.pdf"
): Promise<string> {
  const tmpDir = createTempDir("mock-pdf-");
  const pdfPath = path.join(tmpDir, filename);
  const buffer = await createMockPDFBuffer();
  fs.writeFileSync(pdfPath, buffer);
  return pdfPath;
}

/**
 * Assert that a value is defined (TypeScript type guard)
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || "Value is undefined or null");
  }
}

/**
 * Assert that an array is not empty
 */
export function assertNotEmpty<T>(
  array: T[],
  message?: string
): asserts array is [T, ...T[]] {
  if (array.length === 0) {
    throw new Error(message || "Array is empty");
  }
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

/**
 * Skip test if condition is met
 */
export function skipIf(condition: boolean, reason: string) {
  if (condition) {
    console.log(`⏭️  Skipping test: ${reason}`);
    return true;
  }
  return false;
}
