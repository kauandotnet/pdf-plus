const { ImageExtractor } = require("../dist/index.js");
const fs = require("fs");

async function debugArtBaselImages() {
  console.log("🔍 Debugging Art Basel Yares Image Extraction\n");

  const pdfPath = "../Art Basel 2025_ Yares Art Preview (1).pdf";
  
  if (!fs.existsSync(pdfPath)) {
    console.log(`❌ PDF not found: ${pdfPath}`);
    return;
  }

  try {
    const imageExtractor = new ImageExtractor();

    // Extract with verbose logging to see what's happening
    console.log("🖼️  Extracting images with detailed logging...\n");
    
    const result = await imageExtractor.extractWithPdfLib(pdfPath, {
      imageOutputDir: "./debug-images",
      extractImageFiles: true,
      verbose: true, // Enable detailed logging
    });

    console.log(`\n📊 Extraction Summary:`);
    console.log(`   Total images: ${result.images?.length || 0}`);
    
    if (result.images && result.images.length > 0) {
      console.log(`\n🔍 First 5 images details:`);
      result.images.slice(0, 5).forEach((img, index) => {
        console.log(`   ${index + 1}. ${img.filename}`);
        console.log(`      Page: ${img.page}`);
        console.log(`      Size: ${img.size} bytes`);
        console.log(`      Format: ${img.format}`);
        console.log(`      Dimensions: ${img.width}x${img.height}`);
        
        // Check if file exists and is readable
        const filePath = `./debug-images/${img.filename}`;
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`      File size on disk: ${stats.size} bytes`);
          
          // Read first few bytes to check format
          const buffer = fs.readFileSync(filePath);
          const firstBytes = Array.from(buffer.slice(0, 8))
            .map(b => '0x' + b.toString(16).padStart(2, '0'))
            .join(' ');
          console.log(`      First bytes: ${firstBytes}`);
          
          // Check if it's a valid image format
          if (buffer.length >= 4) {
            if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
              console.log(`      ✅ Valid JPEG header`);
            } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
              console.log(`      ✅ Valid PNG header`);
            } else {
              console.log(`      ❌ Invalid image header - file is corrupted`);
            }
          }
        } else {
          console.log(`      ❌ File not found on disk`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error(`❌ Error during extraction:`, error.message);
  }
}

// Run the debug
debugArtBaselImages().catch(console.error);
