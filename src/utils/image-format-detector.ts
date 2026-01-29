/**
 * Image Format Detection Utility
 *
 * Centralized image format detection using magic bytes and MIME type mappings.
 * Eliminates duplicated detection logic across the codebase.
 */

/**
 * Image format signature configuration
 */
interface ImageSignature {
  readonly bytes: readonly number[];
  readonly mimeType: string;
  readonly extension: string;
  readonly formatName: string;
}

/**
 * Image format detection result
 */
export interface ImageFormatResult {
  readonly valid: boolean;
  readonly mimeType?: string;
  readonly extension?: string;
  readonly formatName?: string;
}

/**
 * Magic byte signatures for common image formats
 * Order matters - check longer signatures first (like JP2)
 */
const IMAGE_SIGNATURES: ReadonlyArray<
  readonly [string, ImageSignature]
> = Object.freeze([
  // JPEG 2000 (JP2) - check first due to longer signature
  [
    "jp2",
    {
      bytes: [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20],
      mimeType: "image/jp2",
      extension: "jp2",
      formatName: "JPEG 2000",
    },
  ],
  // PNG
  [
    "png",
    {
      bytes: [0x89, 0x50, 0x4e, 0x47],
      mimeType: "image/png",
      extension: "png",
      formatName: "PNG",
    },
  ],
  // JPEG
  [
    "jpeg",
    {
      bytes: [0xff, 0xd8],
      mimeType: "image/jpeg",
      extension: "jpg",
      formatName: "JPEG",
    },
  ],
  // GIF
  [
    "gif",
    {
      bytes: [0x47, 0x49, 0x46],
      mimeType: "image/gif",
      extension: "gif",
      formatName: "GIF",
    },
  ],
  // TIFF (Little Endian)
  [
    "tiff_le",
    {
      bytes: [0x49, 0x49],
      mimeType: "image/tiff",
      extension: "tiff",
      formatName: "TIFF",
    },
  ],
  // TIFF (Big Endian)
  [
    "tiff_be",
    {
      bytes: [0x4d, 0x4d],
      mimeType: "image/tiff",
      extension: "tiff",
      formatName: "TIFF",
    },
  ],
]);

/**
 * MIME type to format name mapping
 */
const MIME_TO_FORMAT = new Map<string, string>([
  ["image/jpeg", "JPEG"],
  ["image/png", "PNG"],
  ["image/jp2", "JPEG 2000"],
  ["image/gif", "GIF"],
  ["image/tiff", "TIFF"],
]);

/**
 * Format name to MIME type mapping (reverse lookup)
 */
const FORMAT_TO_MIME = new Map<string, string>([
  ["JPEG", "image/jpeg"],
  ["PNG", "image/png"],
  ["JPEG 2000", "image/jp2"],
  ["GIF", "image/gif"],
  ["TIFF", "image/tiff"],
]);

/**
 * Check if data starts with the given signature bytes
 */
function matchesSignature(
  data: Buffer,
  signature: readonly number[]
): boolean {
  if (data.length < signature.length) return false;

  for (let i = 0; i < signature.length; i++) {
    if (data[i] !== signature[i]) return false;
  }

  return true;
}

/**
 * Detect image format from binary data using magic bytes
 *
 * @param data - Buffer containing image data
 * @returns Detection result with format info if valid
 *
 * @example
 * ```typescript
 * const result = detectImageFormat(buffer);
 * if (result.valid) {
 *   console.log(`Format: ${result.formatName}, MIME: ${result.mimeType}`);
 * }
 * ```
 */
export function detectImageFormat(data: Buffer): ImageFormatResult {
  // Minimum data required for detection
  if (!data || data.length < 10) {
    return { valid: false };
  }

  // Check each signature in order (longer signatures first)
  for (const [, signature] of IMAGE_SIGNATURES) {
    if (matchesSignature(data, signature.bytes)) {
      return {
        valid: true,
        mimeType: signature.mimeType,
        extension: signature.extension,
        formatName: signature.formatName,
      };
    }
  }

  return { valid: false };
}

/**
 * Get format name from MIME type
 *
 * @param mimeType - MIME type string (e.g., "image/jpeg")
 * @returns Format name (e.g., "JPEG") or "unknown"
 *
 * @example
 * ```typescript
 * getFormatFromMimeType("image/jpeg"); // "JPEG"
 * getFormatFromMimeType("image/png");  // "PNG"
 * getFormatFromMimeType("unknown");    // "unknown"
 * ```
 */
export function getFormatFromMimeType(mimeType: string): string {
  return MIME_TO_FORMAT.get(mimeType) ?? "unknown";
}

/**
 * Get MIME type from format name
 *
 * @param formatName - Format name (e.g., "JPEG")
 * @returns MIME type string or undefined
 */
export function getMimeTypeFromFormat(formatName: string): string | undefined {
  return FORMAT_TO_MIME.get(formatName);
}

/**
 * Get file extension from MIME type
 *
 * @param mimeType - MIME type string
 * @returns File extension without dot (e.g., "jpg") or "bin"
 */
export function getExtensionFromMimeType(mimeType: string): string {
  for (const [, signature] of IMAGE_SIGNATURES) {
    if (signature.mimeType === mimeType) {
      return signature.extension;
    }
  }
  return "bin";
}

/**
 * Check if a MIME type represents an image
 *
 * @param mimeType - MIME type to check
 * @returns true if it's a known image MIME type
 */
export function isImageMimeType(mimeType: string): boolean {
  return MIME_TO_FORMAT.has(mimeType);
}
