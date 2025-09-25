/**
 * Final Output Demo - Clean Implementation Only
 * Shows exactly what the working implementation generates
 */

const {
  CombinedPageExtractor,
} = require("../dist/extractors/combined-page-extractor.js");
const { ImageExtractor } = require("../dist/extractors/image-extractor.js");
const fs = require("fs");
const path = require("path");

async function finalOutputDemo() {
  console.log("🎯 Final Output Demo - Clean Implementation\n");

  const pdfPath = "../Art Basel 2025 (1).pdf";
  const outputDir = "./final-output";

  if (!fs.existsSync(pdfPath)) {
    console.log("❌ PDF not found");
    return;
  }

  // Clean up previous output
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  try {
    console.log("🔍 Extracting with combined approach (accurate pages)...\n");

    // === TEXT EXTRACTION (ACCURATE PAGES) ===
    const combinedExtractor = new CombinedPageExtractor();
    const textResult = await combinedExtractor.processPDF(pdfPath);
    const markedTextResult = await combinedExtractor.extractWithPageMarkers(
      pdfPath,
      "--- PAGE {page} ---"
    );

    // === IMAGE EXTRACTION ===
    const imageExtractor = new ImageExtractor();
    const imageResult = await imageExtractor.extractWithPdfLib(pdfPath, {
      imageOutputDir: `${outputDir}/images`,
      verbose: true,
    });

    // === COMBINE RESULTS ===
    const finalResult = {
      cleanText: textResult.fullText,
      textWithRefs: markedTextResult.text,
      pages: textResult.pages,
      images: imageResult.images || [],
      document: {
        pages: textResult.totalPages,
        title: "Art Basel 2025",
        creator: "PDF Extractor",
        producer: "Combined Page Extractor",
      },
      metadata: {
        extractionDate: new Date().toISOString(),
        totalPages: textResult.totalPages,
        totalImages: imageResult.images?.length || 0,
        totalTextLength: textResult.fullText.length,
        averageWordsPerPage: Math.round(
          textResult.pages.reduce((sum, page) => sum + page.wordCount, 0) /
            textResult.totalPages
        ),
        pagesWithImages: new Set(
          imageResult.images?.map((img) => img.page) || []
        ).size,
      },
    };

    console.log(`\n📊 Extraction Results:`);
    console.log(`   📄 Pages: ${finalResult.document.pages}`);
    console.log(
      `   📝 Text length: ${finalResult.cleanText.length} characters`
    );
    console.log(`   🖼️  Images: ${finalResult.images.length}`);
    console.log(`   📋 Pages with text: ${finalResult.pages.length}`);

    // === SAVE ALL OUTPUTS ===
    console.log(`\n💾 Saving outputs to ${outputDir}/...\n`);

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    // 1. Text outputs
    fs.writeFileSync(`${outputDir}/text-raw-clean.txt`, finalResult.cleanText);
    console.log(
      `   📝 Raw clean text: text-raw-clean.txt (${finalResult.cleanText.length} chars)`
    );

    fs.writeFileSync(
      `${outputDir}/text-with-markers.txt`,
      finalResult.textWithRefs
    );
    console.log(
      `   📝 Text with markers: text-with-markers.txt (${finalResult.textWithRefs.length} chars)`
    );

    // 2. JSON outputs
    fs.writeFileSync(
      `${outputDir}/complete-extraction.json`,
      JSON.stringify(finalResult, null, 2)
    );
    console.log(`   📊 Complete extraction: complete-extraction.json`);

    // Create structured data from combined results
    const structuredData = {
      metadata: {
        filename: path.basename(pdfPath),
        totalPages: finalResult.document.pages,
        extractionDate: new Date().toISOString(),
        totalImages: finalResult.images.length,
        totalTextLength: finalResult.cleanText.length,
      },
      pages: finalResult.pages.map((page, index) => ({
        pageNumber: page.pageNumber,
        text: {
          content: page.text,
          rawText: page.text,
          wordCount: page.wordCount,
          characterCount: page.characterCount,
        },
        images: finalResult.images.filter(
          (img) => img.page === page.pageNumber
        ),
        metadata: {
          wordCount: page.wordCount,
          characterCount: page.characterCount,
          imageCount: finalResult.images.filter(
            (img) => img.page === page.pageNumber
          ).length,
          dimensions: {
            width: page.width,
            height: page.height,
          },
        },
      })),
    };

    fs.writeFileSync(
      `${outputDir}/structured-data.json`,
      JSON.stringify(structuredData, null, 2)
    );
    console.log(`   📊 Structured data: structured-data.json`);

    fs.writeFileSync(
      `${outputDir}/pages-data.json`,
      JSON.stringify(finalResult.pages, null, 2)
    );
    console.log(
      `   📊 Pages data: pages-data.json (${finalResult.pages.length} pages)`
    );

    fs.writeFileSync(
      `${outputDir}/images-metadata.json`,
      JSON.stringify(finalResult.images, null, 2)
    );
    console.log(
      `   📊 Images metadata: images-metadata.json (${finalResult.images.length} images)`
    );

    // 3. Document metadata
    const documentInfo = {
      filename: path.basename(pdfPath),
      pages: finalResult.document.pages,
      extractedAt: new Date().toISOString(),
      statistics: {
        text: {
          totalCharacters: finalResult.cleanText.length,
          totalWords: finalResult.cleanText
            .split(/\s+/)
            .filter((w) => w.length > 0).length,
          textItems: finalResult.pages.length,
          textItemsByType: result.textItems.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
          }, {}),
        },
        images: {
          totalImages: result.images.length,
          imagesByPage: result.images.reduce((acc, img) => {
            acc[`page_${img.page}`] = (acc[`page_${img.page}`] || 0) + 1;
            return acc;
          }, {}),
          imageFormats: result.images.reduce((acc, img) => {
            acc[img.format] = (acc[img.format] || 0) + 1;
            return acc;
          }, {}),
          totalSize: result.images.reduce(
            (sum, img) => sum + (img.width * img.height || 0),
            0
          ),
        },
      },
    };

    fs.writeFileSync(
      `${outputDir}/document-info.json`,
      JSON.stringify(documentInfo, null, 2)
    );
    console.log(`   📊 Document info: document-info.json`);

    // === ANALYZE IMAGE FILES ===
    console.log(`\n🖼️  Analyzing extracted image files...\n`);

    if (fs.existsSync(`${outputDir}/images`)) {
      const imageFiles = fs.readdirSync(`${outputDir}/images`);

      let realImages = 0;
      let smallImages = 0;
      let totalSize = 0;
      let largestImage = { name: "", size: 0 };
      let smallestImage = { name: "", size: Infinity };

      imageFiles.forEach((file) => {
        const filePath = `${outputDir}/images/${file}`;
        const stats = fs.statSync(filePath);
        const size = stats.size;
        totalSize += size;

        if (size > 1000) {
          realImages++;
        } else {
          smallImages++;
        }

        if (size > largestImage.size) {
          largestImage = { name: file, size };
        }

        if (size < smallestImage.size) {
          smallestImage = { name: file, size };
        }
      });

      console.log(`   📁 Total image files: ${imageFiles.length}`);
      console.log(`   ✅ Real images (>1KB): ${realImages}`);
      console.log(`   ⚠️  Small images (<1KB): ${smallImages}`);
      console.log(
        `   📦 Total size: ${totalSize} bytes (${(
          totalSize /
          1024 /
          1024
        ).toFixed(2)} MB)`
      );
      console.log(
        `   📈 Average size: ${Math.round(totalSize / imageFiles.length)} bytes`
      );
      console.log(
        `   🎯 Success rate: ${Math.round(
          (realImages / imageFiles.length) * 100
        )}%`
      );
      console.log(
        `   📏 Largest: ${largestImage.name} (${largestImage.size} bytes)`
      );
      console.log(
        `   📏 Smallest: ${smallestImage.name} (${smallestImage.size} bytes)`
      );

      // Test a few image files for validity
      console.log(`\n🔍 Testing image file integrity:`);
      const testFiles = imageFiles.slice(0, 3);
      testFiles.forEach((file) => {
        const filePath = `${outputDir}/images/${file}`;
        const buffer = fs.readFileSync(filePath);

        if (buffer[0] === 0xff && buffer[1] === 0xd8) {
          console.log(`   ✅ ${file}: Valid JPEG signature`);
        } else if (
          buffer[0] === 0x89 &&
          buffer[1] === 0x50 &&
          buffer[2] === 0x4e &&
          buffer[3] === 0x47
        ) {
          console.log(`   ✅ ${file}: Valid PNG signature`);
        } else {
          console.log(
            `   ⚠️  ${file}: Unknown format (${buffer
              .slice(0, 4)
              .toString("hex")})`
          );
        }
      });

      // Create image analysis
      const imageAnalysis = {
        totalFiles: imageFiles.length,
        realImages,
        smallImages,
        totalSizeBytes: totalSize,
        totalSizeMB: parseFloat((totalSize / 1024 / 1024).toFixed(2)),
        averageSize: Math.round(totalSize / imageFiles.length),
        successRate: Math.round((realImages / imageFiles.length) * 100),
        largest: largestImage,
        smallest: smallestImage,
        sampleFiles: imageFiles.slice(0, 10).map((file) => {
          const filePath = `${outputDir}/images/${file}`;
          const stats = fs.statSync(filePath);
          return { name: file, size: stats.size };
        }),
      };

      fs.writeFileSync(
        `${outputDir}/image-analysis.json`,
        JSON.stringify(imageAnalysis, null, 2)
      );
      console.log(`   📊 Image analysis: image-analysis.json`);
    }

    // === CREATE README ===
    console.log(`\n📖 Creating README...\n`);

    const readme = `# PDF Extraction Results - Final Output

## Overview
Complete extraction of "${
      result.document.filename
    }" using the clean pdf-lib implementation.

**Extraction Date:** ${result.document.extractedAt}  
**Pages Processed:** ${result.document.pages}  
**Images Extracted:** ${result.images.length}  
**Text Items:** ${result.textItems.length}  

## Files Generated

### 📝 Text Files
- \`text-raw-clean.txt\` - Clean text without any markers (${
      result.cleanText.length
    } characters)
- \`text-with-markers.txt\` - Text with page markers and image references

### 📊 JSON Data Files
- \`complete-extraction.json\` - Complete extraction result with all data
- \`structured-data.json\` - Page-by-page structured data
- \`text-items.json\` - All text items with positioning (${
      result.textItems.length
    } items)
- \`images-metadata.json\` - All image metadata (${result.images.length} images)
- \`document-info.json\` - Document statistics and metadata
- \`image-analysis.json\` - Detailed image file analysis

### 🖼️ Image Files
- \`images/\` directory containing ${result.images.length} extracted image files
- All images use the naming pattern: \`img_p{page}_{id}.jpg\`
- Real image data extracted using pdf-lib with zlib decompression

## Statistics

### Text Analysis
- **Characters:** ${documentInfo.statistics.text.totalCharacters}
- **Words:** ${documentInfo.statistics.text.totalWords}
- **Text Items:** ${documentInfo.statistics.text.textItems}
- **Types:** ${Object.entries(documentInfo.statistics.text.textItemsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ")}

### Image Analysis
- **Total Images:** ${documentInfo.statistics.images.totalImages}
- **Formats:** ${Object.entries(documentInfo.statistics.images.imageFormats)
      .map(([format, count]) => `${format}: ${count}`)
      .join(", ")}
- **Pages with Images:** ${
      Object.keys(documentInfo.statistics.images.imagesByPage).length
    }

## Technical Details

### Implementation
- **Library:** pdf-lib with zlib decompression
- **Compression Handling:** FlateDecode + DCTDecode dual compression
- **Image Format Detection:** JPEG/PNG signature validation
- **No Global Polyfills:** Clean TypeScript implementation

### API Usage
\`\`\`javascript
const { extractPdfContent } = require('@pdf-extractor/core');

const result = await extractPdfContent('document.pdf', {
  extractText: true,
  extractImages: true,
  extractImageFiles: true,
  extractTextItems: true,
  generateStructuredData: true,
  imageOutputDir: './images'
});
\`\`\`

---
Generated by PDF Extractor Library - Clean Implementation
`;

    fs.writeFileSync(`${outputDir}/README.md`, readme);
    console.log(`   📖 README.md created`);

    // === FINAL SUMMARY ===
    console.log(`\n🎉 Final Output Demo Complete!\n`);
    console.log(`📁 Output directory: ${outputDir}/`);
    console.log(`📊 Files generated:`);

    const allFiles = [];
    function collectFiles(dir, prefix = "") {
      const items = fs.readdirSync(dir);
      items.forEach((item) => {
        const fullPath = path.join(dir, item);
        const relativePath = prefix + item;

        if (fs.statSync(fullPath).isDirectory()) {
          allFiles.push(`${relativePath}/ (directory)`);
          collectFiles(fullPath, relativePath + "/");
        } else {
          const size = fs.statSync(fullPath).size;
          allFiles.push(`${relativePath} (${size} bytes)`);
        }
      });
    }

    collectFiles(outputDir);
    allFiles.forEach((file) => {
      console.log(`   📄 ${file}`);
    });

    console.log(`\n✨ All files are ready for inspection!`);
    console.log(`   🔍 Check the images/ directory for extracted image files`);
    console.log(`   📖 Read README.md for complete documentation`);
    console.log(`   📊 Review JSON files for structured data`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
}

// Run the final demo
if (require.main === module) {
  finalOutputDemo().catch(console.error);
}

module.exports = { finalOutputDemo };
