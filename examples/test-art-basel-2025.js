#!/usr/bin/env node

import { extractPdfContent } from '../dist/index.js';
import fs from 'fs';

async function testArtBasel2025() {
  console.log('🎯 Testing Art Basel 2025 (1) PDF with Poppler Engine\n');

  const pdfFile = "Art Basel 2025 (1).pdf";
  const outputDir = 'art-basel-2025-extraction';
  
  if (!fs.existsSync(pdfFile)) {
    console.log(`❌ PDF file not found: ${pdfFile}`);
    return;
  }

  try {
    console.log(`📄 Processing: ${pdfFile}`);
    console.log(`📁 Output directory: ${outputDir}`);
    
    const startTime = Date.now();
    
    const result = await extractPdfContent(pdfFile, {
      // Engine selection
      imageEngine: 'poppler',
      
      // Text extraction
      extractText: true,
      extractTextItems: true,
      includePageMarkers: true,
      includeImageRefs: true,
      pageMarkerFormat: "--- PAGE {page} ---",
      imageRefFormat: "[IMG:{id}] {name}",
      
      // Image extraction
      extractImages: true,
      extractImageFiles: true,
      imageOutputDir: outputDir,
      useImagePaths: true,
      
      // Structured data
      generateStructuredData: true,
      
      // Output options
      verbose: false, // Reduced verbosity for cleaner output
    });

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Extraction completed in ${processingTime}ms`);
    
    // Save additional files
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save structured JSON data
    if (result.structuredData) {
      const jsonPath = `${outputDir}/structured-data.json`;
      fs.writeFileSync(jsonPath, JSON.stringify(result.structuredData, null, 2));
      console.log(`💾 Saved structured data: ${jsonPath}`);
    }
    
    // Save clean text
    if (result.cleanText) {
      const textPath = `${outputDir}/clean-text.txt`;
      fs.writeFileSync(textPath, result.cleanText);
      console.log(`💾 Saved clean text: ${textPath}`);
    }
    
    // Save text with image references
    if (result.textWithRefs) {
      const textWithRefsPath = `${outputDir}/text-with-image-refs.txt`;
      fs.writeFileSync(textWithRefsPath, result.textWithRefs);
      console.log(`💾 Saved text with image refs: ${textWithRefsPath}`);
    }
    
    // Summary
    console.log(`\n📊 Results Summary for ${pdfFile}:`);
    console.log(`   📄 Pages: ${result.document.pages}`);
    console.log(`   📝 Text length: ${result.cleanText.length} characters`);
    console.log(`   🖼️  Images: ${result.images?.length || 0}`);
    console.log(`   🔧 Engine used: ${result.metadata?.engine || 'poppler'}`);
    
    // Check output directory
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      const imageFiles = fs.existsSync(`${outputDir}/images`) 
        ? fs.readdirSync(`${outputDir}/images`).filter(f => f.endsWith('.png'))
        : [];
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const txtFiles = files.filter(f => f.endsWith('.txt'));
      
      console.log(`   📁 Output files:`);
      console.log(`      🖼️  PNG images: ${imageFiles.length}`);
      console.log(`      📋 JSON files: ${jsonFiles.length}`);
      console.log(`      📝 TXT files: ${txtFiles.length}`);
      
      if (imageFiles.length > 0) {
        console.log(`      📄 Sample images: ${imageFiles.slice(0, 5).join(', ')}${imageFiles.length > 5 ? '...' : ''}`);
      }
    }
    
    console.log('\n🎉 Art Basel 2025 (1) extraction completed successfully!');
    
  } catch (error) {
    console.error(`❌ Extraction failed for ${pdfFile}:`, error.message);
    console.error(error.stack);
  }
}

testArtBasel2025().catch(console.error);
