import { ImageExtractor } from "../dist/index.js";
import path from "path";
import fs from "fs";

/**
 * Demo: Image Extraction Engine Selection
 * 
 * This demonstrates how to use different image extraction engines:
 * - pdf-lib: Pure JavaScript, comprehensive format support
 * - poppler: Native tools, fast extraction
 * - auto: Automatically select best available engine
 */

async function demoEngineSelection() {
  console.log("🎯 PDF Image Extraction Engine Selection Demo\n");

  const pdfPath = "Art Basel 2025_ Yares Art Preview (1).pdf";
  
  if (!fs.existsSync(pdfPath)) {
    console.log(`❌ PDF file not found: ${pdfPath}`);
    console.log("Please ensure the PDF file is in the current directory.");
    return;
  }

  // Demo 1: Auto engine selection (recommended)
  console.log("🔧 Demo 1: Auto Engine Selection (Recommended)");
  console.log("This automatically selects the best available engine on your system.\n");
  
  try {
    const extractor = new ImageExtractor();
    const result = await extractor.extract(pdfPath, {
      imageEngine: 'auto', // Let the system choose the best engine
      extractImageFiles: true,
      imageOutputDir: 'demo-output-auto',
      verbose: true,
    });

    console.log(`✅ Auto engine extracted ${result.totalImages} images\n`);
  } catch (error) {
    console.log(`❌ Auto engine failed: ${error.message}\n`);
  }

  // Demo 2: Explicit pdf-lib engine
  console.log("🔧 Demo 2: PDF-lib Engine (Pure JavaScript)");
  console.log("Best for: Maximum compatibility, all PDF formats, metadata accuracy\n");
  
  try {
    const extractor = new ImageExtractor();
    const result = await extractor.extract(pdfPath, {
      imageEngine: 'pdf-lib', // Explicitly use pdf-lib
      extractImageFiles: true,
      imageOutputDir: 'demo-output-pdf-lib',
      verbose: true,
    });

    console.log(`✅ PDF-lib engine extracted ${result.totalImages} images\n`);
  } catch (error) {
    console.log(`❌ PDF-lib engine failed: ${error.message}\n`);
  }

  // Demo 3: Poppler engine (if available)
  console.log("🔧 Demo 3: Poppler Engine (Native Tools)");
  console.log("Best for: Fast extraction, batch processing, vector graphics\n");
  
  try {
    const extractor = new ImageExtractor();
    const result = await extractor.extract(pdfPath, {
      imageEngine: 'poppler', // Use poppler if available
      extractImageFiles: true,
      imageOutputDir: 'demo-output-poppler',
      verbose: true,
    });

    console.log(`✅ Poppler engine extracted ${result.totalImages} images\n`);
  } catch (error) {
    console.log(`❌ Poppler engine not available: ${error.message}\n`);
  }

  // Demo 4: Engine capabilities and recommendations
  console.log("📊 Engine Information:");
  
  try {
    const engines = await ImageExtractor.getAvailableEngines();
    console.log("\nAvailable Engines:");
    for (const engine of engines) {
      console.log(`   ${engine.available ? '✅' : '❌'} ${engine.name}: ${engine.description}`);
      console.log(`      Formats: ${engine.capabilities.formats.join(', ')}`);
      console.log(`      Metadata: ${engine.capabilities.supportsMetadata ? 'Yes' : 'No'}`);
      console.log(`      Embedded: ${engine.capabilities.supportsEmbeddedImages ? 'Yes' : 'No'}`);
      console.log(`      Vector: ${engine.capabilities.supportsVectorImages ? 'Yes' : 'No'}`);
    }

    console.log("\nRecommendations:");
    const recommendations = ImageExtractor.getEngineRecommendations();
    for (const rec of recommendations) {
      console.log(`   ${rec.useCase}: ${rec.engine}`);
      console.log(`      ${rec.reason}`);
    }
  } catch (error) {
    console.log(`❌ Could not get engine information: ${error.message}`);
  }

  console.log("\n🎉 Demo completed! Check the output directories for extracted images.");
}

// Usage examples in code:

/**
 * Example 1: Simple extraction with auto engine
 */
async function simpleExtraction() {
  const extractor = new ImageExtractor();
  const result = await extractor.extract("document.pdf", {
    imageEngine: 'auto',
    extractImageFiles: true,
    imageOutputDir: 'images',
  });
  console.log(`Extracted ${result.totalImages} images`);
}

/**
 * Example 2: High-quality extraction with pdf-lib
 */
async function highQualityExtraction() {
  const extractor = new ImageExtractor();
  const result = await extractor.extract("document.pdf", {
    imageEngine: 'pdf-lib', // Best quality and format support
    extractImageFiles: true,
    imageOutputDir: 'high-quality-images',
    verbose: true,
  });
  console.log(`Extracted ${result.totalImages} images with full metadata`);
}

/**
 * Example 3: Fast batch processing with poppler
 */
async function fastBatchExtraction() {
  const extractor = new ImageExtractor();
  
  try {
    const result = await extractor.extract("document.pdf", {
      imageEngine: 'poppler', // Fastest for batch processing
      extractImageFiles: true,
      imageOutputDir: 'batch-images',
    });
    console.log(`Fast extraction: ${result.totalImages} images`);
  } catch (error) {
    // Fallback to pdf-lib if poppler not available
    console.log("Poppler not available, falling back to pdf-lib");
    const result = await extractor.extract("document.pdf", {
      imageEngine: 'pdf-lib',
      extractImageFiles: true,
      imageOutputDir: 'batch-images',
    });
    console.log(`Fallback extraction: ${result.totalImages} images`);
  }
}

// Run the demo
demoEngineSelection().catch(console.error);
