# pdfnode

A comprehensive PDF content extraction library with support for text, images, and structured data.

## Features

- 📝 **Text Extraction** - High-quality text extraction with positioning
- 🖼️ **Image Detection** - Detect and reference images in PDF content
- 💾 **Image File Extraction** - Extract actual image files from PDFs
- 🎨 **Flexible Formatting** - Customizable image reference formats
- ⚡ **Performance Options** - Text-only, images-only, or combined modes
- 🔧 **TypeScript Support** - Full TypeScript definitions included
- 🛡️ **Robust Validation** - Comprehensive input validation and error handling

## Installation

```bash
# Using pnpm (recommended)
pnpm add pdfnode

# Using npm
npm install pdfnode

# Using yarn
yarn add pdfnode
```

## Quick Start

```typescript
import { extractPdfContent } from "pdfnode";

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

## Usage Examples

### Text-Only Extraction (Fast)

```typescript
import { extractText } from "pdfnode";

const text = await extractText("document.pdf");
console.log(`Extracted ${text.length} characters`);
```

### Images-Only Extraction

```typescript
import { extractImages } from "pdfnode";

const images = await extractImages("document.pdf", {
  extractImageFiles: true,
  imageOutputDir: "./my-images",
});

console.log(`Found ${images.length} images`);
```

### Custom Image References

```typescript
import { extractPdfContent } from "pdfnode";

const result = await extractPdfContent("document.pdf", {
  imageRefFormat: "📷 Image {index} on page {page}",
  extractImageFiles: true,
  useImagePaths: true,
});

// Text will contain: "📷 Image 1 on page 1" instead of "[IMAGE:img_1]"
```

### Advanced Configuration

```typescript
import { PDFExtractor } from "pdfnode";

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
import { extractPdfContent } from "pdfnode";
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
import { PDFExtractor } from "pdfnode";
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
}
```

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
import { extractPdfContent } from "pdfnode";

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

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

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
import { extractPdfContent } from "pdfnode";

// CommonJS
const { extractPdfContent } = require("pdfnode");
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

- Check the [Issues](https://github.com/kauandotnet/pdfnode/issues) page
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
