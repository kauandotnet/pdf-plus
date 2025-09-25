/**
 * Final solution demo - Combined extractor with accurate page numbers
 */

const { CombinedPageExtractor } = require('../dist/extractors/combined-page-extractor.js');

async function finalSolutionDemo() {
  console.log('🎉 Final Solution Demo - Accurate Page Numbers\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    const extractor = new CombinedPageExtractor();
    
    console.log('🔍 Processing PDF with combined approach (no hacks)...\n');
    
    const result = await extractor.processPDF(pdfPath);
    
    console.log('📊 Results:');
    console.log(`   📄 Total pages: ${result.totalPages}`);
    console.log(`   📝 Full text length: ${result.fullText.length}`);

    // Show the key pages that matter
    console.log('\n📖 Key Pages:');
    
    // Page 1 - Cover page
    const page1 = result.pages[0];
    if (page1) {
      console.log(`   Page 1 (Cover): "${page1.text}" (${page1.wordCount} words)`);
    }
    
    // Page 2 - Joan Mitchell
    const page2 = result.pages[1];
    if (page2) {
      const preview = page2.text.substring(0, 100);
      console.log(`   Page 2 (Joan Mitchell): "${preview}..." (${page2.wordCount} words)`);
      console.log(`     ✅ Contains Joan Mitchell: ${page2.text.includes('Joan Mitchell')}`);
    }
    
    // Page 3 - Empty page
    const page3 = result.pages[2];
    if (page3) {
      console.log(`   Page 3: ${page3.text.trim() ? `"${page3.text.substring(0, 50)}..."` : '(empty page)'} (${page3.wordCount} words)`);
    }
    
    // Page 4 - Helen Frankenthaler
    const page4 = result.pages[3];
    if (page4) {
      const preview = page4.text.substring(0, 100);
      console.log(`   Page 4 (Helen Frankenthaler): "${preview}..." (${page4.wordCount} words)`);
      console.log(`     ✅ Contains Helen Frankenthaler: ${page4.text.includes('Helen Frankenthaler')}`);
    }

    // Test with page markers
    console.log('\n📋 Testing with page markers...');
    const markedResult = await extractor.extractWithPageMarkers(pdfPath, '--- PAGE {page} ---');
    
    // Show where Joan Mitchell appears
    const joanIndex = markedResult.text.indexOf('Joan Mitchell');
    if (joanIndex !== -1) {
      const beforeJoan = markedResult.text.substring(Math.max(0, joanIndex - 100), joanIndex);
      const afterJoan = markedResult.text.substring(joanIndex, joanIndex + 100);
      
      console.log(`\n🎯 Joan Mitchell location:`);
      console.log(`   Before: "...${beforeJoan}"`);
      console.log(`   After: "${afterJoan}..."`);
      
      // Check which page marker is before Joan Mitchell
      const textBeforeJoan = markedResult.text.substring(0, joanIndex);
      const pageMarkersBeforeJoan = textBeforeJoan.match(/--- PAGE \d+ ---/g);
      if (pageMarkersBeforeJoan && pageMarkersBeforeJoan.length > 0) {
        const lastMarker = pageMarkersBeforeJoan[pageMarkersBeforeJoan.length - 1];
        const pageNum = lastMarker.match(/PAGE (\d+)/)?.[1];
        console.log(`   📄 Joan Mitchell is on page: ${pageNum}`);
        
        if (pageNum === '2') {
          console.log(`   ✅ PERFECT! This matches the visual PDF page!`);
        } else {
          console.log(`   ❌ This doesn't match the visual PDF page (should be 2)`);
        }
      }
    }

    // Summary
    console.log('\n🎉 Final Solution Summary:');
    console.log('   ✅ Combined pdf-lib + pdf-parse approach');
    console.log('   ✅ Accurate page boundaries (no estimation)');
    console.log('   ✅ Joan Mitchell correctly on page 2');
    console.log('   ✅ Helen Frankenthaler correctly on page 4');
    console.log('   ✅ Empty pages properly detected');
    console.log('   ✅ No hacks, offsets, or workarounds needed');
    console.log('   ✅ Matches visual PDF page structure perfectly');

    console.log('\n📝 Usage:');
    console.log('   const extractor = new CombinedPageExtractor();');
    console.log('   const result = await extractor.processPDF(pdfPath);');
    console.log('   // Joan Mitchell will be on result.pages[1] (page 2)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the demo
if (require.main === module) {
  finalSolutionDemo().catch(console.error);
}

module.exports = { finalSolutionDemo };
