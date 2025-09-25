/**
 * Simple test to understand the page structure issue
 */

const { extractPdfContent } = require('../dist/index.js');

async function simplePageTest() {
  console.log('🔍 Simple Page Structure Test\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    // Extract without page markers first
    console.log('📊 Extracting without page markers...');
    const resultWithoutMarkers = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      includePageMarkers: false,
      generateStructuredData: false,
      verbose: false
    });

    console.log(`   📄 Total pages: ${resultWithoutMarkers.document.pages}`);
    console.log(`   📝 Clean text length: ${resultWithoutMarkers.cleanText.length}`);
    console.log(`   🖼️  Total images: ${resultWithoutMarkers.images.length}`);

    // Show the first 2000 characters of clean text
    console.log('\n📖 First 2000 characters of clean text:');
    console.log(`"${resultWithoutMarkers.cleanText.substring(0, 2000)}..."`);

    // Find where key artists appear in the raw text
    const cleanText = resultWithoutMarkers.cleanText;
    const joanIndex = cleanText.indexOf('Joan Mitchell');
    const helenIndex = cleanText.indexOf('Helen Frankenthaler');
    const louiseIndex = cleanText.indexOf('Louise Nevelson');

    console.log('\n🎯 Artist positions in raw text:');
    console.log(`   Joan Mitchell: character ${joanIndex} (${Math.round(joanIndex / cleanText.length * 100)}% through document)`);
    console.log(`   Helen Frankenthaler: character ${helenIndex} (${Math.round(helenIndex / cleanText.length * 100)}% through document)`);
    console.log(`   Louise Nevelson: character ${louiseIndex} (${Math.round(louiseIndex / cleanText.length * 100)}% through document)`);

    // Show context around Joan Mitchell
    if (joanIndex !== -1) {
      const beforeJoan = cleanText.substring(Math.max(0, joanIndex - 300), joanIndex);
      const afterJoan = cleanText.substring(joanIndex, joanIndex + 300);
      
      console.log(`\n📖 Context around Joan Mitchell:`);
      console.log(`   Before: "...${beforeJoan}"`);
      console.log(`   After: "${afterJoan}..."`);
    }

    // Now extract with page markers
    console.log('\n📊 Extracting with page markers...');
    const resultWithMarkers = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      generateStructuredData: false,
      verbose: false
    });

    // Check if the issue is in the page marker insertion
    const markedText = resultWithMarkers.textWithRefs;
    const joanIndexMarked = markedText.indexOf('Joan Mitchell');
    
    if (joanIndexMarked !== -1) {
      const beforeJoanMarked = markedText.substring(Math.max(0, joanIndexMarked - 200), joanIndexMarked);
      const afterJoanMarked = markedText.substring(joanIndexMarked, joanIndexMarked + 200);
      
      console.log(`\n📖 Joan Mitchell in marked text:`);
      console.log(`   Before: "...${beforeJoanMarked}"`);
      console.log(`   After: "${afterJoanMarked}..."`);
      
      // Count page markers before Joan Mitchell
      const textBeforeJoan = markedText.substring(0, joanIndexMarked);
      const pageMarkers = textBeforeJoan.match(/--- PAGE \d+ ---/g);
      console.log(`   📄 Page markers before Joan: ${pageMarkers?.length || 0}`);
      if (pageMarkers) {
        console.log(`   📍 Page markers: ${pageMarkers.join(', ')}`);
      }
    }

    // Check image page assignments
    console.log('\n🖼️  Image page assignments (first 10):');
    resultWithMarkers.images.slice(0, 10).forEach((img, i) => {
      console.log(`   ${img.id}: Page ${img.page} (${img.name})`);
    });

    // The key question: If Joan Mitchell is visually on page 2, 
    // but text extraction puts it on page 1, then either:
    // 1. There's a cover page with no text that's being skipped
    // 2. The page numbering is off by 1
    // 3. The PDF structure is different than expected

    console.log('\n🤔 Analysis:');
    console.log('   If you see Joan Mitchell on visual page 2 in the PDF,');
    console.log('   but text extraction shows it on page 1, then either:');
    console.log('   1. Page 1 is a cover page with minimal/no text');
    console.log('   2. The PDF page numbering starts from 0 instead of 1');
    console.log('   3. The text extraction is merging multiple visual pages');
    console.log('\n   To fix this, we need to adjust the page numbering offset.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  simplePageTest().catch(console.error);
}

module.exports = { simplePageTest };
