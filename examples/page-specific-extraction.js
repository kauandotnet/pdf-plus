/**
 * Demonstrate page-specific extraction with caching and text items
 * Shows the new API: pdf.getText(page), pdf.getImages(page), pdf.getTextItems(page)
 */

const { extractPdfContent, PDFExtractor } = require('../dist/index.js');
const fs = require('fs');

async function demonstratePageSpecificExtraction() {
  console.log('🎯 Page-Specific PDF Extraction Demo\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    // Create extractor instance with custom cache directory
    const extractor = new PDFExtractor('./tmp/demo-cache');

    console.log('📊 Cache Statistics (before):');
    const statsBefore = extractor.getCacheStats();
    console.log(`   📁 Cached PDFs: ${statsBefore.totalCachedPdfs}`);
    console.log(`   📄 Cached pages: ${statsBefore.totalCachedPages}`);
    console.log(`   💾 Cache size: ${statsBefore.totalCacheSize} bytes`);
    console.log(`   📂 Cache dir: ${statsBefore.cacheDir}\n`);

    // === 1. Get text for page 1 ===
    console.log('📝 Getting text for page 1...');
    const page1Text = await extractor.getText(pdfPath, 1, { 
      verbose: true,
      useCache: true 
    });
    
    console.log(`   📄 Page 1 text (${page1Text.length} chars):`);
    console.log(`   "${page1Text.substring(0, 100)}..."\n`);

    // === 2. Get images for page 1 ===
    console.log('🖼️  Getting images for page 1...');
    const page1Images = await extractor.getImages(pdfPath, 1, { 
      verbose: true,
      extractImageFiles: true,
      imageOutputDir: './page-specific-images',
      useCache: true 
    });
    
    console.log(`   🖼️  Found ${page1Images.length} images on page 1:`);
    page1Images.slice(0, 5).forEach(img => {
      console.log(`     - ${img.id}: ${img.name} (${img.format})`);
    });
    if (page1Images.length > 5) {
      console.log(`     ... and ${page1Images.length - 5} more images`);
    }
    console.log();

    // === 3. Get text items for page 1 ===
    console.log('📝 Getting text items for page 1...');
    const page1TextItems = await extractor.getTextItems(pdfPath, 1, { 
      verbose: true,
      useCache: true 
    });
    
    console.log(`   📝 Found ${page1TextItems.length} text items on page 1:`);
    page1TextItems.slice(0, 5).forEach(item => {
      console.log(`     - ${item.type}: "${item.content.substring(0, 50)}..." (${item.fontSize}px)`);
    });
    if (page1TextItems.length > 5) {
      console.log(`     ... and ${page1TextItems.length - 5} more text items`);
    }
    console.log();

    // === 4. Get complete page data ===
    console.log('📄 Getting complete page 1 data...');
    const page1Complete = await extractor.getPage(pdfPath, 1, { 
      verbose: true,
      extractTextItems: true,
      useCache: true 
    });
    
    console.log(`   📊 Page 1 metadata:`);
    console.log(`     📝 Word count: ${page1Complete.metadata.wordCount}`);
    console.log(`     🔤 Character count: ${page1Complete.metadata.characterCount}`);
    console.log(`     🖼️  Image count: ${page1Complete.metadata.imageCount}`);
    console.log(`     📝 Text items: ${page1Complete.textItems.length}`);
    console.log();

    // === 5. Test caching (second call should be faster) ===
    console.log('⚡ Testing cache performance...');
    const start = Date.now();
    const page1Cached = await extractor.getPage(pdfPath, 1, { 
      verbose: true,
      useCache: true 
    });
    const cacheTime = Date.now() - start;
    
    console.log(`   ⚡ Cached retrieval took ${cacheTime}ms`);
    console.log(`   📋 Cache hit: ${page1Cached.text.length === page1Complete.text.length ? 'YES' : 'NO'}\n`);

    // === 6. Extract with new structured JSON format ===
    console.log('📊 Extracting with structured JSON and text items...');
    const structuredResult = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractTextItems: true,
      generateStructuredData: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      imageRefFormat: '[IMG:{id}] {name}',
      verbose: true
    });

    // Save structured data with text items
    const structuredData = {
      metadata: structuredResult.document,
      pages: structuredResult.structuredData?.pages || [],
      textItems: structuredResult.textItems,
      summary: {
        totalTextItems: structuredResult.textItems.length,
        textItemsByType: structuredResult.textItems.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {}),
        averageFontSize: structuredResult.textItems.length > 0 
          ? Math.round(structuredResult.textItems.reduce((sum, item) => sum + (item.fontSize || 12), 0) / structuredResult.textItems.length)
          : 0
      }
    };

    fs.writeFileSync('./structured-with-text-items.json', JSON.stringify(structuredData, null, 2));
    console.log(`   💾 Saved structured data with text items: structured-with-text-items.json`);
    console.log(`   📊 Total text items: ${structuredData.summary.totalTextItems}`);
    console.log(`   📝 Text items by type:`, structuredData.summary.textItemsByType);
    console.log(`   📏 Average font size: ${structuredData.summary.averageFontSize}px\n`);

    // === 7. Cache statistics after processing ===
    console.log('📊 Cache Statistics (after):');
    const statsAfter = extractor.getCacheStats();
    console.log(`   📁 Cached PDFs: ${statsAfter.totalCachedPdfs}`);
    console.log(`   📄 Cached pages: ${statsAfter.totalCachedPages}`);
    console.log(`   💾 Cache size: ${statsAfter.totalCacheSize} bytes`);
    console.log(`   📈 Cache growth: +${statsAfter.totalCacheSize - statsBefore.totalCacheSize} bytes\n`);

    // === 8. Demonstrate API usage patterns ===
    console.log('💡 API Usage Examples:');
    console.log('   📝 Get text only: await extractor.getText(pdfPath, 1)');
    console.log('   🖼️  Get images only: await extractor.getImages(pdfPath, 1)');
    console.log('   📝 Get text items: await extractor.getTextItems(pdfPath, 1)');
    console.log('   📄 Get everything: await extractor.getPage(pdfPath, 1)');
    console.log('   🗑️  Clear cache: extractor.clearCache(pdfPath)');
    console.log('   📊 Cache stats: extractor.getCacheStats()');

    console.log('\n🎉 Page-specific extraction demo completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the demo
if (require.main === module) {
  demonstratePageSpecificExtraction().catch(console.error);
}

module.exports = { demonstratePageSpecificExtraction };
