/**
 * Test the page-aware text extractor to see if it fixes the page alignment issue
 */

const { PageAwareTextExtractor } = require('../dist/extractors/page-aware-text-extractor.js');

async function testPageAwareExtraction() {
  console.log('🧪 Testing Page-Aware Text Extraction\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    const extractor = new PageAwareTextExtractor();
    
    console.log('🔍 Extracting with page-aware method...\n');
    
    const result = await extractor.extractWithAccuratePages(pdfPath);
    
    console.log('📊 Results:');
    console.log(`   📄 Total pages: ${result.totalPages}`);
    console.log(`   📝 Full text length: ${result.fullText.length}`);
    console.log(`   📊 Extracted pages: ${result.pages.length}`);

    // Show first few pages
    console.log('\n📖 First 5 pages content:');
    result.pages.slice(0, 5).forEach((page) => {
      const preview = page.text.substring(0, 150).replace(/\n/g, ' ').trim();
      console.log(`   Page ${page.pageNumber}: "${preview}..." (${page.wordCount} words)`);
    });

    // Look for Joan Mitchell specifically
    console.log('\n🎯 Looking for Joan Mitchell:');
    result.pages.forEach((page) => {
      if (page.text.includes('Joan Mitchell')) {
        const preview = page.text.substring(0, 300).replace(/\n/g, ' ').trim();
        console.log(`   ✅ Found on Page ${page.pageNumber}: "${preview}..."`);
      }
    });

    // Look for Helen Frankenthaler
    console.log('\n🎯 Looking for Helen Frankenthaler:');
    result.pages.forEach((page) => {
      if (page.text.includes('Helen Frankenthaler')) {
        const preview = page.text.substring(0, 300).replace(/\n/g, ' ').trim();
        console.log(`   ✅ Found on Page ${page.pageNumber}: "${preview}..."`);
      }
    });

    // Test with page markers
    console.log('\n📋 Testing with page markers...');
    const markedResult = await extractor.extractWithPageMarkers(pdfPath, '--- PAGE {page} ---');
    
    console.log(`   📝 Text with markers length: ${markedResult.text.length}`);
    console.log(`   📄 Pages detected: ${markedResult.numPages}`);
    
    // Show where Joan Mitchell appears in marked text
    const joanIndex = markedResult.text.indexOf('Joan Mitchell');
    if (joanIndex !== -1) {
      const beforeJoan = markedResult.text.substring(Math.max(0, joanIndex - 100), joanIndex);
      const afterJoan = markedResult.text.substring(joanIndex, joanIndex + 100);
      
      console.log(`\n🎯 Joan Mitchell in marked text:`);
      console.log(`   Before: "...${beforeJoan}"`);
      console.log(`   After: "${afterJoan}..."`);
      
      // Check which page marker is before Joan Mitchell
      const textBeforeJoan = markedResult.text.substring(0, joanIndex);
      const pageMarkersBeforeJoan = textBeforeJoan.match(/--- PAGE \d+ ---/g);
      console.log(`   📄 Page markers before Joan: ${pageMarkersBeforeJoan?.length || 0}`);
      if (pageMarkersBeforeJoan && pageMarkersBeforeJoan.length > 0) {
        const lastMarker = pageMarkersBeforeJoan[pageMarkersBeforeJoan.length - 1];
        console.log(`   📍 Last page marker: ${lastMarker}`);
        const pageNum = lastMarker.match(/PAGE (\d+)/)?.[1];
        console.log(`   ✅ Joan Mitchell should be on page: ${pageNum}`);
      }
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
  testPageAwareExtraction().catch(console.error);
}

module.exports = { testPageAwareExtraction };
