/**
 * Test real image extraction from Art Basel PDF
 * Check if we're getting actual image data instead of placeholders
 */

const { extractPdfContent } = require('../dist/index.js');
const fs = require('fs');

async function testRealImageExtraction() {
  console.log('🔍 Testing Real Image Extraction\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    // Test with real image extraction
    console.log('📁 Extracting images with real extraction...');
    const result = await extractPdfContent(pdfPath, {
      extractText: false,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './real-image-test',
      verbose: true
    });

    console.log(`\n📊 Extraction Results:`);
    console.log(`   📄 Pages: ${result.document?.pages || 0}`);
    console.log(`   🖼️  Images detected: ${result.images?.length || 0}`);

    // Check the actual image files
    if (fs.existsSync('./real-image-test')) {
      const files = fs.readdirSync('./real-image-test');
      console.log(`\n📁 Created ${files.length} image files:`);
      
      // Check file sizes
      let realImages = 0;
      let placeholderImages = 0;
      let totalSize = 0;
      
      files.slice(0, 10).forEach((file, i) => {
        const filePath = `./real-image-test/${file}`;
        const stats = fs.statSync(filePath);
        const size = stats.size;
        totalSize += size;
        
        if (size > 100) {
          realImages++;
          console.log(`   ✅ ${file}: ${size} bytes (REAL IMAGE)`);
        } else {
          placeholderImages++;
          console.log(`   ❌ ${file}: ${size} bytes (placeholder)`);
        }
      });
      
      if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more files`);
        
        // Check remaining files
        files.slice(10).forEach(file => {
          const filePath = `./real-image-test/${file}`;
          const stats = fs.statSync(filePath);
          const size = stats.size;
          totalSize += size;
          
          if (size > 100) {
            realImages++;
          } else {
            placeholderImages++;
          }
        });
      }
      
      console.log(`\n📊 Summary:`);
      console.log(`   ✅ Real images: ${realImages}`);
      console.log(`   ❌ Placeholder images: ${placeholderImages}`);
      console.log(`   📦 Total size: ${totalSize} bytes`);
      console.log(`   📈 Average size: ${Math.round(totalSize / files.length)} bytes`);
      
      if (realImages > 0) {
        console.log(`\n🎉 SUCCESS! Real image extraction is working!`);
        console.log(`💡 ${realImages} out of ${files.length} images were successfully extracted.`);
      } else {
        console.log(`\n⚠️  All images are still placeholders (12 bytes each).`);
        console.log(`💡 This means the PDF image extraction needs more work.`);
      }
      
      // Test opening one of the larger files
      const largeFiles = files.filter(file => {
        const filePath = `./real-image-test/${file}`;
        const stats = fs.statSync(filePath);
        return stats.size > 100;
      });
      
      if (largeFiles.length > 0) {
        console.log(`\n🔍 Testing image file integrity:`);
        const testFile = largeFiles[0];
        const testPath = `./real-image-test/${testFile}`;
        const buffer = fs.readFileSync(testPath);
        
        // Check for JPEG signature
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          console.log(`   ✅ ${testFile}: Valid JPEG signature detected`);
        }
        // Check for PNG signature  
        else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          console.log(`   ✅ ${testFile}: Valid PNG signature detected`);
        }
        else {
          console.log(`   ⚠️  ${testFile}: Unknown image format (first 4 bytes: ${buffer.slice(0, 4).toString('hex')})`);
        }
      }
      
    } else {
      console.log('❌ No image directory created');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
if (require.main === module) {
  testRealImageExtraction().catch(console.error);
}

module.exports = { testRealImageExtraction };
