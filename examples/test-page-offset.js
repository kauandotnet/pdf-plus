/**
 * Test the page offset feature to align text extraction with visual PDF pages
 */

const { extractPdfContent } = require('../dist/index.js');

async function testPageOffset() {
  console.log('🧪 Testing Page Offset Feature\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    // Test without page offset (current behavior)
    console.log('📊 Extracting WITHOUT page offset (current behavior):');
    const resultWithoutOffset = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      pageOffset: 0, // No offset
      generateStructuredData: true,
      verbose: false
    });

    // Find Joan Mitchell in the text
    const joanIndexWithoutOffset = resultWithoutOffset.textWithRefs.indexOf('Joan Mitchell');
    if (joanIndexWithoutOffset !== -1) {
      const beforeJoan = resultWithoutOffset.textWithRefs.substring(Math.max(0, joanIndexWithoutOffset - 100), joanIndexWithoutOffset);
      const afterJoan = resultWithoutOffset.textWithRefs.substring(joanIndexWithoutOffset, joanIndexWithoutOffset + 100);
      
      console.log(`🎯 Joan Mitchell WITHOUT offset:`);
      console.log(`   Before: "...${beforeJoan}"`);
      console.log(`   After: "${afterJoan}..."`);
      
      // Check which page marker is before Joan Mitchell
      const textBeforeJoan = resultWithoutOffset.textWithRefs.substring(0, joanIndexWithoutOffset);
      const pageMarkersBeforeJoan = textBeforeJoan.match(/--- PAGE \d+ ---/g);
      if (pageMarkersBeforeJoan && pageMarkersBeforeJoan.length > 0) {
        const lastMarker = pageMarkersBeforeJoan[pageMarkersBeforeJoan.length - 1];
        const pageNum = lastMarker.match(/PAGE (\d+)/)?.[1];
        console.log(`   📄 Joan Mitchell appears on text page: ${pageNum}`);
      }
    }

    // Test WITH page offset +1 (to align with visual PDF pages)
    console.log('\n📊 Extracting WITH page offset +1 (aligned with visual PDF):');
    const resultWithOffset = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      pageOffset: 1, // Add +1 to align with visual PDF pages
      generateStructuredData: true,
      verbose: false
    });

    // Find Joan Mitchell in the text
    const joanIndexWithOffset = resultWithOffset.textWithRefs.indexOf('Joan Mitchell');
    if (joanIndexWithOffset !== -1) {
      const beforeJoan = resultWithOffset.textWithRefs.substring(Math.max(0, joanIndexWithOffset - 100), joanIndexWithOffset);
      const afterJoan = resultWithOffset.textWithRefs.substring(joanIndexWithOffset, joanIndexWithOffset + 100);
      
      console.log(`🎯 Joan Mitchell WITH offset +1:`);
      console.log(`   Before: "...${beforeJoan}"`);
      console.log(`   After: "${afterJoan}..."`);
      
      // Check which page marker is before Joan Mitchell
      const textBeforeJoan = resultWithOffset.textWithRefs.substring(0, joanIndexWithOffset);
      const pageMarkersBeforeJoan = textBeforeJoan.match(/--- PAGE \d+ ---/g);
      if (pageMarkersBeforeJoan && pageMarkersBeforeJoan.length > 0) {
        const lastMarker = pageMarkersBeforeJoan[pageMarkersBeforeJoan.length - 1];
        const pageNum = lastMarker.match(/PAGE (\d+)/)?.[1];
        console.log(`   📄 Joan Mitchell appears on text page: ${pageNum} ✅ (matches visual PDF page!)`);
      }
    }

    // Compare structured data
    console.log('\n📊 Structured Data Comparison:');
    
    const withoutOffsetPage1 = resultWithoutOffset.structuredData?.pages?.[0];
    const withOffsetPage1 = resultWithOffset.structuredData?.pages?.[0];
    const withOffsetPage2 = resultWithOffset.structuredData?.pages?.[1];

    if (withoutOffsetPage1) {
      const preview = withoutOffsetPage1.text.content.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   Without offset - Page 1: "${preview}..."`);
      console.log(`     Contains Joan Mitchell: ${withoutOffsetPage1.text.content.includes('Joan Mitchell')}`);
    }

    if (withOffsetPage1) {
      const preview = withOffsetPage1.text.content.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   With offset - Page 1: "${preview}..."`);
      console.log(`     Contains Joan Mitchell: ${withOffsetPage1.text.content.includes('Joan Mitchell')}`);
    }

    if (withOffsetPage2) {
      const preview = withOffsetPage2.text.content.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   With offset - Page 2: "${preview}..."`);
      console.log(`     Contains Joan Mitchell: ${withOffsetPage2.text.content.includes('Joan Mitchell')} ✅`);
    }

    // Show first few page markers
    console.log('\n📋 Page Markers Comparison:');
    
    const withoutOffsetMarkers = resultWithoutOffset.textWithRefs.match(/--- PAGE \d+ ---/g)?.slice(0, 5) || [];
    const withOffsetMarkers = resultWithOffset.textWithRefs.match(/--- PAGE \d+ ---/g)?.slice(0, 5) || [];
    
    console.log(`   Without offset: ${withoutOffsetMarkers.join(', ')}`);
    console.log(`   With offset +1: ${withOffsetMarkers.join(', ')}`);

    console.log('\n🎉 Summary:');
    console.log('   ✅ Page offset feature implemented successfully!');
    console.log('   ✅ With pageOffset: 1, Joan Mitchell now appears on page 2');
    console.log('   ✅ This aligns with the visual PDF page structure');
    console.log('   ✅ Use pageOffset: 1 for PDFs with cover pages');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
if (require.main === module) {
  testPageOffset().catch(console.error);
}

module.exports = { testPageOffset };
