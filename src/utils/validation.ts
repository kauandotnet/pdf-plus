import fs from 'node:fs';
import path from 'node:path';
import type { ExtractorConfig, ValidationError } from '../types/index.js';

/**
 * Validate extractor configuration
 */
export function validateConfig(config: ExtractorConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate PDF path
  if (!config.pdfPath) {
    errors.push({
      field: 'pdfPath',
      message: 'PDF path is required',
      value: config.pdfPath,
    });
  } else if (typeof config.pdfPath !== 'string') {
    errors.push({
      field: 'pdfPath',
      message: 'PDF path must be a string',
      value: config.pdfPath,
    });
  } else if (!fs.existsSync(config.pdfPath)) {
    errors.push({
      field: 'pdfPath',
      message: 'PDF file does not exist',
      value: config.pdfPath,
    });
  } else if (!config.pdfPath.toLowerCase().endsWith('.pdf')) {
    errors.push({
      field: 'pdfPath',
      message: 'File must have .pdf extension',
      value: config.pdfPath,
    });
  }

  // Validate output directory
  if (config.outputDir && typeof config.outputDir !== 'string') {
    errors.push({
      field: 'outputDir',
      message: 'Output directory must be a string',
      value: config.outputDir,
    });
  }

  // Validate options
  if (config.options) {
    const { options } = config;

    // Validate extractText
    if (options.extractText !== undefined && typeof options.extractText !== 'boolean') {
      errors.push({
        field: 'options.extractText',
        message: 'extractText must be a boolean',
        value: options.extractText,
      });
    }

    // Validate extractImages
    if (options.extractImages !== undefined && typeof options.extractImages !== 'boolean') {
      errors.push({
        field: 'options.extractImages',
        message: 'extractImages must be a boolean',
        value: options.extractImages,
      });
    }

    // Validate extractImageFiles
    if (options.extractImageFiles !== undefined && typeof options.extractImageFiles !== 'boolean') {
      errors.push({
        field: 'options.extractImageFiles',
        message: 'extractImageFiles must be a boolean',
        value: options.extractImageFiles,
      });
    }

    // Validate useImagePaths
    if (options.useImagePaths !== undefined && typeof options.useImagePaths !== 'boolean') {
      errors.push({
        field: 'options.useImagePaths',
        message: 'useImagePaths must be a boolean',
        value: options.useImagePaths,
      });
    }

    // Validate imageOutputDir
    if (options.imageOutputDir && typeof options.imageOutputDir !== 'string') {
      errors.push({
        field: 'options.imageOutputDir',
        message: 'imageOutputDir must be a string',
        value: options.imageOutputDir,
      });
    }

    // Validate imageRefFormat
    if (options.imageRefFormat && typeof options.imageRefFormat !== 'string') {
      errors.push({
        field: 'options.imageRefFormat',
        message: 'imageRefFormat must be a string',
        value: options.imageRefFormat,
      });
    }

    // Validate baseName
    if (options.baseName && typeof options.baseName !== 'string') {
      errors.push({
        field: 'options.baseName',
        message: 'baseName must be a string',
        value: options.baseName,
      });
    }

    // Validate verbose
    if (options.verbose !== undefined && typeof options.verbose !== 'boolean') {
      errors.push({
        field: 'options.verbose',
        message: 'verbose must be a boolean',
        value: options.verbose,
      });
    }

    // Validate memoryLimit
    if (options.memoryLimit && typeof options.memoryLimit !== 'string') {
      errors.push({
        field: 'options.memoryLimit',
        message: 'memoryLimit must be a string',
        value: options.memoryLimit,
      });
    } else if (options.memoryLimit && !isValidMemoryLimit(options.memoryLimit)) {
      errors.push({
        field: 'options.memoryLimit',
        message: 'memoryLimit must be in format like "512MB", "1GB", etc.',
        value: options.memoryLimit,
      });
    }

    // Validate batchSize
    if (options.batchSize !== undefined) {
      if (typeof options.batchSize !== 'number') {
        errors.push({
          field: 'options.batchSize',
          message: 'batchSize must be a number',
          value: options.batchSize,
        });
      } else if (options.batchSize < 1 || options.batchSize > 100) {
        errors.push({
          field: 'options.batchSize',
          message: 'batchSize must be between 1 and 100',
          value: options.batchSize,
        });
      }
    }

    // Validate progressCallback
    if (options.progressCallback && typeof options.progressCallback !== 'function') {
      errors.push({
        field: 'options.progressCallback',
        message: 'progressCallback must be a function',
        value: typeof options.progressCallback,
      });
    }

    // Logical validations
    if (options.extractText === false && options.extractImages === false) {
      errors.push({
        field: 'options',
        message: 'At least one of extractText or extractImages must be true',
        value: { extractText: options.extractText, extractImages: options.extractImages },
      });
    }

    if (options.useImagePaths === true && options.extractImageFiles !== true) {
      errors.push({
        field: 'options',
        message: 'useImagePaths requires extractImageFiles to be true',
        value: { useImagePaths: options.useImagePaths, extractImageFiles: options.extractImageFiles },
      });
    }
  }

  return errors;
}

/**
 * Validate memory limit format
 */
function isValidMemoryLimit(limit: string): boolean {
  const pattern = /^\d+(\.\d+)?(MB|GB|KB)$/i;
  return pattern.test(limit);
}

/**
 * Validate image reference format
 */
export function validateImageRefFormat(format: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const validPlaceholders = ['{id}', '{name}', '{page}', '{index}', '{path}'];
  
  // Check if format contains at least one valid placeholder
  const hasValidPlaceholder = validPlaceholders.some(placeholder => format.includes(placeholder));
  
  if (!hasValidPlaceholder) {
    errors.push({
      field: 'imageRefFormat',
      message: `Format must contain at least one valid placeholder: ${validPlaceholders.join(', ')}`,
      value: format,
    });
  }

  // Check for invalid placeholders
  const placeholderPattern = /\{([^}]+)\}/g;
  const matches = format.match(placeholderPattern);
  
  if (matches) {
    for (const match of matches) {
      if (!validPlaceholders.includes(match)) {
        errors.push({
          field: 'imageRefFormat',
          message: `Invalid placeholder: ${match}. Valid placeholders are: ${validPlaceholders.join(', ')}`,
          value: format,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate file path
 */
export function validateFilePath(filePath: string, extensions: string[] = ['.pdf']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!filePath) {
    errors.push({
      field: 'filePath',
      message: 'File path is required',
      value: filePath,
    });
    return errors;
  }

  if (typeof filePath !== 'string') {
    errors.push({
      field: 'filePath',
      message: 'File path must be a string',
      value: filePath,
    });
    return errors;
  }

  if (!fs.existsSync(filePath)) {
    errors.push({
      field: 'filePath',
      message: 'File does not exist',
      value: filePath,
    });
    return errors;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (extensions.length > 0 && !extensions.includes(ext)) {
    errors.push({
      field: 'filePath',
      message: `File must have one of these extensions: ${extensions.join(', ')}`,
      value: filePath,
    });
  }

  return errors;
}
