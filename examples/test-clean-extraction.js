/**
 * Test the clean image extraction implementation
 * This should only create working images, no broken ones
 */

const { extractPdfContent } = require('../dist/index.js');
const fs = require('fs');

async function testCleanExtraction() {
  console.log('🧪 Testing Clean Image Extraction\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  const outputDir = './clean-test-output';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  // Clean up previous test
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  try {
    console.log('🔍 Extracting with clean implementation...');
    
    const result = await extractPdfContent(pdfPath, {
      extractText: false,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: outputDir,
      verbose: true
    });

    console.log(`\n📊 Results:`);
    console.log(`   📄 Pages: ${result.document.pages}`);
    console.log(`   🖼️  Images: ${result.images.length}`);

    // Check the actual image files
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      console.log(`\n📁 Created ${files.length} image files:`);
      
      let realImages = 0;
      let brokenImages = 0;
      let totalSize = 0;
      
      files.forEach((file, i) => {
        if (i < 10) { // Show first 10
          const filePath = `${outputDir}/${file}`;
          const stats = fs.statSync(filePath);
          const size = stats.size;
          totalSize += size;
          
          if (size > 1000) {
            realImages++;
            console.log(`   ✅ ${file}: ${size} bytes (REAL IMAGE)`);
          } else {
            brokenImages++;
            console.log(`   ❌ ${file}: ${size} bytes (broken/small)`);
          }
        }
      });
      
      if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more files`);
        
        // Check remaining files
        files.slice(10).forEach(file => {
          const filePath = `${outputDir}/${file}`;
          const stats = fs.statSync(filePath);
          const size = stats.size;
          totalSize += size;
          
          if (size > 1000) {
            realImages++;
          } else {
            brokenImages++;
          }
        });
      }
      
      console.log(`\n📊 Summary:`);
      console.log(`   ✅ Real images (>1KB): ${realImages}`);
      console.log(`   ❌ Small/broken images: ${brokenImages}`);
      console.log(`   📦 Total size: ${totalSize} bytes`);
      console.log(`   📈 Average size: ${Math.round(totalSize / files.length)} bytes`);
      console.log(`   🎯 Success rate: ${Math.round((realImages / files.length) * 100)}%`);
      
      if (realImages === files.length) {
        console.log(`\n🎉 PERFECT! All ${files.length} images are real (no broken files)!`);
      } else if (realImages > brokenImages) {
        console.log(`\n✅ GOOD! Majority of images are real (${realImages}/${files.length})`);
      } else {
        console.log(`\n⚠️  ISSUE! Too many broken images (${brokenImages}/${files.length})`);
      }
      
      // Test opening one of the larger files
      const largeFiles = files.filter(file => {
        const filePath = `${outputDir}/${file}`;
        const stats = fs.statSync(filePath);
        return stats.size > 1000;
      });
      
      if (largeFiles.length > 0) {
        console.log(`\n🔍 Testing image file integrity:`);
        const testFile = largeFiles[0];
        const testPath = `${outputDir}/${testFile}`;
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
      console.log('❌ No output directory created');
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
  testCleanExtraction().catch(console.error);
}

module.exports = { testCleanExtraction };
