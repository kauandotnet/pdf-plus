#!/usr/bin/env node

import { ImageExtractor } from '../dist/index.js';

async function testPopplerSimple() {
  console.log('🎯 Testing Poppler Engine (PNG Conversion)\n');

  const extractor = new ImageExtractor();
  const pdfPath = "Art Basel 2025_ Yares Art Preview (1).pdf";
  
  console.log('🔧 Testing Poppler Engine with PNG conversion');
  try {
    const result = await extractor.extract(pdfPath, {
      imageEngine: 'poppler',
      extractImageFiles: true,
      imageOutputDir: 'test-poppler-png',
      verbose: true,
    });
    
    console.log(`\n✅ Poppler engine extracted ${result.images?.length || 0} images`);
    console.log(`   Engine used: ${result.metadata?.engine || 'unknown'}`);
    
    // Check the output directory
    const fs = await import('fs');
    if (fs.existsSync('test-poppler-png')) {
      const files = fs.readdirSync('test-poppler-png');
      console.log(`   📁 Output directory contains ${files.length} files`);
      
      // Show first few files
      const pngFiles = files.filter(f => f.endsWith('.png'));
      console.log(`   🖼️  PNG files: ${pngFiles.length}`);
      if (pngFiles.length > 0) {
        console.log(`   📄 First few files: ${pngFiles.slice(0, 5).join(', ')}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Poppler engine failed: ${error}`);
  }

  console.log('\n🎉 Testing completed!');
}

testPopplerSimple().catch(console.error);
