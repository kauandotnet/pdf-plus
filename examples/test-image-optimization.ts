#!/usr/bin/env node

/**
 * Example: Image Extraction with Optimization
 * 
 * This example demonstrates how to extract images from a PDF
 * and automatically optimize them using Sharp or Imagemin.
 */

import { extractPdfContent } from "../src/index.js";
import fs from "node:fs";
import path from "node:path";

async function testImageOptimization() {
  console.log("🧪 Testing Image Extraction with Optimization\n");
  console.log("=".repeat(80));

  // Use the Art Basel PDF from the parent directory
  const testFile = path.join(
    process.cwd(),
    "..",
    "Art Basel 2025_ Yares Art Preview (1).pdf"
  );

  if (!fs.existsSync(testFile)) {
    console.log(`❌ Test file not found: ${testFile}`);
    console.log(`   Please ensure the PDF file exists in the parent directory.`);
    return;
  }

  console.log(`📄 Test file: ${path.basename(testFile)}`);
  console.log("=".repeat(80));

  try {
    // Test 1: Extract with Sharp optimization
    console.log("\n📋 Test 1: Extract with Sharp Optimization");
    console.log("-".repeat(80));

    const outputDir1 = path.join(process.cwd(), "test-output-sharp");
    if (fs.existsSync(outputDir1)) {
      fs.rmSync(outputDir1, { recursive: true, force: true });
    }

    const result1 = await extractPdfContent(testFile, {
      extractImageFiles: true,
      imageOutputDir: outputDir1,
      optimizeImages: true,
      imageOptimizer: "sharp",
      imageQuality: 80,
      imageProgressive: true,
      verbose: true,
    });

    console.log(`\n✅ Sharp Optimization Complete:`);
    console.log(`   Total images: ${result1.images.length}`);
    console.log(`   Output directory: ${outputDir1}`);

    // Test 2: Extract with Imagemin optimization
    console.log("\n📋 Test 2: Extract with Imagemin Optimization");
    console.log("-".repeat(80));

    const outputDir2 = path.join(process.cwd(), "test-output-imagemin");
    if (fs.existsSync(outputDir2)) {
      fs.rmSync(outputDir2, { recursive: true, force: true });
    }

    const result2 = await extractPdfContent(testFile, {
      extractImageFiles: true,
      imageOutputDir: outputDir2,
      optimizeImages: true,
      imageOptimizer: "imagemin",
      imageQuality: 80,
      imageProgressive: true,
      verbose: true,
    });

    console.log(`\n✅ Imagemin Optimization Complete:`);
    console.log(`   Total images: ${result2.images.length}`);
    console.log(`   Output directory: ${outputDir2}`);

    // Test 3: Extract with auto optimization (tries Sharp first)
    console.log("\n📋 Test 3: Extract with Auto Optimization");
    console.log("-".repeat(80));

    const outputDir3 = path.join(process.cwd(), "test-output-auto");
    if (fs.existsSync(outputDir3)) {
      fs.rmSync(outputDir3, { recursive: true, force: true });
    }

    const result3 = await extractPdfContent(testFile, {
      extractImageFiles: true,
      imageOutputDir: outputDir3,
      optimizeImages: true,
      imageOptimizer: "auto",
      imageQuality: 80,
      verbose: true,
    });

    console.log(`\n✅ Auto Optimization Complete:`);
    console.log(`   Total images: ${result3.images.length}`);
    console.log(`   Output directory: ${outputDir3}`);

    // Test 4: Extract without optimization (baseline)
    console.log("\n📋 Test 4: Extract WITHOUT Optimization (Baseline)");
    console.log("-".repeat(80));

    const outputDir4 = path.join(process.cwd(), "test-output-no-optimization");
    if (fs.existsSync(outputDir4)) {
      fs.rmSync(outputDir4, { recursive: true, force: true });
    }

    const result4 = await extractPdfContent(testFile, {
      extractImageFiles: true,
      imageOutputDir: outputDir4,
      optimizeImages: false,
      verbose: true,
    });

    console.log(`\n✅ Extraction Complete (No Optimization):`);
    console.log(`   Total images: ${result4.images.length}`);
    console.log(`   Output directory: ${outputDir4}`);

    // Compare file sizes
    console.log("\n📊 File Size Comparison");
    console.log("=".repeat(80));

    const compareDirectories = [
      { name: "Sharp", dir: outputDir1 },
      { name: "Imagemin", dir: outputDir2 },
      { name: "Auto", dir: outputDir3 },
      { name: "No Optimization", dir: outputDir4 },
    ];

    for (const { name, dir } of compareDirectories) {
      const imagesDir = path.join(dir, "images");
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        const totalSize = files.reduce((sum, file) => {
          const filePath = path.join(imagesDir, file);
          return sum + fs.statSync(filePath).size;
        }, 0);

        console.log(
          `   ${name.padEnd(20)}: ${files.length} images, ${(totalSize / 1024).toFixed(2)} KB total`
        );
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ All tests completed successfully!");
    console.log("\n💡 Tips:");
    console.log("   - Sharp is faster but requires native compilation");
    console.log("   - Imagemin is pure JS and works everywhere");
    console.log("   - Use 'auto' to try Sharp first, fallback to Imagemin");
    console.log("   - Lower quality = smaller files (70-85 recommended)");
    console.log("   - Progressive JPEGs load faster in browsers");
  } catch (error) {
    console.error(`❌ Test failed:`, error);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
  }
}

// Run the test
testImageOptimization().catch(console.error);

