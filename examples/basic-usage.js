/**
 * Basic usage example for @pdf-extractor/core
 * 
 * This example demonstrates how to use the PDF extractor library
 * to extract text and images from a PDF file.
 */

const { extractPdfContent, extractText, extractImages } = require('../dist/index.js');

async function basicExample() {
  console.log('🚀 PDF Extractor Library - Basic Usage Example\n');

  // Note: You would need an actual PDF file for this to work
  const pdfPath = './sample.pdf';

  try {
    console.log('📝 Example 1: Extract text only (fast)');
    console.log('const text = await extractText("sample.pdf");');
    console.log('// This would extract only text content for fast processing\n');

    console.log('🖼️  Example 2: Extract images only');
    console.log('const images = await extractImages("sample.pdf");');
    console.log('// This would extract only image references\n');

    console.log('📄 Example 3: Extract both text and images');
    console.log('const result = await extractPdfContent("sample.pdf", {');
    console.log('  extractText: true,');
    console.log('  extractImages: true,');
    console.log('  verbose: true');
    console.log('});');
    console.log('// This would extract complete content\n');

    console.log('💾 Example 4: Extract with image files');
    console.log('const result = await extractPdfContent("sample.pdf", {');
    console.log('  extractImageFiles: true,');
    console.log('  imageOutputDir: "./my-images",');
    console.log('  useImagePaths: true,');
    console.log('  imageRefFormat: "📷 Image {index} on page {page}"');
    console.log('});');
    console.log('// This would save actual image files and use custom formatting\n');

    console.log('🎯 Example 5: Custom configuration');
    console.log('const result = await extractPdfContent("sample.pdf", {');
    console.log('  memoryLimit: "1GB",');
    console.log('  batchSize: 10,');
    console.log('  progressCallback: (progress) => {');
    console.log('    console.log(`Processing page ${progress.currentPage}/${progress.totalPages}`);');
    console.log('  }');
    console.log('});');
    console.log('// This would use advanced configuration options\n');

    console.log('✅ All examples shown above!');
    console.log('📚 To run with a real PDF file, replace "./sample.pdf" with your PDF path.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 This is expected since we don\'t have a sample.pdf file.');
    console.log('   Create a PDF file or update the path to test the library.');
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}

module.exports = { basicExample };
