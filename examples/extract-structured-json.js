/**
 * Extract Art Basel PDF with structured JSON output
 * Shows text and images separated by page in JSON format
 */

const { extractPdfContent } = require('../dist/index.js');
const fs = require('fs');

async function extractStructuredJSON() {
  console.log('📊 Extract Art Basel with Structured JSON Output\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    // Test 1: Basic structured JSON output
    console.log('📁 Test 1: Basic structured JSON output');
    const result1 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './structured-json-test1',
      generateStructuredData: true,  // ← Enable structured JSON
      imageRefFormat: '[IMG:{index}]',
      verbose: true
    });

    // Save structured JSON
    if (result1.structuredData) {
      const jsonString = JSON.stringify(result1.structuredData, null, 2);
      fs.writeFileSync('./structured-data-basic.json', jsonString);
      console.log('   ✅ Structured JSON saved to: ./structured-data-basic.json');
    }

    // Test 2: Structured JSON with page markers
    console.log('\n📁 Test 2: Structured JSON with page markers');
    const result2 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './structured-json-test2',
      generateStructuredData: true,
      includePageMarkers: true,
      pageMarkerFormat: '--- PAGE {page} ---',
      imageRefFormat: '🖼️ Image {index} (Page {page})',
      verbose: true
    });

    // Save structured JSON with page markers
    if (result2.structuredData) {
      const jsonString = JSON.stringify(result2.structuredData, null, 2);
      fs.writeFileSync('./structured-data-with-page-markers.json', jsonString);
      console.log('   ✅ Structured JSON with page markers saved to: ./structured-data-with-page-markers.json');
    }

    // Test 3: Custom structured JSON with image paths
    console.log('\n📁 Test 3: Structured JSON with image paths');
    const result3 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './structured-json-test3',
      generateStructuredData: true,
      useImagePaths: true,
      imageRefFormat: '[IMG:{id}] File: {path}',
      verbose: true
    });

    // Save structured JSON with image paths
    if (result3.structuredData) {
      const jsonString = JSON.stringify(result3.structuredData, null, 2);
      fs.writeFileSync('./structured-data-with-paths.json', jsonString);
      console.log('   ✅ Structured JSON with paths saved to: ./structured-data-with-paths.json');
    }

    // Show structured data analysis
    console.log('\n📊 Structured Data Analysis:');
    
    const analyzeStructuredData = (data, label) => {
      if (data && data.structuredData) {
        const sd = data.structuredData;
        console.log(`   ${label}:`);
        console.log(`      📄 Total Pages: ${sd.metadata.totalPages}`);
        console.log(`      📝 Total Text Length: ${sd.metadata.totalTextLength}`);
        console.log(`      🖼️  Total Images: ${sd.metadata.totalImages}`);
        console.log(`      📊 Pages with data: ${sd.pages.length}`);
        
        // Show first few pages
        sd.pages.slice(0, 3).forEach((page, i) => {
          console.log(`         Page ${page.pageNumber}: ${page.text.wordCount} words, ${page.imageCount} images`);
        });
        
        if (sd.pages.length > 3) {
          console.log(`         ... and ${sd.pages.length - 3} more pages`);
        }
      }
    };

    analyzeStructuredData(result1, 'Test 1 - Basic');
    analyzeStructuredData(result2, 'Test 2 - With Page Markers');
    analyzeStructuredData(result3, 'Test 3 - With Image Paths');

    // Show sample page data
    console.log('\n📋 Sample Page Data (Page 1):');
    if (result1.structuredData && result1.structuredData.pages[0]) {
      const page1 = result1.structuredData.pages[0];
      console.log(`   Page Number: ${page1.pageNumber}`);
      console.log(`   Text Preview: "${page1.text.content.substring(0, 100)}..."`);
      console.log(`   Word Count: ${page1.text.wordCount}`);
      console.log(`   Character Count: ${page1.text.characterCount}`);
      console.log(`   Images on Page: ${page1.imageCount}`);
      
      if (page1.images.length > 0) {
        console.log(`   First Image: ${page1.images[0].id} (${page1.images[0].format})`);
      }
    }

    // Show file sizes
    console.log('\n📊 Created JSON Files:');
    const jsonFiles = [
      './structured-data-basic.json',
      './structured-data-with-page-markers.json',
      './structured-data-with-paths.json'
    ];

    for (const file of jsonFiles) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`   📄 ${file}: ${stats.size} bytes`);
      }
    }

    // Show image directories
    console.log('\n📁 Created Image Directories:');
    const imageDirs = [
      './structured-json-test1',
      './structured-json-test2', 
      './structured-json-test3'
    ];

    for (const dir of imageDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log(`   📁 ${dir}: ${files.length} image files`);
      }
    }

    console.log('\n🎉 Structured JSON extraction completed!');
    console.log('💡 Key features:');
    console.log('   - generateStructuredData: true enables JSON output');
    console.log('   - Text and images are separated by page');
    console.log('   - Each page has word count, character count, and image count');
    console.log('   - Metadata includes extraction options and timestamps');
    console.log('   - Perfect for data processing and analysis');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the extraction
if (require.main === module) {
  extractStructuredJSON().catch(console.error);
}

module.exports = { extractStructuredJSON };
