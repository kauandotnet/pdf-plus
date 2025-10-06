/**
 * Example: Convert PDF pages to images
 *
 * This example demonstrates how to use the PageToImageConverter
 * to convert PDF pages into image files.
 */

import { PageToImageConverter } from "../src/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const converter = new PageToImageConverter();

  // Path to test PDF (using pdf-parse test file)
  const pdfPath = path.join(
    __dirname,
    "../node_modules/.pnpm/pdf-parse@https+++codeload.github.com+iamh2o+pdf-parse+tar.gz+d7a41d5aaed1503bee2d7ea50bf89588d3b2d2cf/node_modules/pdf-parse/test/data/04-valid.pdf"
  );

  console.log("🎨 PDF Page to Image Conversion Examples\n");

  // ============================================================================
  // Example 1: Convert all pages to PNG
  // ============================================================================
  console.log("📄 Example 1: Convert all pages to PNG (72 DPI)");
  console.log("─".repeat(60));

  const result1 = await converter.convertToImages(pdfPath, {
    outputDir: "./output/page-images-png",
    format: "png",
    dpi: 72,
    verbose: true,
    onProgress: (current, total, percentage) => {
      console.log(`  Progress: ${current}/${total} (${percentage}%)`);
    },
  });

  console.log(`\n✅ Converted ${result1.totalPages} pages`);
  console.log(`📁 Output: ${result1.outputDir}`);
  console.log(`💾 Total size: ${formatBytes(result1.totalSize)}\n`);

  // ============================================================================
  // Example 2: Convert specific pages to high-quality JPG
  // ============================================================================
  console.log("📄 Example 2: Convert pages 1-3 to JPG (150 DPI)");
  console.log("─".repeat(60));

  const result2 = await converter.convertToImages(pdfPath, {
    outputDir: "./output/page-images-jpg",
    format: "jpg",
    quality: 90,
    dpi: 150,
    pages: [1, 2, 3], // Only first 3 pages
    verbose: true,
  });

  console.log(`\n✅ Converted ${result2.totalPages} pages`);
  console.log(`📁 Output: ${result2.outputDir}`);
  console.log(`💾 Total size: ${formatBytes(result2.totalSize)}\n`);

  // ============================================================================
  // Example 3: Generate thumbnails
  // ============================================================================
  console.log("📄 Example 3: Generate thumbnails (low quality, small size)");
  console.log("─".repeat(60));

  const result3 = await converter.generateThumbnails(pdfPath, {
    outputDir: "./output/thumbnails",
    format: "jpg",
    quality: 70,
    maxWidth: 200,
    maxHeight: 200,
    verbose: true,
  });

  console.log(`\n✅ Generated ${result3.totalPages} thumbnails`);
  console.log(`📁 Output: ${result3.outputDir}`);
  console.log(`💾 Total size: ${formatBytes(result3.totalSize)}\n`);

  // ============================================================================
  // Example 4: Convert single page to buffer (no file write)
  // ============================================================================
  console.log("📄 Example 4: Convert single page to buffer");
  console.log("─".repeat(60));

  const buffer = await converter.convertPageToBuffer(pdfPath, 1, {
    format: "png",
    dpi: 72,
  });

  console.log(`✅ Page 1 converted to buffer`);
  console.log(`💾 Buffer size: ${formatBytes(buffer.length)}\n`);

  // ============================================================================
  // Example 5: Convert page to base64 (for web)
  // ============================================================================
  console.log("📄 Example 5: Convert page to base64");
  console.log("─".repeat(60));

  const base64 = await converter.convertPageToBase64(pdfPath, 1, {
    format: "jpg",
    quality: 85,
    dpi: 72,
  });

  console.log(`✅ Page 1 converted to base64`);
  console.log(`📏 Base64 length: ${base64.length} characters`);
  console.log(
    `🔗 Data URL: data:image/jpeg;base64,${base64.substring(0, 50)}...\n`
  );

  // ============================================================================
  // Example 6: Custom filename pattern
  // ============================================================================
  console.log("📄 Example 6: Custom filename pattern");
  console.log("─".repeat(60));

  const result6 = await converter.convertToImages(pdfPath, {
    outputDir: "./output/custom-names",
    format: "png",
    dpi: 72,
    pages: [1, 2],
    filenamePattern: "art-basel-page-{page}-of-{total}.{ext}",
    verbose: true,
  });

  console.log(`\n✅ Converted ${result6.totalPages} pages with custom names`);
  console.log(`📁 Files:`);
  result6.images.forEach((img) => {
    console.log(`   - ${path.basename(img.filepath)}`);
  });

  // ============================================================================
  // Example 7: Page range
  // ============================================================================
  console.log("\n📄 Example 7: Convert page range (1-5)");
  console.log("─".repeat(60));

  const result7 = await converter.convertToImages(pdfPath, {
    outputDir: "./output/page-range",
    format: "png",
    dpi: 72,
    pageRange: "1-5", // Pages 1 through 5
    verbose: true,
  });

  console.log(`\n✅ Converted ${result7.totalPages} pages from range`);
  console.log(`📁 Output: ${result7.outputDir}\n`);

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("🎉 All examples completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`   - PNG images: ${result1.totalPages} pages`);
  console.log(`   - JPG images: ${result2.totalPages} pages`);
  console.log(`   - Thumbnails: ${result3.totalPages} pages`);
  console.log(`   - Buffer conversion: 1 page`);
  console.log(`   - Base64 conversion: 1 page`);
  console.log(`   - Custom names: ${result6.totalPages} pages`);
  console.log(`   - Page range: ${result7.totalPages} pages`);
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Run examples
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
