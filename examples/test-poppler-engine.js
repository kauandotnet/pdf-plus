#!/usr/bin/env node

import { ImageExtractor } from '../dist/index.js';
import fs from 'fs';

async function testPopplerEngine() {
  console.log('🎯 Testing Poppler Engine with Yares PDF\n');

  const extractor = new ImageExtractor();
  const pdfPath = "Art Basel 2025_ Yares Art Preview (1).pdf";
  
  // Test 1: Auto engine selection (should pick poppler if available)
  console.log('🔧 Test 1: Auto Engine Selection');
  try {
    const result1 = await extractor.extract(pdfPath, {
      imageEngine: 'auto',
      extractImageFiles: true,
      imageOutputDir: 'test-poppler-auto',
      verbose: true,
    });
    
    console.log(`✅ Auto engine extracted ${result1.images?.length || 0} images`);
    console.log(`   Engine used: ${result1.metadata?.engine || 'unknown'}\n`);
  } catch (error) {
    console.log(`❌ Auto engine failed: ${error}\n`);
  }

  // Test 2: Explicit poppler engine
  console.log('🔧 Test 2: Explicit Poppler Engine');
  try {
    const result2 = await extractor.extract(pdfPath, {
      imageEngine: 'poppler',
      extractImageFiles: true,
      imageOutputDir: 'test-poppler-explicit',
      verbose: true,
    });
    
    console.log(`✅ Poppler engine extracted ${result2.images?.length || 0} images`);
    console.log(`   Engine used: ${result2.metadata?.engine || 'unknown'}\n`);
  } catch (error) {
    console.log(`❌ Poppler engine failed: ${error}\n`);
  }

  // Test 3: Compare with pdf-lib engine
  console.log('🔧 Test 3: PDF-lib Engine (for comparison)');
  try {
    const result3 = await extractor.extract(pdfPath, {
      imageEngine: 'pdf-lib',
      extractImageFiles: true,
      imageOutputDir: 'test-pdf-lib-comparison',
      verbose: true,
    });
    
    console.log(`✅ PDF-lib engine extracted ${result3.images?.length || 0} images`);
    console.log(`   Engine used: ${result3.metadata?.engine || 'unknown'}\n`);
  } catch (error) {
    console.log(`❌ PDF-lib engine failed: ${error}\n`);
  }

  // Test 4: Engine availability
  console.log('🔧 Test 4: Engine Availability');
  try {
    const engines = await ImageExtractor.getAvailableEngines();
    console.log('Available engines:');
    engines.forEach(engine => {
      console.log(`   ${engine.available ? '✅' : '❌'} ${engine.name}: ${engine.description}`);
    });
  } catch (error) {
    console.log(`❌ Failed to get engine info: ${error}`);
  }

  console.log('\n🎉 Testing completed!');
}

testPopplerEngine().catch(console.error);
