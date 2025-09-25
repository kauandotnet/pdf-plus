#!/usr/bin/env node

import { ImageExtractor } from '../dist/index.js';
import fs from 'fs';

async function compareEngines() {
  console.log('🎯 PDF Image Extraction Engine Comparison\n');

  const extractor = new ImageExtractor();
  const pdfPath = "Art Basel 2025_ Yares Art Preview (1).pdf";
  
  console.log('📊 Available Engines:');
  try {
    const engines = await ImageExtractor.getAvailableEngines();
    engines.forEach(engine => {
      console.log(`   ${engine.available ? '✅' : '❌'} ${engine.name}: ${engine.description}`);
      if (engine.available) {
        const caps = engine.capabilities;
        console.log(`      📋 Formats: ${caps.formats.join(', ')}`);
        console.log(`      🔧 Features: ${caps.supportsMetadata ? 'Metadata' : ''} ${caps.supportsEmbeddedImages ? 'Embedded' : ''} ${caps.supportsVectorImages ? 'Vector' : ''}`);
      }
    });
  } catch (error) {
    console.log(`❌ Failed to get engine info: ${error}`);
  }

  console.log('\n🔧 Engine Comparison Tests:\n');

  // Test 1: PDF-lib Engine
  console.log('1️⃣ PDF-lib Engine (Original Format Preservation)');
  try {
    const start1 = Date.now();
    const result1 = await extractor.extract(pdfPath, {
      imageEngine: 'pdf-lib',
      extractImageFiles: true,
      imageOutputDir: 'comparison-pdf-lib',
      verbose: false,
    });
    const time1 = Date.now() - start1;
    
    console.log(`   ✅ Extracted ${result1.images?.length || 0} images in ${time1}ms`);
    
    if (fs.existsSync('comparison-pdf-lib')) {
      const files = fs.readdirSync('comparison-pdf-lib');
      const formats = {};
      files.forEach(file => {
        const ext = file.split('.').pop();
        formats[ext] = (formats[ext] || 0) + 1;
      });
      console.log(`   📊 Formats: ${Object.entries(formats).map(([ext, count]) => `${count} ${ext.toUpperCase()}`).join(', ')}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 2: Poppler Engine
  console.log('\n2️⃣ Poppler Engine (PNG Conversion)');
  try {
    const start2 = Date.now();
    const result2 = await extractor.extract(pdfPath, {
      imageEngine: 'poppler',
      extractImageFiles: true,
      imageOutputDir: 'comparison-poppler',
      verbose: false,
    });
    const time2 = Date.now() - start2;
    
    console.log(`   ✅ Extracted ${result2.images?.length || 0} images in ${time2}ms`);
    
    if (fs.existsSync('comparison-poppler')) {
      const files = fs.readdirSync('comparison-poppler');
      const formats = {};
      files.forEach(file => {
        const ext = file.split('.').pop();
        formats[ext] = (formats[ext] || 0) + 1;
      });
      console.log(`   📊 Formats: ${Object.entries(formats).map(([ext, count]) => `${count} ${ext.toUpperCase()}`).join(', ')}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 3: Auto Engine Selection
  console.log('\n3️⃣ Auto Engine Selection');
  try {
    const start3 = Date.now();
    const result3 = await extractor.extract(pdfPath, {
      imageEngine: 'auto',
      extractImageFiles: true,
      imageOutputDir: 'comparison-auto',
      verbose: false,
    });
    const time3 = Date.now() - start3;
    
    console.log(`   ✅ Extracted ${result3.images?.length || 0} images in ${time3}ms`);
    console.log(`   🔧 Selected engine: ${result3.metadata?.engine || 'unknown'}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n📋 Summary:');
  console.log('   🎯 PDF-lib Engine: Preserves original formats (JPG, JP2, PNG)');
  console.log('   🎯 Poppler Engine: Converts all images to PNG for consistency');
  console.log('   🎯 Auto Selection: Chooses best available engine');
  console.log('\n🎉 Engine comparison completed!');
}

compareEngines().catch(console.error);
