# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.2] - 2025-10-07

### Fixed

- **Dependency Management**: Fixed and optimized project dependencies
  - Fixed `pdfjs-dist` version to `5.4.149` (removed caret to prevent automatic updates)
  - Removed unused `canvas-5-polyfill` dependency (not used anywhere in codebase)
  - Kept `pdf-lib` (actively used in PDF processing engines)
  - Kept `canvas` (required for page-to-image conversion functionality)

### Technical Improvements

- **Bundle Size Optimization**: Reduced package size by removing unused dependencies
- **Version Stability**: Fixed pdfjs-dist to specific version to prevent breaking changes from automatic updates
- **Dependency Audit**: Comprehensive review and cleanup of all dependencies

## [1.2.1] - 2025-10-07

### Fixed

- **Code Quality Improvements**: Enhanced code maintainability and performance
  - Changed `actualHeight` to `const` in pdf-lib-engine for better immutability
  - Converted instance methods to static methods in ImageOptimizer and ParallelProcessor classes
  - Replaced `Math.pow()` with modern exponentiation operator (`**`) in functional utilities
  - Fixed page splitting logic to preserve empty pages for correct page numbering
  - Added comprehensive comments for page marker splitting algorithm

### Technical Improvements

- **Static Method Optimization**: Improved memory usage by converting appropriate instance methods to static
- **Modern JavaScript**: Updated to use ES2016+ exponentiation operator for better performance
- **Page Processing**: Enhanced structured data generation to handle image-only pages correctly

## [1.2.0] - 2025-10-06

### Added

- **Poppler Fallback Support**: New `usePopplerFallback` option for comprehensive image extraction
  - Automatically falls back to Poppler's `pdfimages` when standard extraction finds no images
  - Can extract images embedded as Form XObjects, inline images, and other non-standard formats
  - Requires `poppler-utils` system dependency (optional fallback)
  - Maintains full backward compatibility with existing extraction methods

### Features

- **PopplerImageExtractor**: New dedicated class for Poppler-based image extraction
  - Supports all native image formats (JPEG, JP2, PNG, TIFF, etc.)
  - Preserves original image quality and metadata
  - Intelligent file naming with page and image numbering
  - Comprehensive error handling and cleanup

### Technical Details

- Lazy-loaded Poppler integration to avoid breaking existing installations
- Graceful fallback when Poppler is not available
- Temporary file management with automatic cleanup
- Enhanced verbose logging for debugging extraction issues

## [1.0.3] - 2025-10-02

### Fixed

- **Critical Fix**: Pages 27+ appearing "empty" when not explicitly setting `includePageMarkers` option
  - **Root cause**: Without page markers, text was returned as one continuous block, making it impossible to identify page boundaries
  - **Solution**: Default `includePageMarkers` to `true` to ensure clear page separation
  - **Impact**: All pages are now properly accessible by default
  - Users can still opt-out by explicitly setting `includePageMarkers: false`

### Changed

- **Breaking Change**: `includePageMarkers` now defaults to `true` (was `undefined`/`false`)
  - This ensures page boundaries are clear by default
  - Text output now includes page markers like `--- PAGE 1 ---` by default
  - To get continuous text without markers, explicitly set `includePageMarkers: false`

### Added

- Comprehensive test suite for page extraction verification
- Tests for all extraction modes: text-only, images-only, combined, and structured data
- Verification that all pages (including 27+) are properly populated

## [1.0.2] - 2025-10-01

### Added

- Initial release of pdf-plus
- Comprehensive PDF content extraction with text and image support
- Multiple extraction engines (pdf-lib, poppler)
- TypeScript support with full type definitions
- Both CommonJS and ESM module support
- Configurable image reference formats
- Page-specific extraction capabilities
- Caching system for performance optimization
- Structured data generation
- Comprehensive test suite
- GitHub Actions CI/CD pipeline
- Automated dependency updates via Dependabot

### Features

- **Text Extraction**: High-quality text extraction with positioning information
- **Image Detection**: Detect and reference images in PDF content
- **Image File Extraction**: Extract actual image files from PDFs
- **Flexible Formatting**: Customizable image reference formats
- **Performance Options**: Text-only, images-only, or combined extraction modes
- **TypeScript Support**: Full TypeScript definitions included
- **Robust Validation**: Comprehensive input validation and error handling
- **Multiple Engines**: Auto-selection of best available extraction engine
- **Streaming Support**: Memory-efficient processing for large documents
- **Page-aware Processing**: Accurate page number alignment between text and images

### Technical Details

- Built with TypeScript 5.9+
- Uses tsup for dual CJS/ESM builds
- Comprehensive JSDoc documentation
- Biome for linting and formatting
- Vitest for testing with coverage
- Node.js 18+ support
- Zero global polyfills for clean integration

## [1.0.0] - 2024-09-25

### Added

- Initial public release
- Core PDF extraction functionality
- Documentation and examples
- CI/CD pipeline setup
- Package publishing configuration

---

## Release Process

1. Update version in `package.json`
2. Update this CHANGELOG.md
3. Create a git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will automatically build and publish to npm

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.
