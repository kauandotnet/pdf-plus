/**
 * Debug page splitting to see what's happening
 */

const { extractPdfContent } = require('../dist/index.js');

async function debugPageSplitting() {
  console.log('🔍 Debug Page Splitting\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    const result = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      generateStructuredData: true,
      verbose: false
    });

    console.log('📊 Basic Info:');
    console.log(`   📄 Total pages: ${result.document.pages}`);
    console.log(`   📝 Clean text length: ${result.cleanText.length}`);
    console.log(`   📝 Text with refs length: ${result.textWithRefs.length}`);
    console.log(`   🖼️  Total images: ${result.images.length}`);
    console.log(`   📊 Structured pages: ${result.structuredData?.pages?.length || 0}`);

    // Show first few page markers in textWithRefs
    console.log('\n📖 First 1000 characters of textWithRefs:');
    console.log(`"${result.textWithRefs.substring(0, 1000)}..."`);

    // Check page markers
    const pageMarkers = result.textWithRefs.match(/--- PAGE \d+ ---/g);
    console.log(`\n🔍 Found ${pageMarkers?.length || 0} page markers:`);
    if (pageMarkers) {
      pageMarkers.slice(0, 10).forEach((marker, i) => {
        console.log(`   ${i + 1}. ${marker}`);
      });
    }

    // Check structured data pages
    if (result.structuredData?.pages) {
      console.log(`\n📊 Structured Data Pages (first 5):`);
      result.structuredData.pages.slice(0, 5).forEach((page, i) => {
        console.log(`   Page ${page.pageNumber}: ${page.text.content.substring(0, 100).replace(/\n/g, ' ')}...`);
        console.log(`     Images: ${page.images.length}, Words: ${page.metadata.wordCount}`);
      });
    }

    // Check where Joan Mitchell appears
    const joanIndex = result.textWithRefs.indexOf('Joan Mitchell');
    if (joanIndex !== -1) {
      const beforeJoan = result.textWithRefs.substring(Math.max(0, joanIndex - 200), joanIndex);
      const afterJoan = result.textWithRefs.substring(joanIndex, joanIndex + 200);
      
      console.log(`\n🎯 Joan Mitchell found at position ${joanIndex}:`);
      console.log(`Before: "...${beforeJoan}"`);
      console.log(`After: "${afterJoan}..."`);
      
      // Check which page marker is before Joan Mitchell
      const textBeforeJoan = result.textWithRefs.substring(0, joanIndex);
      const pageMarkersBeforeJoan = textBeforeJoan.match(/--- PAGE \d+ ---/g);
      console.log(`Page markers before Joan Mitchell: ${pageMarkersBeforeJoan?.length || 0}`);
      if (pageMarkersBeforeJoan) {
        console.log(`Last page marker: ${pageMarkersBeforeJoan[pageMarkersBeforeJoan.length - 1]}`);
      }
    }

    // Check image page assignments
    console.log(`\n🖼️  Image page assignments (first 10):`);
    result.images.slice(0, 10).forEach((img, i) => {
      console.log(`   ${img.id}: Page ${img.page} (${img.name})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the debug
if (require.main === module) {
  debugPageSplitting().catch(console.error);
}

module.exports = { debugPageSplitting };
