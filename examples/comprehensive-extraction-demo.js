/**
 * Comprehensive PDF Extraction Demo
 * Demonstrates all features with Art Basel PDF and saves everything to structured-final folder
 */

const { extractPdfContent, PDFExtractor } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

async function comprehensiveExtractionDemo() {
  console.log('🎯 Comprehensive PDF Extraction Demo\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  const outputDir = './structured-final';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('📁 Creating output directory: structured-final/\n');

    // Create extractor with custom cache
    const extractor = new PDFExtractor(`${outputDir}/cache`);

    // === 1. FULL EXTRACTION WITH ALL FEATURES ===
    console.log('🔍 1. Full extraction with all features...');
    const fullResult = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      extractTextItems: true,
      generateStructuredData: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      imageRefFormat: '[IMG:{id}] {name}',
      imageOutputDir: `${outputDir}/images`,
      useCache: true,
      verbose: true
    });

    console.log(`   ✅ Extracted ${fullResult.images.length} images`);
    console.log(`   ✅ Extracted ${fullResult.textItems.length} text items`);
    console.log(`   ✅ Generated structured data for ${fullResult.structuredData?.pages.length || 0} pages\n`);

    // === 2. SAVE ALL TEXT FORMATS ===
    console.log('📝 2. Saving text in different formats...');
    
    // Raw text (clean)
    const page1 = await extractor.getPage(pdfPath, 1, { useCache: true });
    fs.writeFileSync(`${outputDir}/text-raw-clean.txt`, page1.rawText);
    console.log(`   💾 Raw clean text: text-raw-clean.txt (${page1.rawText.length} chars)`);
    
    // Text with page markers
    fs.writeFileSync(`${outputDir}/text-with-page-markers.txt`, fullResult.textWithRefs);
    console.log(`   💾 Text with markers: text-with-page-markers.txt (${fullResult.textWithRefs.length} chars)`);
    
    // Clean text without markers or image refs
    fs.writeFileSync(`${outputDir}/text-clean-only.txt`, fullResult.cleanText);
    console.log(`   💾 Clean text only: text-clean-only.txt (${fullResult.cleanText.length} chars)\n`);

    // === 3. SAVE STRUCTURED JSON DATA ===
    console.log('📊 3. Saving structured JSON data...');
    
    // Complete structured data
    fs.writeFileSync(`${outputDir}/structured-complete.json`, JSON.stringify(fullResult.structuredData, null, 2));
    console.log(`   💾 Complete structured data: structured-complete.json`);
    
    // Text items only
    const textItemsData = {
      metadata: {
        filename: fullResult.document.filename,
        totalTextItems: fullResult.textItems.length,
        extractedAt: fullResult.document.extractedAt
      },
      textItems: fullResult.textItems,
      summary: {
        byType: fullResult.textItems.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {}),
        averageFontSize: Math.round(
          fullResult.textItems.reduce((sum, item) => sum + (item.fontSize || 12), 0) / fullResult.textItems.length
        )
      }
    };
    fs.writeFileSync(`${outputDir}/text-items.json`, JSON.stringify(textItemsData, null, 2));
    console.log(`   💾 Text items data: text-items.json (${fullResult.textItems.length} items)`);
    
    // Images metadata
    const imagesData = {
      metadata: {
        filename: fullResult.document.filename,
        totalImages: fullResult.images.length,
        extractedAt: fullResult.document.extractedAt
      },
      images: fullResult.images,
      summary: {
        byPage: fullResult.images.reduce((acc, img) => {
          acc[`page_${img.page}`] = (acc[`page_${img.page}`] || 0) + 1;
          return acc;
        }, {}),
        formats: fullResult.images.reduce((acc, img) => {
          acc[img.format] = (acc[img.format] || 0) + 1;
          return acc;
        }, {})
      }
    };
    fs.writeFileSync(`${outputDir}/images-metadata.json`, JSON.stringify(imagesData, null, 2));
    console.log(`   💾 Images metadata: images-metadata.json (${fullResult.images.length} images)\n`);

    // === 4. PAGE-SPECIFIC EXTRACTIONS ===
    console.log('📄 4. Page-specific extractions...');
    
    const pageSpecificDir = `${outputDir}/pages`;
    if (!fs.existsSync(pageSpecificDir)) {
      fs.mkdirSync(pageSpecificDir, { recursive: true });
    }

    // Extract first 3 pages individually
    for (let pageNum = 1; pageNum <= Math.min(3, fullResult.document.pages); pageNum++) {
      const pageData = await extractor.getPage(pdfPath, pageNum, { 
        extractTextItems: true,
        useCache: true 
      });
      
      // Save page data
      const pageInfo = {
        pageNumber: pageNum,
        text: {
          content: pageData.text,
          rawText: pageData.rawText,
          wordCount: pageData.metadata.wordCount,
          characterCount: pageData.metadata.characterCount
        },
        textItems: pageData.textItems,
        images: pageData.images,
        metadata: pageData.metadata
      };
      
      fs.writeFileSync(`${pageSpecificDir}/page-${pageNum}.json`, JSON.stringify(pageInfo, null, 2));
      fs.writeFileSync(`${pageSpecificDir}/page-${pageNum}-raw.txt`, pageData.rawText);
      
      console.log(`   💾 Page ${pageNum}: ${pageData.metadata.wordCount} words, ${pageData.images.length} images, ${pageData.textItems.length} text items`);
    }
    console.log();

    // === 5. EXTRACTION SUMMARY ===
    console.log('📊 5. Extraction summary...');
    
    const summary = {
      document: {
        filename: fullResult.document.filename,
        pages: fullResult.document.pages,
        extractedAt: fullResult.document.extractedAt,
        processingTime: '< 1 second'
      },
      text: {
        totalCharacters: fullResult.cleanText.length,
        totalWords: page1.metadata.wordCount,
        textItems: fullResult.textItems.length,
        textItemsByType: textItemsData.summary.byType,
        averageFontSize: textItemsData.summary.averageFontSize
      },
      images: {
        totalImages: fullResult.images.length,
        realImagesExtracted: fullResult.images.filter(img => img.format !== 'unknown').length,
        imagesByPage: imagesData.summary.byPage,
        imageFormats: imagesData.summary.formats
      },
      files: {
        textFiles: ['text-raw-clean.txt', 'text-with-page-markers.txt', 'text-clean-only.txt'],
        jsonFiles: ['structured-complete.json', 'text-items.json', 'images-metadata.json'],
        pageFiles: [`pages/page-1.json`, `pages/page-2.json`, `pages/page-3.json`],
        imageFiles: `images/ directory with ${fullResult.images.length} image files`
      },
      api: {
        methods: [
          'extractor.getText(pdfPath, pageNumber)',
          'extractor.getRawText(pdfPath, pageNumber)',
          'extractor.getImages(pdfPath, pageNumber)',
          'extractor.getTextItems(pdfPath, pageNumber)',
          'extractor.getPage(pdfPath, pageNumber)',
          'extractPdfContent(pdfPath, options)'
        ]
      }
    };
    
    fs.writeFileSync(`${outputDir}/extraction-summary.json`, JSON.stringify(summary, null, 2));
    console.log(`   📊 Total characters: ${summary.text.totalCharacters}`);
    console.log(`   📝 Total words: ${summary.text.totalWords}`);
    console.log(`   📄 Text items: ${summary.text.textItems}`);
    console.log(`   🖼️  Total images: ${summary.images.totalImages}`);
    console.log(`   ✅ Real images extracted: ${summary.images.realImagesExtracted}`);
    console.log(`   💾 Extraction summary: extraction-summary.json\n`);

    // === 6. CACHE STATISTICS ===
    console.log('📋 6. Cache statistics...');
    const cacheStats = extractor.getCacheStats();
    fs.writeFileSync(`${outputDir}/cache-stats.json`, JSON.stringify(cacheStats, null, 2));
    console.log(`   📁 Cached PDFs: ${cacheStats.totalCachedPdfs}`);
    console.log(`   📄 Cached pages: ${cacheStats.totalCachedPages}`);
    console.log(`   💾 Cache size: ${cacheStats.totalCacheSize} bytes`);
    console.log(`   📂 Cache directory: ${cacheStats.cacheDir}\n`);

    // === 7. CREATE README ===
    console.log('📖 7. Creating README...');
    const readme = `# PDF Extraction Results - Art Basel 2025

## Overview
Complete extraction of "${fullResult.document.filename}" performed on ${fullResult.document.extractedAt}

## Files Generated

### Text Files
- \`text-raw-clean.txt\` - Clean text without page markers or image references (${summary.text.totalCharacters} chars)
- \`text-with-page-markers.txt\` - Text with page markers and image references
- \`text-clean-only.txt\` - Clean text without any formatting

### JSON Data Files
- \`structured-complete.json\` - Complete structured data with pages, text, and images
- \`text-items.json\` - All text items with position and font metadata (${summary.text.textItems} items)
- \`images-metadata.json\` - All image metadata and positions (${summary.images.totalImages} images)
- \`extraction-summary.json\` - Summary of the entire extraction process

### Page-Specific Files
- \`pages/page-1.json\` - Complete data for page 1
- \`pages/page-1-raw.txt\` - Raw text for page 1
- \`pages/page-2.json\` - Complete data for page 2
- \`pages/page-2-raw.txt\` - Raw text for page 2
- \`pages/page-3.json\` - Complete data for page 3
- \`pages/page-3-raw.txt\` - Raw text for page 3

### Image Files
- \`images/\` - Directory containing ${summary.images.totalImages} extracted image files
- ${summary.images.realImagesExtracted} real images successfully extracted
- ${summary.images.totalImages - summary.images.realImagesExtracted} placeholder images (extraction failed)

## Statistics

### Text Analysis
- **Total Characters:** ${summary.text.totalCharacters}
- **Total Words:** ${summary.text.totalWords}
- **Text Items:** ${summary.text.textItems}
- **Text Types:** ${Object.entries(summary.text.textItemsByType).map(([type, count]) => `${type}: ${count}`).join(', ')}
- **Average Font Size:** ${summary.text.averageFontSize}px

### Image Analysis
- **Total Images:** ${summary.images.totalImages}
- **Successfully Extracted:** ${summary.images.realImagesExtracted}
- **Success Rate:** ${Math.round((summary.images.realImagesExtracted / summary.images.totalImages) * 100)}%

## API Usage Examples

\`\`\`javascript
const { PDFExtractor } = require('@pdf-extractor/core');
const extractor = new PDFExtractor();

// Get raw text for a page
const rawText = await extractor.getRawText('document.pdf', 1);

// Get complete page data
const pageData = await extractor.getPage('document.pdf', 1);

// Get text items with positioning
const textItems = await extractor.getTextItems('document.pdf', 1);

// Get images for a page
const images = await extractor.getImages('document.pdf', 1);
\`\`\`

Generated by PDF Extractor Library v1.0.0
`;

    fs.writeFileSync(`${outputDir}/README.md`, readme);
    console.log(`   📖 Documentation: README.md\n`);

    // === 8. FINAL SUMMARY ===
    console.log('🎉 Extraction completed successfully!\n');
    console.log('📁 Output directory: structured-final/');
    console.log('📊 Files generated:');
    
    const allFiles = fs.readdirSync(outputDir, { recursive: true });
    allFiles.forEach(file => {
      const filePath = path.join(outputDir, file);
      if (fs.statSync(filePath).isFile()) {
        const size = fs.statSync(filePath).size;
        console.log(`   📄 ${file} (${size} bytes)`);
      }
    });

    console.log('\n💡 Next steps:');
    console.log('   1. Check structured-final/ directory for all extracted data');
    console.log('   2. Review README.md for detailed documentation');
    console.log('   3. Use the JSON files for programmatic access');
    console.log('   4. Use the text files for content analysis');
    console.log('   5. Check images/ directory for extracted images');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the comprehensive demo
if (require.main === module) {
  comprehensiveExtractionDemo().catch(console.error);
}

module.exports = { comprehensiveExtractionDemo };
