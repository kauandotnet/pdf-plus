#!/usr/bin/env node

import { extractPdfContent } from "../dist/index.js";
import fs from "fs";

async function testFullExtractionWithPoppler() {
  console.log("🎯 Full PDF Content Extraction with Poppler Engine\n");

  const pdfPath = "Art Basel 2025_ Yares Art Preview (1).pdf";
  const outputDir = "full-extraction-poppler";

  console.log("🔧 Extracting with Poppler engine (PNG conversion)...");

  try {
    const result = await extractPdfContent(pdfPath, {
      // Engine selection
      imageEngine: "poppler",

      // Text extraction
      extractText: true,
      extractTextItems: true,
      includePageMarkers: true,
      includeImageRefs: true,
      pageMarkerFormat: "--- PAGE {page} ---",
      imageRefFormat: "[IMG:{id}] {name}",

      // Image extraction
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: outputDir,
      useImagePaths: true,

      // Structured data
      generateStructuredData: true,

      // Output options
      verbose: true,
    });

    console.log("\n✅ Extraction completed successfully!");

    // Save structured data files
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save structured JSON data
    if (result.structuredData) {
      const jsonPath = `${outputDir}/structured-data.json`;
      fs.writeFileSync(
        jsonPath,
        JSON.stringify(result.structuredData, null, 2)
      );
      console.log(`💾 Saved structured data: ${jsonPath}`);
    }

    // Save clean text
    if (result.cleanText) {
      const textPath = `${outputDir}/clean-text.txt`;
      fs.writeFileSync(textPath, result.cleanText);
      console.log(`💾 Saved clean text: ${textPath}`);
    }

    // Save text with image references
    if (result.textWithRefs) {
      const textWithRefsPath = `${outputDir}/text-with-image-refs.txt`;
      fs.writeFileSync(textWithRefsPath, result.textWithRefs);
      console.log(`💾 Saved text with image refs: ${textWithRefsPath}`);
    }

    // Save text with page markers
    if (result.textWithPageMarkers) {
      const textWithMarkersPath = `${outputDir}/text-with-page-markers.txt`;
      fs.writeFileSync(textWithMarkersPath, result.textWithPageMarkers);
      console.log(`💾 Saved text with page markers: ${textWithMarkersPath}`);
    }

    console.log("\n📊 Results Summary:");
    console.log(`   📄 Pages: ${result.document.pages}`);
    console.log(`   📝 Text length: ${result.cleanText.length} characters`);
    console.log(`   🖼️  Images: ${result.images?.length || 0}`);
    console.log(`   🔧 Engine used: ${result.metadata?.engine || "unknown"}`);

    // Check output directory
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      const pngFiles = files.filter((f) => f.endsWith(".png"));
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      const txtFiles = files.filter((f) => f.endsWith(".txt"));

      console.log(`\n📁 Output Directory (${outputDir}):`);
      console.log(`   🖼️  PNG images: ${pngFiles.length}`);
      console.log(`   📋 JSON files: ${jsonFiles.length}`);
      console.log(`   📝 TXT files: ${txtFiles.length}`);

      if (pngFiles.length > 0) {
        console.log(
          `   📄 First few PNG files: ${pngFiles.slice(0, 5).join(", ")}`
        );
      }
    }

    // Show sample text with image references
    if (result.textWithPageMarkers) {
      console.log("\n📝 Sample text with image references:");
      const lines = result.textWithPageMarkers.split("\n");
      const sampleLines = lines.slice(0, 20);
      sampleLines.forEach((line) => {
        if (line.trim()) {
          console.log(`   ${line}`);
        }
      });
      if (lines.length > 20) {
        console.log(`   ... (${lines.length - 20} more lines)`);
      }
    }

    // Show image details
    if (result.images && result.images.length > 0) {
      console.log("\n🖼️  Image Details:");
      result.images.slice(0, 5).forEach((img, i) => {
        console.log(
          `   ${i + 1}. ${img.filename || img.id} (${img.format}) - Page ${
            img.page
          }`
        );
        if (img.filepath) {
          console.log(`      📁 File: ${img.filepath}`);
        }
        console.log(
          `      📏 Size: ${img.width}x${img.height}, ${img.size} bytes`
        );
      });
      if (result.images.length > 5) {
        console.log(`   ... (${result.images.length - 5} more images)`);
      }
    }

    // Show document metadata
    console.log("\n📋 Document Metadata:");
    console.log(`   📄 Title: ${result.document.title || "N/A"}`);
    console.log(`   👤 Author: ${result.document.author || "N/A"}`);
    console.log(`   📅 Created: ${result.document.creationDate || "N/A"}`);
    console.log(`   🔧 Producer: ${result.document.producer || "N/A"}`);

    console.log(
      "\n🎉 Full extraction with Poppler engine completed successfully!"
    );
    console.log(`📁 All files saved to: ${outputDir}/`);
  } catch (error) {
    console.error("❌ Extraction failed:", error);
    process.exit(1);
  }
}

testFullExtractionWithPoppler().catch(console.error);
