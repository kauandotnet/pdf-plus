# pdf-plus

A comprehensive PDF content extraction library with support for text, images, and structured data.

## Features

- 📝 **Text Extraction** - High-quality text extraction with positioning
- 🖼️ **Image Detection** - Detect and reference images in PDF content
- 💾 **Image File Extraction** - Extract actual image files from PDFs
- 🎨 **Image Optimization** - Optional Sharp/Imagemin optimization with quality control
- 🔄 **JP2 Conversion** - Automatic JPEG 2000 to JPG conversion for compatibility
- 🚀 **Parallel Processing** - 1.5-3x faster with configurable concurrency (Phase 1)
- ⚡ **Async I/O** - Non-blocking file operations for better performance (Phase 2)
- 🧵 **Worker Threads** - True multi-threading for CPU-intensive operations (Phase 3)
- 🌊 **Streaming API** - Process large PDFs with 10-100x lower memory usage (Phase 4)
- 📄 **Page to Image** - Convert PDF pages to images (PNG, JPG, WebP) (Phase 5 - NEW!)
- 🎯 **Format Preservation** - Preserves original image formats (JPG, PNG) and full quality
- 🔧 **TypeScript Support** - Full TypeScript definitions included
- 🛡️ **Robust Validation** - Comprehensive input validation and error handling

## Installation

```bash
# Using pnpm (recommended)
pnpm add pdf-plus

# Using npm
npm install pdf-plus

# Using yarn
yarn add pdf-plus
```

## Quick Start

```typescript
import { extractPdfContent } from "pdf-plus";

// Extract both text and images
const result = await extractPdfContent("document.pdf", {
  extractText: true,
  extractImages: true,
  verbose: true,
});

console.log(
  `Extracted ${result.images.length} images from ${result.document.pages} pages`
);
console.log(`Text content: ${result.cleanText.substring(0, 100)}...`);
```

### Streaming API for Large PDFs (NEW! - Phase 4)

For large PDFs, use the streaming API for lower memory usage and real-time progress:

```typescript
import { extractPdfStream } from "pdf-plus";

const stream = extractPdfStream("large-document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./images",
  streamMode: true,
});

for await (const event of stream) {
  if (event.type === "page") {
    console.log(`Page ${event.pageNumber}/${event.totalPages} complete`);
  } else if (event.type === "progress") {
    console.log(`Progress: ${event.percentComplete.toFixed(1)}%`);
  } else if (event.type === "complete") {
    console.log(`Done! ${event.totalImages} images extracted`);
  }
}
```

**Benefits:**

- 📉 **10-100x lower memory usage** for large PDFs
- ⚡ **100x faster time to first result**
- 📊 **Real-time progress tracking**
- 🛑 **Cancellation support**

See [PHASE4-STREAMING.md](./PHASE4-STREAMING.md) for complete streaming API documentation.

### Convert PDF Pages to Images (NEW! - Phase 5)

Convert PDF pages to high-quality images (PNG, JPG, WebP):

```typescript
import { PageToImageConverter } from "pdf-plus";

const converter = new PageToImageConverter();

// Convert all pages to PNG
const result = await converter.convertToImages("document.pdf", {
  outputDir: "./page-images",
  format: "png",
  dpi: 150,
  verbose: true,
});

console.log(`Converted ${result.totalPages} pages`);
```

**Features:**

- 🎨 **Multiple formats** - PNG, JPG, WebP
- 📐 **Quality control** - Adjustable DPI (72, 150, 300, 600) and quality
- 📄 **Page selection** - Convert specific pages or ranges
- 🖼️ **Thumbnails** - Generate low-res previews
- 💾 **Buffer/Base64** - In-memory conversion for web apps

See [PAGE-TO-IMAGE-FEATURE.md](./PAGE-TO-IMAGE-FEATURE.md) for complete page-to-image documentation.

## Usage Examples

### Text-Only Extraction (Fast)

```typescript
import { extractText } from "pdf-plus";

const text = await extractText("document.pdf");
console.log(`Extracted ${text.length} characters`);
```

### Images-Only Extraction

```typescript
import { extractImages } from "pdf-plus";

const images = await extractImages("document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./my-images",
});

console.log(`Found ${images.length} images`);
```

### Image Extraction with Optimization

