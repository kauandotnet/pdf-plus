# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
