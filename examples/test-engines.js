import { ImageExtractor } from "../dist/index.js";
import path from "path";

async function testEngines() {
  console.log("🔧 Testing Image Extraction Engines\n");

  // Check available engines
  console.log("📊 Available Engines:");
  const engines = await ImageExtractor.getAvailableEngines();
  for (const engine of engines) {
    console.log(`   ${engine.available ? '✅' : '❌'} ${engine.name}: ${engine.description}`);
    console.log(`      Formats: ${engine.capabilities.formats.join(', ')}`);
    console.log(`      Metadata: ${engine.capabilities.supportsMetadata ? 'Yes' : 'No'}`);
    console.log(`      Embedded: ${engine.capabilities.supportsEmbeddedImages ? 'Yes' : 'No'}`);
    console.log(`      Vector: ${engine.capabilities.supportsVectorImages ? 'Yes' : 'No'}`);
    console.log();
  }

  // Get recommendations
  console.log("💡 Engine Recommendations:");
  const recommendations = ImageExtractor.getEngineRecommendations();
  for (const rec of recommendations) {
    console.log(`   ${rec.useCase}: ${rec.engine}`);
    console.log(`      Reason: ${rec.reason}`);
    console.log();
  }

  // Test extraction with different engines
  const pdfPath = "Art Basel 2025_ Yares Art Preview (1).pdf";
  const outputDir = "test-engines-output";

  if (!require('fs').existsSync(pdfPath)) {
    console.log(`❌ PDF file not found: ${pdfPath}`);
    return;
  }

  const testEngines = ['auto', 'pdf-lib'];
  
  for (const engineName of testEngines) {
    console.log(`\n🔧 Testing ${engineName} engine:`);
    
    try {
      const extractor = new ImageExtractor();
      const result = await extractor.extract(pdfPath, {
        imageEngine: engineName,
        extractImageFiles: true,
        imageOutputDir: path.join(outputDir, engineName),
        verbose: true,
      });

      console.log(`   ✅ Success: ${result.totalImages} images extracted`);
      
      if (result.images && result.images.length > 0) {
        console.log(`   📊 Sample images:`);
        for (let i = 0; i < Math.min(3, result.images.length); i++) {
          const img = result.images[i];
          console.log(`      ${img.filename}: ${img.width}x${img.height} ${img.format} (${img.size} bytes)`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  // Test poppler if available
  try {
    console.log(`\n🔧 Testing poppler engine:`);
    const extractor = new ImageExtractor();
    const result = await extractor.extract(pdfPath, {
      imageEngine: 'poppler',
      extractImageFiles: true,
      imageOutputDir: path.join(outputDir, 'poppler'),
      verbose: true,
    });

    console.log(`   ✅ Success: ${result.totalImages} images extracted`);
  } catch (error) {
    console.log(`   ❌ Poppler not available: ${error.message}`);
  }
}

testEngines().catch(console.error);
