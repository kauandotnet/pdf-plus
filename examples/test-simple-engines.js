import { ImageExtractor } from "../dist/index.js";

async function testSimple() {
  console.log("🔧 Testing Simple Engine System\n");

  try {
    // Test with auto engine selection
    const extractor = new ImageExtractor();
    const result = await extractor.extract("Art Basel 2025_ Yares Art Preview (1).pdf", {
      imageEngine: 'auto',
      extractImageFiles: true,
      imageOutputDir: 'test-simple-output',
      verbose: true,
    });

    console.log(`✅ Success: ${result.totalImages} images extracted`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testSimple().catch(console.error);
