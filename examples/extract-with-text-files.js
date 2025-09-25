/**
 * Extract Art Basel PDF and save text files with image references
 * Shows exactly where and how text with image references is created
 */

const { extractPdfContent } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

async function extractWithTextFiles() {
  console.log('📝 Extract Art Basel with Text Files and Image References\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    // Test 1: Extract with custom image references and save text files
    console.log('📁 Test 1: Custom image references with text file output');
    const result1 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './art-basel-images-test1',
      useImagePaths: true,
      imageRefFormat: '🎨 Art Basel Image {index} (Page {page})',
      verbose: true
    });

    // Manually save text with image references
    if (result1.textWithRefs) {
      fs.writeFileSync('./art-basel-text-with-refs-test1.txt', result1.textWithRefs);
      console.log('   ✅ Text with image refs saved to: ./art-basel-text-with-refs-test1.txt');
    }

    if (result1.cleanText) {
      fs.writeFileSync('./art-basel-clean-text-test1.txt', result1.cleanText);
      console.log('   ✅ Clean text saved to: ./art-basel-clean-text-test1.txt');
    }

    // Test 2: Different image reference format
    console.log('\n📁 Test 2: Different image reference format');
    const result2 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './art-basel-images-test2',
      useImagePaths: true,
      imageRefFormat: '[IMG:{id}] File: {path}',
      verbose: true
    });

    // Save with different format
    if (result2.textWithRefs) {
      fs.writeFileSync('./art-basel-text-with-refs-test2.txt', result2.textWithRefs);
      console.log('   ✅ Text with image refs saved to: ./art-basel-text-with-refs-test2.txt');
    }

    // Test 3: Simple image reference format
    console.log('\n📁 Test 3: Simple image reference format');
    const result3 = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: './art-basel-images-test3',
      useImagePaths: true,
      imageRefFormat: 'IMAGE_{index}',
      verbose: true
    });

    // Save with simple format
    if (result3.textWithRefs) {
      fs.writeFileSync('./art-basel-text-with-refs-test3.txt', result3.textWithRefs);
      console.log('   ✅ Text with image refs saved to: ./art-basel-text-with-refs-test3.txt');
    }

    // Test 4: Show the difference between formats
    console.log('\n📊 Comparison of Image Reference Formats:');
    
    // Show first few image references from each format
    const showFirstRefs = (text, label) => {
      if (text) {
        const refs = text.match(/\[IMAGE:[^\]]+\]|🎨[^🎨]*\([^)]+\)|IMAGE_\d+/g) || [];
        console.log(`   ${label}:`);
        refs.slice(0, 3).forEach((ref, i) => {
          console.log(`      ${i + 1}. ${ref}`);
        });
        console.log(`      ... (${refs.length} total image references)`);
      }
    };

    showFirstRefs(result1.textWithRefs, 'Format 1 - 🎨 Art Basel Image {index} (Page {page})');
    showFirstRefs(result2.textWithRefs, 'Format 2 - [IMG:{id}] File: {path}');
    showFirstRefs(result3.textWithRefs, 'Format 3 - IMAGE_{index}');

    // Show file sizes
    console.log('\n📊 Created Text Files:');
    const textFiles = [
      './art-basel-text-with-refs-test1.txt',
      './art-basel-clean-text-test1.txt',
      './art-basel-text-with-refs-test2.txt',
      './art-basel-text-with-refs-test3.txt'
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
      './art-basel-images-test1',
      './art-basel-images-test2', 
      './art-basel-images-test3'
    ];

    for (const dir of imageDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log(`   📁 ${dir}: ${files.length} image files`);
      }
    }

    console.log('\n🎉 Text extraction with image references completed!');
    console.log('💡 Key points:');
    console.log('   - imageRefFormat controls how image references appear in text');
    console.log('   - result.textWithRefs contains the text with image placeholders');
    console.log('   - result.cleanText contains text without image references');
    console.log('   - You must manually save text files (library doesn\'t auto-save text)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the extraction
if (require.main === module) {
  extractWithTextFiles().catch(console.error);
}

module.exports = { extractWithTextFiles };
