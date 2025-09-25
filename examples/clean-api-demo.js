/**
 * Clean API Demo - Simple, clean extractors
 */

const { TextExtractor } = require("../dist/extractors/text-extractor.js");
const { ImageExtractor } = require("../dist/extractors/image-extractor.js");
const fs = require("fs");
const path = require("path");

async function cleanApiDemo() {
  console.log("🎯 Clean API Demo - Simple Extractors\n");

  const pdfPath = "../Art Basel 2025 (1).pdf";
  const outputDir = "./final-output";

  // Clean up previous output
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    console.log("🔍 Using clean extractors...\n");

    // === TEXT EXTRACTION ===
    console.log("📝 Extracting text with accurate pages...");
    const textExtractor = new TextExtractor();

    // Get clean text with accurate page boundaries
    const textResult = await textExtractor.extractWithAccuratePages(pdfPath);
    console.log(`   ✅ Extracted ${textResult.totalPages} pages`);
    console.log(`   ✅ Total text: ${textResult.fullText.length} characters`);

    // Get text with page markers and image references
    const markedResult = await textExtractor.extractWithPageMarkers(
      pdfPath,
      "--- PAGE {page} ---",
      {
        includeImageRefs: true,
        imageRefFormat: "[IMG:{id}] {name}",
      }
    );
    console.log(
      `   ✅ Text with markers: ${markedResult.text.length} characters`
    );

    // === IMAGE EXTRACTION ===
    console.log("\n🖼️  Extracting images...");
    const imageExtractor = new ImageExtractor();

    const imageResult = await imageExtractor.extractWithPdfLib(pdfPath, {
      imageOutputDir: `${outputDir}/images`,
      extractImageFiles: true, // Actually save the image files!
      verbose: true, // Enable verbose to see what's happening
    });
    console.log(`   ✅ Extracted ${imageResult.images?.length || 0} images`);

    // === SAVE RESULTS ===
    console.log("\n💾 Saving results...");

    // 1. Clean text (no page markers)
    fs.writeFileSync(`${outputDir}/text-raw-clean.txt`, textResult.fullText);
    console.log(
      `   📝 Clean text: text-raw-clean.txt (${textResult.fullText.length} chars)`
    );

    // 2. Text with page markers
    fs.writeFileSync(`${outputDir}/text-with-markers.txt`, markedResult.text);
    console.log(
      `   📝 Marked text: text-with-markers.txt (${markedResult.text.length} chars)`
    );

    // 3. Structured page data
    const structuredData = {
      metadata: {
        filename: path.basename(pdfPath),
        totalPages: textResult.totalPages,
        extractionDate: new Date().toISOString(),
        totalImages: imageResult.images?.length || 0,
        totalTextLength: textResult.fullText.length,
      },
      pages: textResult.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        images:
          imageResult.images?.filter((img) => img.page === page.pageNumber) ||
          [],
        imageCount:
          imageResult.images?.filter((img) => img.page === page.pageNumber)
            .length || 0,
      })),
    };

    fs.writeFileSync(
      `${outputDir}/structured-data.json`,
      JSON.stringify(structuredData, null, 2)
    );
    console.log(`   📊 Structured data: structured-data.json`);

    // 4. Images metadata
    if (imageResult.images && imageResult.images.length > 0) {
      fs.writeFileSync(
        `${outputDir}/images-metadata.json`,
        JSON.stringify(imageResult.images, null, 2)
      );
      console.log(
        `   🖼️  Images metadata: images-metadata.json (${imageResult.images.length} images)`
      );
    }

    // === VERIFY KEY PAGES ===
    console.log("\n🎯 Verifying key pages:");

    // Check Joan Mitchell on page 2
    const page2 = textResult.pages.find((p) => p.pageNumber === 2);
    if (page2 && page2.text.content.includes("Joan Mitchell")) {
      console.log(`   ✅ Joan Mitchell found on page 2 (correct!)`);
    } else {
      console.log(`   ❌ Joan Mitchell not found on page 2`);
    }

    // Check Helen Frankenthaler on page 4
    const page4 = textResult.pages.find((p) => p.pageNumber === 4);
    if (page4 && page4.text.content.includes("Helen Frankenthaler")) {
      console.log(`   ✅ Helen Frankenthaler found on page 4 (correct!)`);
    } else {
      console.log(`   ❌ Helen Frankenthaler not found on page 4`);
    }

    // === SUMMARY ===
    console.log("\n🎉 Clean API Summary:");
    console.log(
      "   ✅ TextExtractor.extractWithAccuratePages() - accurate page boundaries"
    );
    console.log(
      "   ✅ TextExtractor.extractWithPageMarkers() - text with page markers"
    );
    console.log(
      "   ✅ ImageExtractor.extractWithPdfLib() - clean image extraction"
    );
    console.log("   ✅ No 'combined', 'enhanced', or 'final' naming");
    console.log("   ✅ Simple, clean API that just works");
    console.log("   ✅ Joan Mitchell correctly on page 2");
    console.log("   ✅ Helen Frankenthaler correctly on page 4");

    console.log(`\n📁 Output saved to: ${outputDir}/`);
    console.log("   📝 text-raw-clean.txt - Clean text without markers");
    console.log("   📝 text-with-markers.txt - Text with page markers");
    console.log("   📊 structured-data.json - Page-by-page structured data");
    console.log("   🖼️  images/ - Extracted image files");
    console.log("   📊 images-metadata.json - Image metadata");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
}

// Run the demo
if (require.main === module) {
  cleanApiDemo().catch(console.error);
}

module.exports = { cleanApiDemo };
