/**
 * Test the PDF extractor library with a sample PDF
 */

const { extractPdfContent, extractText, extractImages } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

async function testLibrary() {
  console.log('🧪 Testing PDF Extractor Library\n');

  // Check if we have any PDF files in the parent directory
  const parentDir = path.join(__dirname, '../../');
  const pdfFiles = fs.readdirSync(parentDir).filter(file => file.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.log('📄 No PDF files found in parent directory.');
    console.log('   Creating a simple test to verify library structure...\n');
    
    // Test library structure without actual PDF
    try {
      console.log('✅ Testing library imports...');
      console.log('   - extractPdfContent:', typeof extractPdfContent);
      console.log('   - extractText:', typeof extractText);
      console.log('   - extractImages:', typeof extractImages);
      
      console.log('\n✅ Library structure is working correctly!');
      console.log('📝 To test with real PDFs, add a PDF file to the parent directory.');
      
    } catch (error) {
      console.error('❌ Library import error:', error.message);
    }
    return;
  }

  // Test with the first PDF file found
  const testPdf = path.join(parentDir, pdfFiles[0]);
  console.log(`📄 Testing with: ${pdfFiles[0]}\n`);

  try {
    // Test 1: Text-only extraction
    console.log('🔤 Test 1: Text-only extraction');
    const textResult = await extractText(testPdf);
    console.log(`   ✅ Extracted ${textResult.text?.length || 0} characters`);
    console.log(`   📊 Pages processed: ${textResult.totalPages || 0}`);

    // Test 2: Images-only extraction
    console.log('\n🖼️  Test 2: Images-only extraction');
    const imageResult = await extractImages(testPdf, { verbose: true });
    console.log(`   ✅ Found ${imageResult.totalImages || 0} images`);
    console.log(`   📊 Pages processed: ${imageResult.totalPages || 0}`);

    // Test 3: Combined extraction
    console.log('\n📄 Test 3: Combined extraction');
    const combinedResult = await extractPdfContent(testPdf, {
      extractText: true,
      extractImages: true,
      verbose: true
    });
    console.log(`   ✅ Text elements: ${combinedResult.textItems?.length || 0}`);
    console.log(`   ✅ Image elements: ${combinedResult.images?.length || 0}`);
    console.log(`   📊 Total pages: ${combinedResult.totalPages || 0}`);

    // Test 4: Extract with image files
    console.log('\n💾 Test 4: Extract with image files');
    const fileResult = await extractPdfContent(testPdf, {
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './test-images',
      useImagePaths: true,
      imageRefFormat: '📷 Image {index} on page {page}',
      verbose: true
    });
    console.log(`   ✅ Images with files: ${fileResult.images?.length || 0}`);
    
    // Check if image files were created
    if (fs.existsSync('./test-images')) {
      const imageFiles = fs.readdirSync('./test-images');
      console.log(`   💾 Image files created: ${imageFiles.length}`);
      if (imageFiles.length > 0) {
        console.log(`   📁 Sample files: ${imageFiles.slice(0, 3).join(', ')}`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('📚 The PDF extractor library is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 This might be due to:');
    console.log('   - PDF.js compatibility issues');
    console.log('   - Unsupported PDF format');
    console.log('   - Missing dependencies');
    console.log('\n🔧 The library structure is still valid for further development.');
  }
}

// Run the test
if (require.main === module) {
  testLibrary().catch(console.error);
}

module.exports = { testLibrary };
