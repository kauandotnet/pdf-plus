/**
 * Test PDF.js page-by-page extraction to fix page alignment
 */

const { PDFJSPageExtractor } = require('../dist/extractors/pdfjs-page-extractor.js');

async function testPDFJSExtraction() {
  console.log('🧪 Testing PDF.js Page-by-Page Extraction\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    const extractor = new PDFJSPageExtractor();
    
    console.log('🔍 Extracting with PDF.js page-by-page method...\n');
    
    const result = await extractor.extractPageByPage(pdfPath);
    
    console.log('📊 Results:');
    console.log(`   📄 Total pages: ${result.totalPages}`);
    console.log(`   📝 Full text length: ${result.fullText.length}`);
    console.log(`   📊 Extracted pages: ${result.pages.length}`);

    // Show first 10 pages content
    console.log('\n📖 First 10 pages content:');
    result.pages.slice(0, 10).forEach((page) => {
      const preview = page.text.substring(0, 100).replace(/\n/g, ' ').trim();
      console.log(`   Page ${page.pageNumber}: "${preview}..." (${page.wordCount} words, ${page.characterCount} chars)`);
    });

    // Look for key artists specifically
    console.log('\n🎯 Looking for key artists:');
    
    const artists = ['Joan Mitchell', 'Helen Frankenthaler', 'Louise Nevelson', 'Agnes Martin', 'Mark Rothko'];
    
    artists.forEach(artist => {
      console.log(`\n🎨 ${artist}:`);
      result.pages.forEach((page) => {
        if (page.text.includes(artist)) {
          const preview = page.text.substring(0, 200).replace(/\n/g, ' ').trim();
          console.log(`   ✅ Found on Page ${page.pageNumber}: "${preview}..."`);
        }
      });
    });

    // Test with page markers
    console.log('\n📋 Testing with page markers...');
    const markedResult = await extractor.extractWithPageMarkers(pdfPath, '--- PAGE {page} ---');
    
    console.log(`   📝 Text with markers length: ${markedResult.text.length}`);
    console.log(`   📄 Pages detected: ${markedResult.numPages}`);
    
    // Show where Joan Mitchell appears in marked text
    const joanIndex = markedResult.text.indexOf('Joan Mitchell');
    if (joanIndex !== -1) {
      const beforeJoan = markedResult.text.substring(Math.max(0, joanIndex - 150), joanIndex);
      const afterJoan = markedResult.text.substring(joanIndex, joanIndex + 150);
      
      console.log(`\n🎯 Joan Mitchell in PDF.js marked text:`);
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
        console.log(`   ✅ Joan Mitchell is on PDF.js page: ${pageNum}`);
      }
    }

    // Test detailed page info for first few pages
    console.log('\n📋 Testing detailed page info...');
    for (let pageNum = 1; pageNum <= Math.min(5, result.totalPages); pageNum++) {
      try {
        const detailedInfo = await extractor.extractDetailedPageInfo(pdfPath, pageNum);
        if (detailedInfo) {
          console.log(`   Page ${pageNum}: ${detailedInfo.textItems.length} text items, ${detailedInfo.dimensions.width}x${detailedInfo.dimensions.height}px`);
          
          // Show first few text items
          const firstItems = detailedInfo.textItems.slice(0, 3);
          firstItems.forEach((item, i) => {
            console.log(`     Item ${i + 1}: "${item.text}" at (${Math.round(item.x)}, ${Math.round(item.y)})`);
          });
        }
      } catch (error) {
        console.log(`   Page ${pageNum}: Error - ${error.message}`);
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
  testPDFJSExtraction().catch(console.error);
}

module.exports = { testPDFJSExtraction };
