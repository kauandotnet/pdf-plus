/**
 * Test the raw text fix - should have NO page markers
 */

const { extractPdfContent } = require('../dist/index.js');

async function testRawTextFix() {
  console.log('🧪 Testing Raw Text Fix\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    console.log('🔍 Extracting with page markers enabled...\n');
    
    const result = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: false,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      verbose: false
    });

    console.log('📊 Results:');
    console.log(`   📝 Clean text length: ${result.cleanText.length} characters`);
    console.log(`   📝 Text with refs length: ${result.textWithRefs.length} characters`);

    // Check first 200 characters of each
    console.log('\n📖 First 200 characters of cleanText:');
    console.log(`"${result.cleanText.substring(0, 200)}..."`);
    
    console.log('\n📖 First 200 characters of textWithRefs:');
    console.log(`"${result.textWithRefs.substring(0, 200)}..."`);

    // Check if cleanText has page markers
    const hasPageMarkers = result.cleanText.includes('--- PAGE');
    const hasPageMarkersInRefs = result.textWithRefs.includes('--- PAGE');

    console.log('\n🔍 Analysis:');
    console.log(`   ✅ cleanText has page markers: ${hasPageMarkers ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
    console.log(`   ✅ textWithRefs has page markers: ${hasPageMarkersInRefs ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);

    if (!hasPageMarkers && hasPageMarkersInRefs) {
      console.log('\n🎉 SUCCESS! Raw text fix is working correctly!');
      console.log('   ✅ cleanText is truly clean (no page markers)');
      console.log('   ✅ textWithRefs has page markers as expected');
    } else {
      console.log('\n❌ ISSUE! Raw text fix needs more work:');
      if (hasPageMarkers) {
        console.log('   ❌ cleanText still has page markers');
      }
      if (!hasPageMarkersInRefs) {
        console.log('   ❌ textWithRefs missing page markers');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testRawTextFix().catch(console.error);
}

module.exports = { testRawTextFix };
