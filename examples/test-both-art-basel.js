/**
 * Test both Art Basel PDFs to compare image detection
 */

const { extractPdfContent } = require('../dist/index.js');
const fs = require('fs');

async function testBothPDFs() {
  console.log('🎨 Testing Both Art Basel PDFs for Image Detection\n');

  const pdfs = [
    '../Art Basel 2025 (1).pdf',
    '../Art Basel 2025 (2).pdf'
  ];

  for (const pdfPath of pdfs) {
    if (!fs.existsSync(pdfPath)) {
      console.log(`❌ PDF not found: ${pdfPath}`);
      continue;
    }

    console.log(`📄 Testing: ${pdfPath.split('/').pop()}`);
    
    try {
      // Read raw PDF content to analyze structure
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfContent = dataBuffer.toString('binary');
      
      // Enhanced pattern matching
      const patterns = {
        pages: /\/Type\s*\/Page\b/g,
        images: /\/Type\s*\/XObject\s*\/Subtype\s*\/Image/g,
        imageObjects: /\/XObject/g,
        jpegImages: /\/Filter\s*\/DCTDecode/g,
        pngImages: /\/Filter\s*\/FlateDecode/g,
        imageStreams: /stream[\s\S]*?endstream/g
      };

      console.log('   🔍 PDF Structure Analysis:');
      for (const [name, pattern] of Object.entries(patterns)) {
        const matches = pdfContent.match(pattern) || [];
        console.log(`      ${name}: ${matches.length} found`);
      }

      // Test extraction with custom directory
      const outputDir = `./test-${pdfPath.split('/').pop().replace('.pdf', '').replace(/\s+/g, '-')}`;
      
      const result = await extractPdfContent(pdfPath, {
        extractImages: true,
        extractImageFiles: true,
        imageOutputDir: outputDir,
        useImagePaths: true,
        imageRefFormat: '🎨 {name} (Page {page}, Image #{index})',
        verbose: true
      });

      console.log(`   ✅ Extraction Results:`);
      console.log(`      📄 Pages: ${result.totalPages}`);
      console.log(`      🖼️  Images: ${result.images?.length || 0}`);
      console.log(`      📝 Text: ${result.text?.length || 0} characters`);

      // Check created files
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        console.log(`      💾 Files created: ${files.length}`);
        if (files.length > 0) {
          console.log(`      📁 Sample files: ${files.slice(0, 3).join(', ')}`);
        }
      }

      console.log('');

    } catch (error) {
      console.error(`   ❌ Error processing ${pdfPath}:`, error.message);
      console.log('');
    }
  }

  // Show all created directories
  console.log('📂 All Created Directories:');
  const possibleDirs = [
    './test-Art-Basel-2025-(1)',
    './test-Art-Basel-2025-(2)',
    './extracted-images',
    './art-basel-images',
    './output'
  ];

  for (const dir of possibleDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log(`   📁 ${dir}: ${files.length} files`);
      if (files.length > 0) {
        files.forEach(file => {
          const filePath = `${dir}/${file}`;
          const stats = fs.statSync(filePath);
          console.log(`      📄 ${file} (${stats.size} bytes)`);
        });
      }
    }
  }

  console.log('\n💡 Note: Current implementation creates placeholder images.');
  console.log('   The directory structure and file naming demonstrate the API functionality.');
  console.log('   For real image extraction, PDF.js integration would be enhanced.');
}

// Run the test
if (require.main === module) {
  testBothPDFs().catch(console.error);
}

module.exports = { testBothPDFs };