```typescript
import { extractPdfContent } from "pdf-plus";

const result = await extractPdfContent("document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./images",

  // Enable optimization
  optimizeImages: true,
  imageOptimizer: "auto", // or 'sharp', 'imagemin'
  imageQuality: 80,
  imageProgressive: true,

  // Convert JP2 (JPEG 2000) to JPG for better compatibility (default: true)
  convertJp2ToJpg: true,
  imageQuality: 100, // Default: 100 for JP2 conversion (max quality)

  verbose: true,
});

// Check optimization results
result.images.forEach((img) => {
  console.log(`${img.filename}: Optimized and saved`);
});
```

### Performance Optimization (NEW! 🚀)

```typescript
import { extractPdfContent } from "pdf-plus";

// BASIC: Parallel processing (enabled by default)
const result = await extractPdfContent("document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./images",
  parallelProcessing: true, // 1.5-3x faster
});

// ADVANCED: With worker threads for CPU-intensive operations
const result = await extractPdfContent("large-document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./images",

  // Enable parallel processing (default: true)
  parallelProcessing: true,

  // Enable worker threads for true multi-threading (default: false)
  useWorkerThreads: true, // 2.5-3.2x additional speedup!
  autoScaleWorkers: true, // Auto-adjust based on system resources
  maxWorkerThreads: 8, // Max worker threads (default: CPU cores - 1)

  // Fine-tune concurrency for your workload
  maxConcurrentPages: 20, // Process up to 20 pages simultaneously
  maxConcurrentImages: 50, // Extract up to 50 images per page in parallel
  maxConcurrentConversions: 5, // Convert up to 5 JP2 files simultaneously
  maxConcurrentOptimizations: 5, // Optimize up to 5 images simultaneously

  verbose: true,
});

// Performance gains (tested on Art Basel PDF, 54 images):
// - Baseline (sequential): 140ms
// - Parallel processing: 47ms (2.96x faster)
// - Parallel + Workers: 44ms (3.23x faster) 🚀
```

**Performance Recommendations:**

| PDF Size | Images | Recommended Settings                                                                                                      |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Small    | <20    | `parallelProcessing: true` (default settings)                                                                             |
| Medium   | 20-50  | `parallelProcessing: true, maxConcurrentPages: 10, maxConcurrentImages: 20`                                               |
| Large    | 50+    | `parallelProcessing: true, useWorkerThreads: true, maxConcurrentPages: 20, maxConcurrentImages: 50`                       |
| Huge     | 200+   | `parallelProcessing: true, useWorkerThreads: true, maxWorkerThreads: 8, maxConcurrentPages: 30, maxConcurrentImages: 100` |

**Worker Threads Benefits:**

- ✅ True multi-threading (runs on separate CPU cores)
- ✅ 2.5-3.2x faster for CPU-intensive operations (JP2 conversion, optimization)
- ✅ Auto-scaling based on memory and CPU usage
- ✅ Opt-in (default: false) - no breaking changes

See [PERFORMANCE.md](./PERFORMANCE.md) and [PHASE3-WORKERS.md](./PHASE3-WORKERS.md) for detailed benchmarks and optimization guide.

### Custom Image References

```typescript
import { extractPdfContent } from "pdf-plus";

const result = await extractPdfContent("document.pdf", {
  imageRefFormat: "📷 Image {index} on page {page}",
  extractImageFiles: true,
  useImagePaths: true,
});

// Text will contain: "📷 Image 1 on page 1" instead of "[IMAGE:img_1]"
```

### Advanced Configuration

```typescript
import { PDFExtractor } from "pdf-plus";

const extractor = new PDFExtractor();

const result = await extractor.extract("large-document.pdf", {
  extractText: true,
  extractImages: true,
  extractImageFiles: true,
  imageOutputDir: "./extracted-images",
  memoryLimit: "1GB",
  batchSize: 10,
  progressCallback: (progress) => {
    console.log(
      `Processing page ${progress.currentPage}/${progress.totalPages}`
    );
  },
});
```

### Real-World Examples

#### Extract and Save Images from Academic Papers

```typescript
import { extractPdfContent } from "pdf-plus";
import path from "path";

async function extractAcademicPaper(pdfPath: string) {
  const result = await extractPdfContent(pdfPath, {
    extractText: true,
    extractImages: true,
    extractImageFiles: true,
    imageOutputDir: "./paper-images",
    imageRefFormat: "Figure {index}: {name}",
    verbose: true,
  });

  // Save text content
  const fs = await import("fs");
  fs.writeFileSync("./paper-text.txt", result.cleanText);

  // Log extraction summary
  console.log(`📄 Extracted from ${result.document.filename}:`);
  console.log(`   📝 Text: ${result.document.textLength} characters`);
  console.log(`   🖼️  Images: ${result.images.length} found`);
  console.log(`   📊 Pages: ${result.document.pages}`);

  return result;
}
```

