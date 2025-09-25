/**
 * Test the new rawText feature - clean text without page markers or image references
 */

const { extractPdfContent, PDFExtractor } = require('../dist/index.js');
const fs = require('fs');

async function testRawTextExtraction() {
  console.log('📝 Raw Text Extraction Demo\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    const extractor = new PDFExtractor();

    // === 1. Compare regular text vs raw text ===
    console.log('🔍 Comparing regular text vs raw text for page 1...\n');
    
    const page1Data = await extractor.getPage(pdfPath, 1, {
      extractText: true,
      extractImages: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      imageRefFormat: '[IMG:{id}] {name}',
      verbose: false
    });

    console.log('📄 Regular text (with markers and image refs):');
    console.log(`   Length: ${page1Data.text.length} characters`);
    console.log(`   Preview: "${page1Data.text.substring(0, 200)}..."\n`);

    console.log('✨ Raw text (clean, no markers/refs):');
    console.log(`   Length: ${page1Data.rawText.length} characters`);
    console.log(`   Preview: "${page1Data.rawText.substring(0, 200)}..."\n`);

    // === 2. Test the new getRawText method ===
    console.log('🎯 Testing getRawText() method...');
    const rawTextOnly = await extractor.getRawText(pdfPath, 1);
    
    console.log(`   Raw text length: ${rawTextOnly.length} characters`);
    console.log(`   Matches page data: ${rawTextOnly === page1Data.rawText ? 'YES' : 'NO'}\n`);

    // === 3. Save raw text to file ===
    fs.writeFileSync('./raw-text-only.txt', page1Data.rawText);
    console.log('💾 Saved raw text to: raw-text-only.txt\n');

    // === 4. Test structured data with raw text ===
    console.log('📊 Testing structured JSON with raw text...');
    const structuredResult = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      generateStructuredData: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      imageRefFormat: '[IMG:{id}] {name}',
      verbose: false
    });

    if (structuredResult.structuredData && structuredResult.structuredData.pages.length > 0) {
      const page1Structured = structuredResult.structuredData.pages[0];
      
      console.log('   📄 Structured page data:');
      console.log(`     Content length: ${page1Structured.text.content.length} chars`);
      console.log(`     Raw text length: ${page1Structured.text.rawText.length} chars`);
      console.log(`     Word count: ${page1Structured.text.wordCount} words`);
      console.log(`     Character count: ${page1Structured.text.characterCount} chars`);
      
      // Save structured data with raw text
      fs.writeFileSync('./structured-with-raw-text.json', JSON.stringify(structuredResult.structuredData, null, 2));
      console.log('   💾 Saved structured data with raw text: structured-with-raw-text.json\n');
    }

    // === 5. Show the difference ===
    console.log('🔍 Text cleaning analysis:');
    const originalLength = page1Data.text.length;
    const rawLength = page1Data.rawText.length;
    const reduction = originalLength - rawLength;
    const reductionPercent = Math.round((reduction / originalLength) * 100);
    
    console.log(`   📏 Original text: ${originalLength} characters`);
    console.log(`   ✨ Raw text: ${rawLength} characters`);
    console.log(`   📉 Reduction: ${reduction} characters (${reductionPercent}%)`);
    console.log(`   🧹 Removed: page markers, image references, extra whitespace\n`);

    // === 6. Show first few lines of each ===
    console.log('📖 First 5 lines comparison:');
    
    const originalLines = page1Data.text.split('\n').slice(0, 5);
    const rawLines = page1Data.rawText.split('\n').slice(0, 5);
    
    console.log('   📄 Original:');
    originalLines.forEach((line, i) => {
      console.log(`     ${i+1}. "${line}"`);
    });
    
    console.log('\n   ✨ Raw:');
    rawLines.forEach((line, i) => {
      console.log(`     ${i+1}. "${line}"`);
    });

    console.log('\n💡 API Usage Examples:');
    console.log('   📝 Get raw text only: await extractor.getRawText(pdfPath, 1)');
    console.log('   📄 Get page with raw text: await extractor.getPage(pdfPath, 1)');
    console.log('   📊 Structured data includes both content and rawText fields');

    console.log('\n🎉 Raw text extraction demo completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the demo
if (require.main === module) {
  testRawTextExtraction().catch(console.error);
}

module.exports = { testRawTextExtraction };
