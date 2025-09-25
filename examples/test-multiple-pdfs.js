const { TextExtractor, ImageExtractor } = require("../dist/index.js");
const fs = require("fs");
const path = require("path");

async function testMultiplePDFs() {
  console.log("🎯 Testing Multiple PDFs - Clean API\n");

  // Define PDFs to test
  const pdfs = [
    {
      name: "Art Basel 2025",
      file: "../Art Basel 2025_ Yares Art Preview (1).pdf",
      outputDir: "./output-art-basel"
    },
    {
      name: "Frieze Seoul 2025", 
      file: "../Frieze Seoul 2025_Booth B6_PDF (2) (1).pdf",
      outputDir: "./output-frieze-seoul"
    }
  ];

  for (const pdf of pdfs) {
    console.log(`\n📄 Processing: ${pdf.name}`);
    console.log(`📁 Output: ${pdf.outputDir}`);
    
    // Check if PDF exists
    if (!fs.existsSync(pdf.file)) {
      console.log(`❌ PDF not found: ${pdf.file}`);
      continue;
    }

    try {
      // Create output directory
      if (fs.existsSync(pdf.outputDir)) {
        fs.rmSync(pdf.outputDir, { recursive: true });
      }
      fs.mkdirSync(pdf.outputDir, { recursive: true });

      // === TEXT EXTRACTION ===
      console.log("\n📝 Extracting text with accurate pages...");
      const textExtractor = new TextExtractor();

      const textResult = await textExtractor.extractWithAccuratePages(pdf.file);
      console.log(`   ✅ Extracted ${textResult.totalPages} pages`);
      console.log(`   ✅ Total text: ${textResult.fullText.length} characters`);

      // Get text with page markers and image references
      const markedResult = await textExtractor.extractWithPageMarkers(
        pdf.file,
        "--- PAGE {page} ---",
        {
          includeImageRefs: true,
          imageRefFormat: "[IMG:{id}] {name}",
        }
      );
      console.log(`   ✅ Text with markers: ${markedResult.text.length} characters`);

      // === IMAGE EXTRACTION ===
      console.log("\n🖼️  Extracting images...");
      const imageExtractor = new ImageExtractor();

      const imageResult = await imageExtractor.extractWithPdfLib(pdf.file, {
        imageOutputDir: `${pdf.outputDir}/images`,
        extractImageFiles: true,
        verbose: false, // Disable verbose for cleaner output
      });
      console.log(`   ✅ Extracted ${imageResult.images?.length || 0} images`);

      // === SAVE RESULTS ===
      console.log("\n💾 Saving results...");
      
      // Save clean text
      fs.writeFileSync(
        path.join(pdf.outputDir, "text-raw-clean.txt"),
        textResult.fullText
      );
      console.log(`   📝 Clean text: text-raw-clean.txt (${textResult.fullText.length} chars)`);

      // Save text with markers
      fs.writeFileSync(
        path.join(pdf.outputDir, "text-with-markers.txt"),
        markedResult.text
      );
      console.log(`   📝 Marked text: text-with-markers.txt (${markedResult.text.length} chars)`);

      // Save structured data
      const structuredData = {
        document: {
          filename: path.basename(pdf.file),
          extractedAt: new Date().toISOString(),
          totalPages: textResult.totalPages,
          totalTextLength: textResult.fullText.length,
          totalImages: imageResult.images?.length || 0,
        },
        pages: textResult.pages,
      };
      
      fs.writeFileSync(
        path.join(pdf.outputDir, "structured-data.json"),
        JSON.stringify(structuredData, null, 2)
      );
      console.log(`   📊 Structured data: structured-data.json`);

      // Save image metadata
      if (imageResult.images && imageResult.images.length > 0) {
        fs.writeFileSync(
          path.join(pdf.outputDir, "images-metadata.json"),
          JSON.stringify(imageResult.images, null, 2)
        );
        console.log(`   🖼️  Images metadata: images-metadata.json (${imageResult.images.length} images)`);
      }

      // === VERIFICATION ===
      console.log("\n🎯 Quick verification:");
      
      // Check for key content in first few pages
      const firstPages = textResult.pages.slice(0, 5);
      firstPages.forEach((page, index) => {
        if (page.text.content.trim()) {
          const preview = page.text.content.substring(0, 50).replace(/\n/g, " ");
          console.log(`   📄 Page ${page.pageNumber}: "${preview}..."`);
        }
      });

      console.log(`\n✅ ${pdf.name} processing complete!`);
      console.log(`📁 Results saved to: ${pdf.outputDir}/`);

    } catch (error) {
      console.error(`❌ Error processing ${pdf.name}:`, error.message);
    }
  }

  console.log("\n🎉 All PDFs processed!");
}

// Run the test
testMultiplePDFs().catch(console.error);
