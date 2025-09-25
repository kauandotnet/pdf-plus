#!/usr/bin/env node

import { extractPdfContent } from '../dist/index.js';
import fs from 'fs';
import path from 'path';

async function testAllPdfs() {
  console.log('🎯 Testing Complete PDF Extraction with Poppler Engine\n');

  const pdfs = [
    {
      file: "Art Basel 2025_ Yares Art Preview (1).pdf",
      outputDir: 'yares-art-extraction'
    },
    {
      file: "Frieze Seoul 2025_Booth B6_PDF (2) (1).pdf", 
      outputDir: 'frieze-seoul-extraction'
    }
  ];

  for (const pdf of pdfs) {
    console.log(`\n📄 Processing: ${pdf.file}`);
    console.log(`📁 Output directory: ${pdf.outputDir}`);
    
    if (!fs.existsSync(pdf.file)) {
      console.log(`❌ PDF file not found: ${pdf.file}`);
      continue;
    }

    try {
      const startTime = Date.now();
      
      const result = await extractPdfContent(pdf.file, {
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
        imageOutputDir: pdf.outputDir,
        useImagePaths: true,
        
        // Structured data
        generateStructuredData: true,
        
        // Output options
        verbose: false, // Reduced verbosity for batch processing
      });

      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Extraction completed in ${processingTime}ms`);
      
      // Save additional files
      if (!fs.existsSync(pdf.outputDir)) {
        fs.mkdirSync(pdf.outputDir, { recursive: true });
      }
      
      // Save structured JSON data
      if (result.structuredData) {
        const jsonPath = `${pdf.outputDir}/structured-data.json`;
        fs.writeFileSync(jsonPath, JSON.stringify(result.structuredData, null, 2));
        console.log(`💾 Saved structured data: ${jsonPath}`);
      }
      
      // Save clean text
      if (result.cleanText) {
        const textPath = `${pdf.outputDir}/clean-text.txt`;
        fs.writeFileSync(textPath, result.cleanText);
        console.log(`💾 Saved clean text: ${textPath}`);
      }
      
      // Save text with image references
      if (result.textWithRefs) {
        const textWithRefsPath = `${pdf.outputDir}/text-with-image-refs.txt`;
        fs.writeFileSync(textWithRefsPath, result.textWithRefs);
        console.log(`💾 Saved text with image refs: ${textWithRefsPath}`);
      }
      
      // Save text with page markers
      if (result.textWithPageMarkers) {
        const textWithMarkersPath = `${pdf.outputDir}/text-with-page-markers.txt`;
        fs.writeFileSync(textWithMarkersPath, result.textWithPageMarkers);
        console.log(`💾 Saved text with page markers: ${textWithMarkersPath}`);
      }
      
      // Summary
      console.log(`\n📊 Results Summary for ${pdf.file}:`);
      console.log(`   📄 Pages: ${result.document.pages}`);
      console.log(`   📝 Text length: ${result.cleanText.length} characters`);
      console.log(`   🖼️  Images: ${result.images?.length || 0}`);
      console.log(`   🔧 Engine used: ${result.metadata?.engine || 'poppler'}`);
      
      // Check output directory
      if (fs.existsSync(pdf.outputDir)) {
        const files = fs.readdirSync(pdf.outputDir);
        const imageFiles = fs.existsSync(path.join(pdf.outputDir, 'images')) 
          ? fs.readdirSync(path.join(pdf.outputDir, 'images')).filter(f => f.endsWith('.png'))
          : [];
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        const txtFiles = files.filter(f => f.endsWith('.txt'));
        
        console.log(`   📁 Output files:`);
        console.log(`      🖼️  PNG images: ${imageFiles.length}`);
        console.log(`      📋 JSON files: ${jsonFiles.length}`);
        console.log(`      📝 TXT files: ${txtFiles.length}`);
        
        if (imageFiles.length > 0) {
          console.log(`      📄 Sample images: ${imageFiles.slice(0, 3).join(', ')}${imageFiles.length > 3 ? '...' : ''}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Extraction failed for ${pdf.file}:`, error.message);
    }
  }

  console.log('\n🎉 Batch processing completed!');
  console.log('\n📁 Output directories created:');
  pdfs.forEach(pdf => {
    if (fs.existsSync(pdf.outputDir)) {
      console.log(`   ✅ ${pdf.outputDir}/`);
    } else {
      console.log(`   ❌ ${pdf.outputDir}/ (failed)`);
    }
  });
}

testAllPdfs().catch(console.error);
