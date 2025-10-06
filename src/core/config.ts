/**
 * Configuration management for PDF extraction
 * 
 * Provides immutable configuration with sensible defaults
 * and validation.
 */

import type { ExtractionOptions } from '../types/index.js';
import { deepFreeze } from '../utils/functional.js';

/**
 * Default extraction options
 */
const DEFAULT_OPTIONS: Readonly<Required<Pick<ExtractionOptions, 
  'extractText' | 'extractImages' | 'extractImageFiles' | 'useImagePaths' | 
  'imageRefFormat' | 'verbose' | 'includePageMarkers' | 'pageMarkerFormat'
>>> = deepFreeze({
  extractText: true,
  extractImages: true,
  extractImageFiles: false,
  useImagePaths: false,
  imageRefFormat: '[IMAGE:{id}]',
  verbose: false,
  includePageMarkers: true,
  pageMarkerFormat: '--- PAGE {page} ---',
});

/**
 * Normalized extraction configuration
 */
export interface ExtractionConfig {
  readonly pdfPath: string;
  readonly outputDir: string;
  readonly options: Readonly<ExtractionOptions>;
}

/**
 * Create normalized configuration with defaults
 */
export const createConfig = (
  pdfPath: string,
  options: ExtractionOptions = {}
): ExtractionConfig => {
  const normalizedOptions: ExtractionOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const outputDir = options.imageOutputDir ?? './extracted-images';

  return deepFreeze({
    pdfPath,
    outputDir,
    options: normalizedOptions,
  });
};

/**
 * Get total pages from extraction data
 */
export const getTotalPages = (
  imageData: { totalPages?: number } | null,
  textData: { numPages?: number } | null
): number => {
  return imageData?.totalPages ?? textData?.numPages ?? 0;
};

/**
 * Get page numbers to process
 */
export const getPageNumbers = (
  totalPages: number,
  requestedPages?: readonly number[]
): readonly number[] => {
  if (requestedPages && requestedPages.length > 0) {
    return requestedPages;
  }
  
  return Array.from({ length: totalPages }, (_, i) => i + 1);
};

/**
 * Check if page images should be generated
 */
export const shouldGeneratePageImages = (
  options: Readonly<ExtractionOptions>
): boolean => {
  return options.generatePageImages === true;
};

/**
 * Check if thumbnails should be generated
 */
export const shouldGenerateThumbnails = (
  options: Readonly<ExtractionOptions>
): boolean => {
  return options.generateThumbnails === true;
};

/**
 * Check if structured data should be generated
 */
export const shouldGenerateStructuredData = (
  options: Readonly<ExtractionOptions>
): boolean => {
  return options.generateStructuredData === true;
};

/**
 * Check if text items should be extracted
 */
export const shouldExtractTextItems = (
  options: Readonly<ExtractionOptions>
): boolean => {
  return options.extractTextItems === true && options.extractText === true;
};

/**
 * Check if page markers should be included
 */
export const shouldIncludePageMarkers = (
  options: Readonly<ExtractionOptions>
): boolean => {
  return options.includePageMarkers === true || options.includeImageRefs === true;
};

