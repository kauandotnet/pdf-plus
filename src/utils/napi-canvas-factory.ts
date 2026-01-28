/**
 * Custom Canvas Factory for pdf.js using @napi-rs/canvas
 *
 * Provides a canvas factory implementation compatible with pdf.js
 * that uses @napi-rs/canvas instead of node-canvas.
 *
 * Also provides utility functions for raw pixel data to image conversion,
 * replacing pngjs and jimp dependencies.
 *
 * Benefits:
 * - Zero system dependencies (no libcairo, libpango, etc.)
 * - ~10% better performance (Skia-based)
 * - Simpler deployment (prebuilt binaries)
 * - Async encoding via libuv thread pool
 */

import {
  createCanvas,
  type Canvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";

export interface CanvasAndContext {
  canvas: Canvas;
  context: SKRSContext2D;
}

/**
 * Canvas factory for pdf.js that uses @napi-rs/canvas
 *
 * This factory is passed to pdf.js getDocument() options to override
 * the default canvas creation behavior.
 */
export class NapiCanvasFactory {
  /**
   * Create a new canvas with the specified dimensions
   *
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   * @returns Canvas and 2D context
   */
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  /**
   * Reset an existing canvas to new dimensions
   *
   * @param canvasAndContext - Existing canvas and context
   * @param width - New width in pixels
   * @param height - New height in pixels
   */
  reset(
    canvasAndContext: CanvasAndContext,
    width: number,
    height: number
  ): void {
    canvasAndContext.canvas.width = Math.ceil(width);
    canvasAndContext.canvas.height = Math.ceil(height);
  }

  /**
   * Destroy a canvas (cleanup)
   *
   * @napi-rs/canvas handles memory cleanup automatically,
   * but we keep this method for pdf.js compatibility
   *
   * @param canvasAndContext - Canvas and context to destroy
   */
  destroy(_canvasAndContext: CanvasAndContext): void {
    // @napi-rs/canvas handles cleanup automatically via Rust's RAII
    // No explicit cleanup needed
  }
}

/**
 * Singleton instance of the canvas factory
 */
export const napiCanvasFactory = new NapiCanvasFactory();

/**
 * Convert raw RGBA pixel data to PNG buffer using @napi-rs/canvas
 *
 * Replaces pngjs dependency for raw pixel → PNG conversion.
 *
 * @param rgbaData - Raw RGBA pixel data (4 bytes per pixel)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns PNG buffer
 */
export function rawRgbaToPng(
  rgbaData: Buffer | Uint8Array,
  width: number,
  height: number
): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Create ImageData and put it on canvas
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgbaData);
  ctx.putImageData(imageData, 0, 0);

  return canvas.toBuffer("image/png");
}

/**
 * Convert raw RGBA pixel data to JPEG buffer using @napi-rs/canvas
 *
 * Replaces jimp dependency for raw pixel → JPEG conversion.
 *
 * @param rgbaData - Raw RGBA pixel data (4 bytes per pixel)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param quality - JPEG quality (0-100)
 * @returns Promise<Buffer> - JPEG buffer
 */
export async function rawRgbaToJpeg(
  rgbaData: Buffer | Uint8Array,
  width: number,
  height: number,
  quality: number = 90
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Create ImageData and put it on canvas
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgbaData);
  ctx.putImageData(imageData, 0, 0);

  // Use async encode for quality control
  return Buffer.from(await canvas.encode("jpeg", quality));
}

/**
 * Convert grayscale pixel data to RGBA
 *
 * @param grayData - Grayscale pixel data (1 byte per pixel)
 * @param width - Image width
 * @param height - Image height
 * @returns RGBA buffer (4 bytes per pixel)
 */
export function grayscaleToRgba(
  grayData: Buffer | Uint8Array,
  width: number,
  height: number
): Buffer {
  const rgbaData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const gray = grayData[i] || 0;
    const offset = i * 4;
    rgbaData[offset] = gray; // R
    rgbaData[offset + 1] = gray; // G
    rgbaData[offset + 2] = gray; // B
    rgbaData[offset + 3] = 255; // A
  }
  return rgbaData;
}

/**
 * Convert RGB pixel data to RGBA
 *
 * @param rgbData - RGB pixel data (3 bytes per pixel)
 * @param width - Image width
 * @param height - Image height
 * @returns RGBA buffer (4 bytes per pixel)
 */
export function rgbToRgba(
  rgbData: Buffer | Uint8Array,
  width: number,
  height: number
): Buffer {
  const rgbaData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const inputOffset = i * 3;
    const outputOffset = i * 4;
    rgbaData[outputOffset] = rgbData[inputOffset] || 0; // R
    rgbaData[outputOffset + 1] = rgbData[inputOffset + 1] || 0; // G
    rgbaData[outputOffset + 2] = rgbData[inputOffset + 2] || 0; // B
    rgbaData[outputOffset + 3] = 255; // A
  }
  return rgbaData;
}

/**
 * Convert CMYK pixel data to RGBA
 *
 * @param cmykData - CMYK pixel data (4 bytes per pixel)
 * @param width - Image width
 * @param height - Image height
 * @returns RGBA buffer (4 bytes per pixel)
 */
export function cmykToRgba(
  cmykData: Buffer | Uint8Array,
  width: number,
  height: number
): Buffer {
  const rgbaData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const inputOffset = i * 4;
    const c = (cmykData[inputOffset] || 0) / 255;
    const m = (cmykData[inputOffset + 1] || 0) / 255;
    const y = (cmykData[inputOffset + 2] || 0) / 255;
    const k = (cmykData[inputOffset + 3] || 0) / 255;

    const outputOffset = i * 4;
    rgbaData[outputOffset] = Math.round(255 * (1 - c) * (1 - k)); // R
    rgbaData[outputOffset + 1] = Math.round(255 * (1 - m) * (1 - k)); // G
    rgbaData[outputOffset + 2] = Math.round(255 * (1 - y) * (1 - k)); // B
    rgbaData[outputOffset + 3] = 255; // A
  }
  return rgbaData;
}

/**
 * Convert raw pixel data to PNG based on color space
 *
 * This is a convenience function that handles color space conversion
 * and PNG encoding in one step.
 *
 * @param rawData - Raw pixel data
 * @param width - Image width
 * @param height - Image height
 * @param componentsPerPixel - 1 (grayscale), 3 (RGB), or 4 (CMYK/RGBA)
 * @param isCmyk - If componentsPerPixel is 4, whether it's CMYK (true) or RGBA (false)
 * @returns PNG buffer or null if unsupported
 */
export function rawPixelsToPng(
  rawData: Buffer | Uint8Array,
  width: number,
  height: number,
  componentsPerPixel: number,
  isCmyk: boolean = false
): Buffer | null {
  let rgbaData: Buffer;

  if (componentsPerPixel === 1) {
    rgbaData = grayscaleToRgba(rawData, width, height);
  } else if (componentsPerPixel === 3) {
    rgbaData = rgbToRgba(rawData, width, height);
  } else if (componentsPerPixel === 4) {
    if (isCmyk) {
      rgbaData = cmykToRgba(rawData, width, height);
    } else {
      // Already RGBA
      rgbaData = Buffer.from(rawData);
    }
  } else {
    return null;
  }

  return rawRgbaToPng(rgbaData, width, height);
}