#### Batch Process Multiple PDFs

```typescript
import { PDFExtractor } from "pdf-plus";
import { glob } from "glob";

async function batchProcessPDFs(pattern: string) {
  const extractor = new PDFExtractor("./cache"); // Enable caching
  const pdfFiles = await glob(pattern);

  const results = [];

  for (const pdfFile of pdfFiles) {
    console.log(`Processing: ${pdfFile}`);

    try {
      const result = await extractor.extract(pdfFile, {
        extractText: true,
        extractImages: true,
        imageOutputDir: `./output/${path.basename(pdfFile, ".pdf")}`,
        batchSize: 5, // Process 5 pages at a time
        verbose: false,
      });

      results.push({
        file: pdfFile,
        success: true,
        pages: result.document.pages,
        images: result.images.length,
        textLength: result.document.textLength,
      });
    } catch (error) {
      console.error(`Failed to process ${pdfFile}:`, error);
      results.push({
        file: pdfFile,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}
```

## API Reference

### Main Functions

#### `extractPdfContent(pdfPath, options)`

Extract complete content from a PDF file.

**Parameters:**

- `pdfPath` (string) - Path to the PDF file
- `options` (ExtractionOptions) - Extraction configuration

**Returns:** `Promise<ExtractionResult>`

#### `extractText(pdfPath, options)`

Extract only text content (optimized for speed).

**Returns:** `Promise<string>`

#### `extractImages(pdfPath, options)`

Extract only image references.

**Returns:** `Promise<ImageItem[]>`

#### `extractImageFiles(pdfPath, outputDir, options)`

Extract and save actual image files.

**Returns:** `Promise<string[]>` - Array of saved file paths

### Options

```typescript
interface ExtractionOptions {
  // Basic extraction options
  extractText?: boolean; // Extract text content (default: true)
  extractImages?: boolean; // Extract image references (default: true)
  extractImageFiles?: boolean; // Save actual image files (default: false)
  useImagePaths?: boolean; // Use file paths in references (default: false)
  imageOutputDir?: string; // Directory for image files (default: './extracted-images')
  imageRefFormat?: string; // Custom reference format (default: '[IMAGE:{id}]')
  baseName?: string; // Base name for output files
  verbose?: boolean; // Show detailed progress (default: false)
  memoryLimit?: string; // Memory limit (e.g., '512MB', '1GB')
  batchSize?: number; // Pages per batch (1-100)
  progressCallback?: (progress: ProgressInfo) => void;

  // Image optimization options
  optimizeImages?: boolean; // Enable image optimization (default: false)
  imageOptimizer?: "auto" | "sharp" | "imagemin"; // Optimizer to use (default: 'auto')
  imageQuality?: number; // Image quality 1-100 (default: 80, JP2 conversion: 100)
  imageProgressive?: boolean; // Progressive JPEG (default: true)
  convertJp2ToJpg?: boolean; // Convert JP2 to JPG (default: true)

  // Performance options (NEW!)
  parallelProcessing?: boolean; // Enable parallel processing (default: true)
  maxConcurrentPages?: number; // Max pages in parallel (default: 10)
  maxConcurrentImages?: number; // Max images per page in parallel (default: 20)
  maxConcurrentConversions?: number; // Max JP2 conversions in parallel (default: 5)
  maxConcurrentOptimizations?: number; // Max optimizations in parallel (default: 5)

  // Worker thread options (NEW! 🚀)
  useWorkerThreads?: boolean; // Enable worker threads (default: false)
  autoScaleWorkers?: boolean; // Auto-scale workers (default: true)
  maxWorkerThreads?: number; // Max worker threads (default: CPU cores - 1)
  minWorkerThreads?: number; // Min worker threads (default: 1)
  memoryThreshold?: number; // Memory threshold 0-1 (default: 0.8)
  cpuThreshold?: number; // CPU threshold 0-1 (default: 0.9)
  workerTaskTimeout?: number; // Task timeout ms (default: 30000)
  workerIdleTimeout?: number; // Idle timeout ms (default: 60000)
  workerMemoryLimit?: number; // Memory per worker MB (default: 512)
  enableWorkerForConversion?: boolean; // Workers for JP2 (default: true)
  enableWorkerForOptimization?: boolean; // Workers for optimization (default: true)
  enableWorkerForDecoding?: boolean; // Workers for decoding (default: true)
}
```

