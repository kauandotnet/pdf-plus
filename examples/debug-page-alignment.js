/**
 * Debug page alignment between text and images
 */

const { extractPdfContent } = require('../dist/index.js');
const { PageAwareTextExtractor } = require('../dist/extractors/page-aware-text-extractor.js');

async function debugPageAlignment() {
  console.log('🔍 Debug Page Alignment Between Text and Images\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  try {
    // 1. Get current extraction results
    console.log('📊 Current extraction (with page markers):');
    const currentResult = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      generateStructuredData: true,
      verbose: false
    });

    console.log(`   📄 Total pages: ${currentResult.document.pages}`);
    console.log(`   🖼️  Total images: ${currentResult.images.length}`);
    console.log(`   📊 Structured pages: ${currentResult.structuredData?.pages?.length || 0}`);

    // 2. Get page-aware extraction
    console.log('\n📊 Page-aware extraction:');
    const pageAwareExtractor = new PageAwareTextExtractor();
    const pageAwareResult = await pageAwareExtractor.extractWithAccuratePages(pdfPath);

    console.log(`   📄 Total pages: ${pageAwareResult.totalPages}`);
    console.log(`   📖 Extracted pages: ${pageAwareResult.pages.length}`);

    // 3. Compare first few pages
    console.log('\n📖 Page Content Comparison:');
    
    for (let i = 0; i < Math.min(5, pageAwareResult.pages.length); i++) {
      const pageNum = i + 1;
      const pageAwarePage = pageAwareResult.pages[i];
      const structuredPage = currentResult.structuredData?.pages?.[i];
      
      console.log(`\n--- PAGE ${pageNum} COMPARISON ---`);
      
      // Page-aware content
      const pageAwarePreview = pageAwarePage.text.substring(0, 200).replace(/\n/g, ' ').trim();
      console.log(`📖 Page-aware: "${pageAwarePreview}..."`);
      
      // Structured content
      if (structuredPage) {
        const structuredPreview = structuredPage.text.content.substring(0, 200).replace(/\n/g, ' ').trim();
        console.log(`📊 Structured: "${structuredPreview}..."`);
      }
      
      // Images on this page
      const imagesOnPage = currentResult.images.filter(img => img.page === pageNum);
      console.log(`🖼️  Images: ${imagesOnPage.length} (${imagesOnPage.map(img => img.name).join(', ')})`);
      
      // Check for key content
      const hasJoanMitchell = pageAwarePage.text.includes('Joan Mitchell');
      const hasHelenFrankenthaler = pageAwarePage.text.includes('Helen Frankenthaler');
      const hasLouiseNevelson = pageAwarePage.text.includes('Louise Nevelson');
      
      if (hasJoanMitchell) console.log(`   ✅ Contains: Joan Mitchell`);
      if (hasHelenFrankenthaler) console.log(`   ✅ Contains: Helen Frankenthaler`);
      if (hasLouiseNevelson) console.log(`   ✅ Contains: Louise Nevelson`);
    }

    // 4. Analyze image page assignments
    console.log('\n🖼️  Image Page Analysis:');
    const imagesByPage = {};
    currentResult.images.forEach(img => {
      if (!imagesByPage[img.page]) {
        imagesByPage[img.page] = [];
      }
      imagesByPage[img.page].push(img);
    });

    Object.keys(imagesByPage).slice(0, 10).forEach(pageNum => {
      const images = imagesByPage[pageNum];
      console.log(`   Page ${pageNum}: ${images.length} images (${images.map(img => img.name).join(', ')})`);
    });

    // 5. Check what's on the actual first few PDF pages
    console.log('\n📄 PDF Page Structure Analysis:');
    
    // Look at the raw text to understand the structure
    const lines = pageAwareResult.fullText.split('\n');
    console.log(`   📝 Total lines in PDF: ${lines.length}`);
    
    // Find key markers
    const joanLine = lines.findIndex(line => line.includes('Joan Mitchell'));
    const helenLine = lines.findIndex(line => line.includes('Helen Frankenthaler'));
    const louiseLine = lines.findIndex(line => line.includes('Louise Nevelson'));
    
    console.log(`   🎯 Joan Mitchell at line: ${joanLine} (${Math.round(joanLine / lines.length * 100)}% through document)`);
    console.log(`   🎯 Helen Frankenthaler at line: ${helenLine} (${Math.round(helenLine / lines.length * 100)}% through document)`);
    console.log(`   🎯 Louise Nevelson at line: ${louiseLine} (${Math.round(louiseLine / lines.length * 100)}% through document)`);

    // 6. Show the actual page break logic
    console.log('\n📊 Page Break Analysis:');
    const avgLinesPerPage = Math.ceil(lines.length / pageAwareResult.totalPages);
    console.log(`   📏 Average lines per page: ${avgLinesPerPage}`);
    console.log(`   📄 Expected page breaks at lines: ${Array.from({length: pageAwareResult.totalPages - 1}, (_, i) => (i + 1) * avgLinesPerPage).join(', ')}`);

    // Show where Joan Mitchell falls in this breakdown
    const joanExpectedPage = Math.ceil(joanLine / avgLinesPerPage);
    console.log(`   🎯 Joan Mitchell expected on page: ${joanExpectedPage} (line ${joanLine})`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the debug
if (require.main === module) {
  debugPageAlignment().catch(console.error);
}

module.exports = { debugPageAlignment };
