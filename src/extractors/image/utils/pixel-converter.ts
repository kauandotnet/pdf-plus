/**
 * High-performance pixel format converter
 * Optimized for speed with direct buffer manipulation
 */

/**
 * Color space configuration
 */
interface ColorSpaceConfig {
  readonly componentsPerPixel: number;
  readonly colorType: number;
}

/**
 * Pixel converter with optimized buffer operations
 */
export class PixelConverter {
  private readonly width: number;
  private readonly height: number;
  private readonly totalPixels: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.totalPixels = width * height;
  }

  /**
   * Detect color space from PDF metadata
   */
  static detectColorSpace(colorSpaceStr: string): ColorSpaceConfig {
    if (colorSpaceStr.includes("DeviceGray") || colorSpaceStr.includes("Gray")) {
      return { componentsPerPixel: 1, colorType: 0 }; // Grayscale
    }
    if (colorSpaceStr.includes("DeviceRGB") || colorSpaceStr.includes("RGB")) {
      return { componentsPerPixel: 3, colorType: 2 }; // RGB
    }
    if (colorSpaceStr.includes("DeviceCMYK") || colorSpaceStr.includes("CMYK")) {
      return { componentsPerPixel: 4, colorType: 2 }; // CMYK (will convert to RGB)
    }
    return { componentsPerPixel: 3, colorType: 2 }; // Default RGB
  }

  /**
   * Convert pixel data to RGBA format
   */
  convertToRGBA(
    rawData: Buffer,
    componentsPerPixel: number
  ): Buffer | null {
    switch (componentsPerPixel) {
      case 1:
        return this.grayscaleToRGBA(rawData);
      case 3:
        return this.rgbToRGBA(rawData);
      case 4:
        return this.cmykToRGB(rawData);
      default:
        return null;
    }
  }

  /**
   * Convert grayscale to RGBA
   * Optimized with direct buffer writes
   */
  private grayscaleToRGBA(rawData: Buffer): Buffer {
    const output = Buffer.allocUnsafe(this.totalPixels * 4);

    for (let i = 0; i < this.totalPixels; i++) {
      const gray = rawData[i] ?? 0;
      const offset = i * 4;
      output[offset] = gray;     // R
      output[offset + 1] = gray; // G
      output[offset + 2] = gray; // B
      output[offset + 3] = 255;  // A
    }

    return output;
  }

  /**
   * Convert RGB to RGBA
   * Optimized with direct buffer writes
   */
  private rgbToRGBA(rawData: Buffer): Buffer {
    const output = Buffer.allocUnsafe(this.totalPixels * 4);

    for (let i = 0; i < this.totalPixels; i++) {
      const inputOffset = i * 3;
      const outputOffset = i * 4;
      output[outputOffset] = rawData[inputOffset] ?? 0;         // R
      output[outputOffset + 1] = rawData[inputOffset + 1] ?? 0; // G
      output[outputOffset + 2] = rawData[inputOffset + 2] ?? 0; // B
      output[outputOffset + 3] = 255;                           // A
    }

    return output;
  }

  /**
   * Convert CMYK to RGB
   * Optimized with direct buffer writes and simplified conversion
   */
  private cmykToRGB(rawData: Buffer): Buffer {
    const output = Buffer.allocUnsafe(this.totalPixels * 4);

    for (let i = 0; i < this.totalPixels; i++) {
      const inputOffset = i * 4;
      const c = (rawData[inputOffset] ?? 0) / 255;
      const m = (rawData[inputOffset + 1] ?? 0) / 255;
      const y = (rawData[inputOffset + 2] ?? 0) / 255;
      const k = (rawData[inputOffset + 3] ?? 0) / 255;

      const outputOffset = i * 4;
      output[outputOffset] = Math.round(255 * (1 - c) * (1 - k));     // R
      output[outputOffset + 1] = Math.round(255 * (1 - m) * (1 - k)); // G
      output[outputOffset + 2] = Math.round(255 * (1 - y) * (1 - k)); // B
      output[outputOffset + 3] = 255;                                 // A
    }

    return output;
  }
}