**Performance Options Explained:**

**Parallel Processing:**

- **`parallelProcessing`**: Enable/disable parallel processing. Enabled by default for 1.5-3x speedup.
- **`maxConcurrentPages`**: How many pages to process simultaneously. Higher values = faster for multi-page PDFs, but more memory usage.
- **`maxConcurrentImages`**: How many images per page to extract in parallel. Increase for pages with many images.
- **`maxConcurrentConversions`**: How many JP2→JPG conversions to run simultaneously. Keep moderate (5-10) to avoid memory issues.
- **`maxConcurrentOptimizations`**: How many image optimizations to run simultaneously. Keep moderate (5-10) as optimization is CPU-intensive.

**Worker Threads (NEW! 🚀):**

- **`useWorkerThreads`**: Enable true multi-threading using Node.js worker threads. Provides 2.5-3.2x additional speedup for CPU-intensive operations. Default: `false` (opt-in).
- **`autoScaleWorkers`**: Automatically adjust worker count based on system memory and CPU usage. Default: `true`.
- **`maxWorkerThreads`**: Maximum number of worker threads. Default: CPU cores - 1.
- **`minWorkerThreads`**: Minimum number of worker threads to keep alive. Default: 1.
- **`memoryThreshold`**: Memory usage threshold (0-1) before scaling down workers. Default: 0.8 (80%).
- **`cpuThreshold`**: CPU usage threshold (0-1) before scaling down workers. Default: 0.9 (90%).
- **`workerTaskTimeout`**: Maximum time (ms) for a worker task before timeout. Default: 30000 (30 seconds).
- **`workerIdleTimeout`**: Time (ms) before idle workers are terminated. Default: 60000 (60 seconds).
- **`workerMemoryLimit`**: Memory limit (MB) per worker thread. Default: 512MB.
- **`enableWorkerForConversion`**: Use workers for JP2 conversion. Default: `true`.
- **`enableWorkerForOptimization`**: Use workers for image optimization. Default: `true`.
- **`enableWorkerForDecoding`**: Use workers for image decoding. Default: `true`.

### Format Placeholders

Use these placeholders in `imageRefFormat`:

- `{id}` - Unique image ID (e.g., `img_1`)
- `{name}` - Original image name from PDF
- `{page}` - Page number
- `{index}` - Global image index
- `{path}` - File path (when `extractImageFiles` is true)

**Examples:**

- `[IMAGE:{id}]` → `[IMAGE:img_1]`
- `📷 Image {index}` → `📷 Image 1`
- `{name} on page {page}` → `artwork_1 on page 5`
- `<img src="{path}">` → `<img src="./images/img_1.jpg">`

## Image Optimization & Conversion

Extract and optimize images in one step using Sharp or Imagemin:

```typescript
import { extractPdfContent } from "pdf-plus";

const result = await extractPdfContent("document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./images",

  // Enable optimization
  optimizeImages: true,
  imageOptimizer: "auto", // Automatically selects best available
  imageQuality: 80,
  imageProgressive: true,

  // Convert JP2 (JPEG 2000) to JPG for better compatibility (default: true)
  convertJp2ToJpg: true,

  verbose: true,
});

// Output:
// 🖼️  Extracting images from: document.pdf
// 📊 Processing 50 pages with PDF-lib engine
//    💾 Extracted real image: img_p1_1.jpg (245KB)
// 🔄 Converting 16 JP2 images to JPG...
//    🔄 Converted JP2 → JPG: img_p2_2.jpg (24026 → 18500 bytes)
// 🎨 Optimizing 54 images...
//    ✅ img_p1_1.jpg: 251904 → 184320 bytes (-26.8%) [sharp]
//    ✅ img_p2_2.jpg: 18500 → 15200 bytes (-17.8%) [sharp]
```

### JP2 to JPG Conversion

JP2 (JPEG 2000) files are not widely supported by browsers and image tools. The library automatically converts them to standard JPG format:

```typescript
const result = await extractPdfContent("document.pdf", {
  extractImageFiles: true,
  convertJp2ToJpg: true, // Default: true
  imageQuality: 100, // Default: 100 (maximum quality preservation)
});

// All JP2 images are now JPG files with better compatibility
```

**Quality Preservation:**

- **Default quality: 100** - Preserves maximum quality from JP2
- Use lower values (80-90) if you want additional compression
- Original JP2 files are deleted after successful conversion

**Benefits:**

