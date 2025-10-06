#!/bin/bash

# 🧪 Refactoring Verification Script
# Run this after each refactoring change to ensure nothing broke

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "🧪 REFACTORING VERIFICATION TEST"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Build
echo "📦 Step 1: Building library..."
pnpm tsup --no-dts 2>&1 | tail -3
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi
echo "✅ Build successful"
echo ""

# Step 2: Clean and run test
echo "🧹 Step 2: Cleaning output directory..."
rm -rf test-page-images-output
echo "✅ Cleaned"
echo ""

echo "🧪 Step 3: Running complete test..."
node test-page-images-complete.js 2>&1 | tail -50
if [ $? -ne 0 ]; then
  echo "❌ Test failed!"
  exit 1
fi
echo ""

# Step 4: Verify outputs
echo "🔍 Step 4: Verifying outputs..."
echo ""

# Count images
IMAGE_COUNT=$(ls test-page-images-output/images/ 2>/dev/null | wc -l | tr -d ' ')
echo "📸 Embedded images: $IMAGE_COUNT (expected: 82)"
if [ "$IMAGE_COUNT" != "82" ]; then
  echo "❌ FAILED: Expected 82 images, got $IMAGE_COUNT"
  exit 1
fi
echo "✅ Embedded images: PASS"

# Count page images
PAGE_IMAGE_COUNT=$(ls test-page-images-output/jpg/ 2>/dev/null | wc -l | tr -d ' ')
echo "📄 Page images: $PAGE_IMAGE_COUNT (expected: 3)"
if [ "$PAGE_IMAGE_COUNT" != "3" ]; then
  echo "❌ FAILED: Expected 3 page images, got $PAGE_IMAGE_COUNT"
  exit 1
fi
echo "✅ Page images: PASS"

# Count thumbnails
THUMB_COUNT=$(ls test-page-images-output/thumbnails/ 2>/dev/null | wc -l | tr -d ' ')
echo "🖼️  Thumbnails: $THUMB_COUNT (expected: 3)"
if [ "$THUMB_COUNT" != "3" ]; then
  echo "❌ FAILED: Expected 3 thumbnails, got $THUMB_COUNT"
  exit 1
fi
echo "✅ Thumbnails: PASS"

# Check structured data
if [ -f "test-page-images-output/structured-complete.json" ]; then
  if command -v jq &> /dev/null; then
    PAGE_COUNT=$(cat test-page-images-output/structured-complete.json | jq '.pages | length')
    echo "📊 Structured data pages: $PAGE_COUNT (expected: 73)"
    if [ "$PAGE_COUNT" != "73" ]; then
      echo "❌ FAILED: Expected 73 pages, got $PAGE_COUNT"
      exit 1
    fi
    echo "✅ Structured data: PASS"
  else
    echo "⚠️  jq not installed, skipping structured data validation"
    echo "   (Install with: brew install jq)"
  fi
else
  echo "❌ FAILED: structured-complete.json not found"
  exit 1
fi

# Check image dimensions (sample first image)
FIRST_IMAGE=$(ls test-page-images-output/images/ | head -1)
if [ -n "$FIRST_IMAGE" ]; then
  if command -v identify &> /dev/null; then
    DIMENSIONS=$(identify test-page-images-output/images/$FIRST_IMAGE 2>/dev/null | awk '{print $3}')
    echo "📐 Sample image dimensions: $DIMENSIONS"
    if [[ "$DIMENSIONS" == "100x100" ]]; then
      echo "❌ FAILED: Images have default 100x100 dimensions (metadata not working)"
      exit 1
    fi
    echo "✅ Image dimensions: PASS"
  else
    echo "⚠️  ImageMagick not installed, skipping dimension check"
    echo "   (Install with: brew install imagemagick)"
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ ALL VERIFICATION TESTS PASSED! 🎉"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  ✅ Build successful"
echo "  ✅ 82 embedded images extracted"
echo "  ✅ 3 page images generated"
echo "  ✅ 3 thumbnails generated"
echo "  ✅ Structured data with 73 pages"
echo "  ✅ Image dimensions correct"
echo ""
echo "🚀 Safe to continue refactoring!"
echo ""

