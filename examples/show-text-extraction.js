/**
 * Demonstrate where text extraction is stored and how to access it
 */

const { extractPdfContent, extractText } = require('../dist/index.js');
const fs = require('fs');

async function showTextExtraction() {
  console.log('📝 Text Extraction Storage Demo\n');

  const pdfPath = '../Art Basel 2025 (1).pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF not found');
    return;
  }

  try {
    // Method 1: Simple text extraction
    console.log('📄 Method 1: Simple Text Extraction');
    const textResult = await extractText(pdfPath);
    console.log('   Structure of textResult:');
    console.log('   ├── text:', typeof textResult.text, `(${textResult.text?.length || 0} chars)`);
    console.log('   ├── totalPages:', textResult.totalPages);
    console.log('   └── metadata:', typeof textResult.metadata);
    
    // Show first 200 characters of extracted text
    if (textResult.text) {
      console.log('\n   📝 First 200 characters of extracted text:');
      console.log('   "' + textResult.text.substring(0, 200) + '..."');
    }

    // Method 2: Full extraction with structured data
    console.log('\n📊 Method 2: Full Extraction with Structured Data');
    const fullResult = await extractPdfContent(pdfPath, {
      extractText: true,
      extractImages: true,
      verbose: true
    });

    console.log('   Structure of fullResult:');
    console.log('   ├── text:', typeof fullResult.text, `(${fullResult.text?.length || 0} chars)`);
    console.log('   ├── textItems:', Array.isArray(fullResult.textItems) ? `Array[${fullResult.textItems.length}]` : typeof fullResult.textItems);
    console.log('   ├── images:', Array.isArray(fullResult.images) ? `Array[${fullResult.images.length}]` : typeof fullResult.images);
    console.log('   ├── totalPages:', fullResult.totalPages);
    console.log('   ├── textWithRefs:', typeof fullResult.textWithRefs, `(${fullResult.textWithRefs?.length || 0} chars)`);
    console.log('   └── cleanText:', typeof fullResult.cleanText, `(${fullResult.cleanText?.length || 0} chars)`);

    // Method 3: Save text to files
    console.log('\n💾 Method 3: Save Text to Files');
    
    // Save raw extracted text
    if (fullResult.text) {
      fs.writeFileSync('./extracted-text-raw.txt', fullResult.text);
      console.log('   ✅ Raw text saved to: ./extracted-text-raw.txt');
    }

    // Save text with image references
    if (fullResult.textWithRefs) {
      fs.writeFileSync('./extracted-text-with-refs.txt', fullResult.textWithRefs);
      console.log('   ✅ Text with image refs saved to: ./extracted-text-with-refs.txt');
    }

    // Save clean text (no image references)
    if (fullResult.cleanText) {
      fs.writeFileSync('./extracted-text-clean.txt', fullResult.cleanText);
      console.log('   ✅ Clean text saved to: ./extracted-text-clean.txt');
    }

    // Save structured JSON data
    const structuredData = {
      metadata: {
        filename: pdfPath.split('/').pop(),
        extractedAt: new Date().toISOString(),
        totalPages: fullResult.totalPages,
        textLength: fullResult.text?.length || 0,
        imageCount: fullResult.images?.length || 0
      },
      text: {
        raw: fullResult.text,
        withImageRefs: fullResult.textWithRefs,
        clean: fullResult.cleanText
      },
      images: fullResult.images,
      textItems: fullResult.textItems
    };

    fs.writeFileSync('./extracted-data.json', JSON.stringify(structuredData, null, 2));
    console.log('   ✅ Structured data saved to: ./extracted-data.json');

    // Method 4: Show text storage locations
    console.log('\n📁 Text Storage Locations:');
    console.log('   1. In Memory:');
    console.log('      ├── result.text           - Raw extracted text');
    console.log('      ├── result.textWithRefs   - Text with image placeholders');
    console.log('      ├── result.cleanText      - Text without image references');
    console.log('      └── result.textItems      - Structured text elements (future)');
    console.log('');
    console.log('   2. In Files:');
    console.log('      ├── ./extracted-text-raw.txt        - Raw text content');
    console.log('      ├── ./extracted-text-with-refs.txt  - Text with image references');
    console.log('      ├── ./extracted-text-clean.txt      - Clean text only');
    console.log('      └── ./extracted-data.json           - Complete structured data');

    // Show file sizes
    console.log('\n📊 Created Files:');
    const files = [
      './extracted-text-raw.txt',
      './extracted-text-with-refs.txt', 
      './extracted-text-clean.txt',
      './extracted-data.json'
    ];

    for (const file of files) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`   📄 ${file}: ${stats.size} bytes`);
      }
    }

    console.log('\n🎉 Text extraction storage demo complete!');
    console.log('💡 You can now examine the created files to see how text is stored.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the demo
if (require.main === module) {
  showTextExtraction().catch(console.error);
}

module.exports = { showTextExtraction };
