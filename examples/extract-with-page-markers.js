/**
 * Extract Art Basel PDF with page markers in text
 * Shows how to add page references to the extracted text
 */

const { extractPdfContent } = require('../dist/index.js');
const fs = require('fs');

async function extractWithPageMarkers() {
  console.log('📄 Extract Art Basel with Page Markers in Text\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    // Test 1: Default page markers
    console.log('📁 Test 1: Default page markers (--- PAGE {page} ---)');
    const result1 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './page-markers-test1',
      includePageMarkers: true,  // ← Enable page markers
      imageRefFormat: '[IMG:{index}]',
      verbose: true
    });

    // Save text with page markers
    if (result1.textWithRefs) {
      fs.writeFileSync('./text-with-page-markers-test1.txt', result1.textWithRefs);
      console.log('   ✅ Text with page markers saved to: ./text-with-page-markers-test1.txt');
    }

    // Test 2: Custom page markers
    console.log('\n📁 Test 2: Custom page markers (🎨 ART BASEL PAGE {page} 🎨)');
    const result2 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './page-markers-test2',
      includePageMarkers: true,
      pageMarkerFormat: '🎨 ART BASEL PAGE {page} 🎨',  // ← Custom format
      imageRefFormat: '🖼️ Image {index} (Page {page})',
      verbose: true
    });

    // Save text with custom page markers
    if (result2.textWithRefs) {
      fs.writeFileSync('./text-with-page-markers-test2.txt', result2.textWithRefs);
      console.log('   ✅ Text with custom page markers saved to: ./text-with-page-markers-test2.txt');
    }

    // Test 3: Simple page markers
    console.log('\n📁 Test 3: Simple page markers (PAGE {page})');
    const result3 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './page-markers-test3',
      includePageMarkers: true,
      pageMarkerFormat: 'PAGE {page}',  // ← Simple format
      imageRefFormat: 'IMG_{index}',
      verbose: true
    });

    // Save text with simple page markers
    if (result3.textWithRefs) {
      fs.writeFileSync('./text-with-page-markers-test3.txt', result3.textWithRefs);
      console.log('   ✅ Text with simple page markers saved to: ./text-with-page-markers-test3.txt');
    }

    // Test 4: No page markers (for comparison)
    console.log('\n📁 Test 4: No page markers (for comparison)');
    const result4 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './page-markers-test4',
      includePageMarkers: false,  // ← Disabled
      imageRefFormat: '[IMG:{index}]',
      verbose: true
    });

    // Save text without page markers
    if (result4.textWithRefs) {
      fs.writeFileSync('./text-without-page-markers.txt', result4.textWithRefs);
      console.log('   ✅ Text without page markers saved to: ./text-without-page-markers.txt');
    }

    // Show comparison of page marker formats
    console.log('\n📊 Comparison of Page Marker Formats:');
    
    const showPageMarkers = (text, label) => {
      if (text) {
        const pageMarkers = text.match(/--- PAGE \d+ ---|🎨 ART BASEL PAGE \d+ 🎨|PAGE \d+/g) || [];
        console.log(`   ${label}:`);
        pageMarkers.forEach((marker, i) => {
          console.log(`      ${i + 1}. ${marker}`);
        });
        if (pageMarkers.length === 0) {
          console.log(`      No page markers found`);
        }
      }
    };

    showPageMarkers(result1.textWithRefs, 'Format 1 - Default (--- PAGE {page} ---)');
    showPageMarkers(result2.textWithRefs, 'Format 2 - Custom (🎨 ART BASEL PAGE {page} 🎨)');
    showPageMarkers(result3.textWithRefs, 'Format 3 - Simple (PAGE {page})');
    showPageMarkers(result4.textWithRefs, 'Format 4 - No page markers');

    // Show file sizes
    console.log('\n📊 Created Text Files:');
    const textFiles = [
      './text-with-page-markers-test1.txt',
      './text-with-page-markers-test2.txt',
      './text-with-page-markers-test3.txt',
      './text-without-page-markers.txt'
    ];

    for (const file of textFiles) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`   📄 ${file}: ${stats.size} bytes`);
      }
    }

    // Show image directories
    console.log('\n📁 Created Image Directories:');
    const imageDirs = [
      './page-markers-test1',
      './page-markers-test2', 
      './page-markers-test3',
      './page-markers-test4'
    ];

    for (const dir of imageDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log(`   📁 ${dir}: ${files.length} image files`);
      }
    }

    console.log('\n🎉 Page marker extraction completed!');
    console.log('💡 Key features:');
    console.log('   - includePageMarkers: true/false controls page markers in text');
    console.log('   - pageMarkerFormat: "{page}" placeholder for custom page markers');
    console.log('   - Works with both image references and page markers together');
    console.log('   - Page markers help identify which page content comes from');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the extraction
if (require.main === module) {
  extractWithPageMarkers().catch(console.error);
}

module.exports = { extractWithPageMarkers };
