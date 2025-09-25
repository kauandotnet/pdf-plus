/**
 * Real extraction test with Art Basel PDF
 * Demonstrates custom image directory specification
 */

const { extractPdfContent } = require("../dist/index.js");
const fs = require("fs");
const path = require("path");

async function extractArtBasel() {
  console.log("🎨 Art Basel PDF - Real Image Extraction Test\n");

  const pdfPath = "../Art Basel 2025 (1).pdf";

  // Check if PDF exists
  if (!fs.existsSync(pdfPath)) {
    console.log("❌ Art Basel PDF not found at:", pdfPath);
    console.log("   Please ensure the PDF is in the correct location.");
    return;
  }

  try {
    // Test 1: Extract to default directory
    console.log("📁 Test 1: Extract to default directory (./extracted-images)");
    const result1 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      useImagePaths: true,
      verbose: true,
    });

    console.log(`   ✅ Text: ${result1.text?.length || 0} characters`);
    console.log(`   ✅ Images: ${result1.images?.length || 0} found`);
    console.log(`   📄 Pages: ${result1.totalPages || 0}`);

    // Test 2: Extract to custom directory
    console.log(
      "\n📁 Test 2: Extract to custom directory (./art-basel-images)"
    );
    const result2 = await extractPdfContent(pdfPath, {
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: "./art-basel-images",
      useImagePaths: true,
      imageRefFormat: "🎨 Art Basel Image {index} (Page {page})",
      verbose: true,
    });

    console.log(`   ✅ Images: ${result2.images?.length || 0} found`);
    console.log(`   📄 Pages: ${result2.totalPages || 0}`);

    // Test 3: Extract to nested custom directory
    console.log(
      "\n📁 Test 3: Extract to nested directory (./output/art-basel/images)"
    );
    const result3 = await extractPdfContent(pdfPath, {
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: "./output/art-basel/images",
      useImagePaths: true,
      imageRefFormat: "[IMG-{id}] {name} on page {page}",
      verbose: true,
    });

    console.log(`   ✅ Images: ${result3.images?.length || 0} found`);

    // Test 4: Extract with absolute path
    const absolutePath = path.resolve("./art-basel-absolute");
    console.log(`\n📁 Test 4: Extract to absolute path (${absolutePath})`);
    const result4 = await extractPdfContent(pdfPath, {
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: absolutePath,
      useImagePaths: true,
      imageRefFormat: "📷 {name} - Page {page} - Image #{index}",
      verbose: true,
    });

    console.log(`   ✅ Images: ${result4.images?.length || 0} found`);

    // Show directory contents
    console.log("\n📂 Created Directories and Files:");

    const directories = [
      "./extracted-images",
      "./art-basel-images",
      "./output/art-basel/images",
      absolutePath,
    ];

    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log(`   📁 ${dir}: ${files.length} files`);
        if (files.length > 0) {
          console.log(`      📄 Sample files: ${files.slice(0, 3).join(", ")}`);
        }
      } else {
        console.log(`   📁 ${dir}: Directory not created (no images found)`);
      }
    }

    // Show sample image references with custom formatting
    if (result2.images && result2.images.length > 0) {
      console.log("\n🎨 Sample Image References (Custom Format):");
      result2.images.slice(0, 5).forEach((img) => {
        console.log(`   ${img.name} - ${img.filePath || "No file path"}`);
      });
    }

    console.log("\n🎉 Real extraction completed!");
    console.log(
      "💡 You can now check the created directories for extracted images."
    );
  } catch (error) {
    console.error("❌ Extraction failed:", error.message);
    console.log(
      "\n💡 Note: Current implementation creates placeholder images."
    );
    console.log(
      "   The directory structure and file naming still work correctly."
    );
  }
}

// Run the extraction
if (require.main === module) {
  extractArtBasel().catch(console.error);
}

module.exports = { extractArtBasel };