- ✅ Better browser compatibility
- ✅ Can be optimized by Sharp/Imagemin
- ✅ Maximum quality preserved (quality=100)
- ✅ Works everywhere

### Optimizer Comparison

| Optimizer  | Speed    | Quality   | Formats            | Platform                                  |
| ---------- | -------- | --------- | ------------------ | ----------------------------------------- |
| `sharp`    | Fast     | Excellent | JPG, PNG, WebP     | Native (requires compilation)             |
| `imagemin` | Medium   | Excellent | JPG, PNG, GIF, SVG | Cross-platform                            |
| `auto`     | Variable | Excellent | All supported      | Tries sharp first, falls back to imagemin |

### Optimization Presets

```typescript
// Maximum compression (slower, smaller files)
const result = await extractPdfContent("document.pdf", {
  optimizeImages: true,
  imageQuality: 70,
});

// Balanced (recommended)
const result = await extractPdfContent("document.pdf", {
  optimizeImages: true,
  imageQuality: 80, // Default
});

// Fast optimization with Sharp
const result = await extractPdfContent("document.pdf", {
  optimizeImages: true,
  imageOptimizer: "sharp",
  imageQuality: 85,
});
```

## Performance Modes

### Text-Only Mode (Fastest)

```typescript
const text = await extractText("document.pdf");
// ~40% faster than combined mode
```

### Images-Only Mode

```typescript
const images = await extractImages("document.pdf");
// ~20% faster than combined mode
```

### Combined Mode (Default)

```typescript
const result = await extractPdfContent("document.pdf");
// Full extraction with text and image references
```

## Error Handling

```typescript
import { extractPdfContent } from "pdf-plus";

try {
  const result = await extractPdfContent("document.pdf");
} catch (error) {
  if (error.code === "VALIDATION_ERROR") {
    console.error("Configuration error:", error.validationErrors);
  } else if (error.code === "EXTRACTION_ERROR") {
    console.error("Extraction failed:", error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm run build

# Lint and format
pnpm run lint:fix
pnpm run format

# Type checking
pnpm run check
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0 (for development)

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Troubleshooting

### Common Issues

#### "Cannot find module" errors

Make sure you're using the correct import syntax for your environment:

```typescript
// ESM (recommended)
import { extractPdfContent } from "pdf-plus";

// CommonJS
const { extractPdfContent } = require("pdf-plus");
```

#### Memory issues with large PDFs

For large documents, use streaming options:

```typescript
const result = await extractPdfContent("large-document.pdf", {
  memoryLimit: "512MB",
  batchSize: 5,
  useCache: true,
});
```

#### Image extraction not working

Try different engines:

```typescript
const result = await extractPdfContent("document.pdf", {
  imageEngine: "poppler", // or 'pdf-lib', 'auto'
  extractImageFiles: true,
});
```

#### Text extraction issues

Some PDFs may have encoding issues. Try:

```typescript
const result = await extractPdfContent("document.pdf", {
  extractText: true,
  textEngine: "pdfjs", // Alternative engine
  verbose: true, // See detailed logs
});
```

### Performance Tips

1. **Use specific extraction modes** for better performance:

   ```typescript
   // Text only (fastest)
   const text = await extractText("document.pdf");

   // Images only
   const images = await extractImages("document.pdf");
   ```

2. **Enable caching** for repeated operations:

   ```typescript
   const extractor = new PDFExtractor("./cache");
   ```

3. **Process pages in batches** for large documents:
   ```typescript
   const result = await extractPdfContent("large.pdf", {
     batchSize: 10,
     memoryLimit: "1GB",
   });
   ```

### Getting Help

- Check the [Issues](https://github.com/kauandotnet/pdf-plus/issues) page
- Review [examples](./examples/) for common use cases
- Enable verbose logging for debugging: `{ verbose: true }`

## Roadmap

### Planned Features

- **OCR Support**: Text extraction from image-based PDFs
- **Advanced Text Analysis**: Font detection, text classification
- **Streaming API**: Process large documents efficiently
- **Cloud Integration**: Direct integration with cloud storage
- **CLI Tool**: Command-line interface for batch processing
- **Web Worker Support**: Browser-based extraction
- **Plugin System**: Extensible architecture for custom extractors

### Version 1.x Roadmap

- [ ] OCR integration with Tesseract.js
- [ ] Advanced image processing options
- [ ] Streaming extraction API
- [ ] Performance optimizations
- [ ] Browser compatibility layer
- [ ] CLI tool development

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.
