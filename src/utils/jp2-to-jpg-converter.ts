/**
 * JP2 to JPG Converter
 *
 * Converts JPEG 2000 (JP2) images to JPEG format using OpenJPEG WASM decoder.
 * Supports @napi-rs/canvas (default) and Sharp (optional, better color preservation).
 */

import fs from "node:fs";
import path from "node:path";
import { rawRgbaToJpeg, rgbToRgba } from "./napi-canvas-factory.js";
import { getSharp, isSharpAvailable } from "./sharp-detector.js";

/**
 * Conversion result interface
 */
interface ConversionResult {
  success: boolean;
  newPath?: string;
  originalSize?: number;
  newSize?: number;
  error?: string;
}

/**
 * Conversion options interface
 */
interface ConversionOptions {
  quality?: number;
  verbose?: boolean;
  deleteOriginal?: boolean;
  useSharp?: boolean;
}

/**
 * Cached OpenJPEG WASM instance to avoid memory leaks from multiple initializations
 */
let cachedOpenjpeg: any = null;

/**
 * Get or initialize the OpenJPEG WASM instance (singleton pattern)
 * Suppresses OpenJPEG's [INFO] logs by overriding print/printErr functions
 */
async function getOpenjpeg(): Promise<any> {
  if (!cachedOpenjpeg) {
    const openjpegModule = await import("@cornerstonejs/codec-openjpeg");

    // Suppress OpenJPEG's [INFO] logs by providing custom print functions
    cachedOpenjpeg = await openjpegModule.default({
      print: () => {}, // Suppress stdout (INFO messages)
      printErr: () => {}, // Suppress stderr (error messages)
    });
  }
  return cachedOpenjpeg;
}

/**
 * Convert JP2 image to JPG using OpenJPEG WASM decoder + @napi-rs/canvas
 *
 * @param jp2Path - Path to the JP2 file
 * @param options - Conversion options
 * @returns Conversion result with new file path
 */
export async function convertJp2ToJpgWasm(
  jp2Path: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const quality = options.quality !== undefined ? options.quality : 100;
  const verbose = options.verbose !== undefined ? options.verbose : false;
  const deleteOriginal =
    options.deleteOriginal !== undefined ? options.deleteOriginal : true;

  if (!fs.existsSync(jp2Path)) {
    return {
      success: false,
      error: `File not found: ${jp2Path}`,
    };
  }

  try {
    const originalSize = fs.statSync(jp2Path).size;
    const jpgPath = jp2Path.replace(/\.jp2$/i, ".jpg");

    if (verbose) {
      console.log(
        `   🔄 Converting JP2 to JPG: ${path.basename(
          jp2Path
        )} (quality: ${quality})`
      );
    }

    // Read JP2 file
    const jp2Data = fs.readFileSync(jp2Path);

    // Get cached OpenJPEG WASM instance (singleton to avoid memory leaks)
    const openjpeg = await getOpenjpeg();

    if (verbose) {
      console.log(`   📦 Using OpenJPEG WASM decoder + @napi-rs/canvas`);
    }

    // Create decoder instance
    const decoder = new openjpeg.J2KDecoder();

    // Get encoded buffer and copy JP2 data
    const encodedBuffer = decoder.getEncodedBuffer(jp2Data.length);
    encodedBuffer.set(jp2Data);

    // Decode JP2
    decoder.decode();

    // Get decoded buffer and frame info
    const decodedBuffer = decoder.getDecodedBuffer();
    const frameInfo = decoder.getFrameInfo();

    if (verbose) {
      console.log(
        `   🖼️  Decoded: ${frameInfo.width}x${frameInfo.height}, ${frameInfo.bitsPerSample} bits, ${frameInfo.componentCount} components`
      );
    }

    // Convert to RGBA if needed (OpenJPEG returns RGB for 3-component images)
    let rgbaData: Buffer;
    if (frameInfo.componentCount === 3) {
      rgbaData = rgbToRgba(
        Buffer.from(decodedBuffer),
        frameInfo.width,
        frameInfo.height
      );
    } else if (frameInfo.componentCount === 4) {
      // Already RGBA
      rgbaData = Buffer.from(decodedBuffer);
    } else {
      // Grayscale - expand to RGBA
      const grayData = Buffer.from(decodedBuffer);
      rgbaData = Buffer.alloc(frameInfo.width * frameInfo.height * 4);
      for (let i = 0; i < frameInfo.width * frameInfo.height; i++) {
        const gray = grayData[i] || 0;
        rgbaData[i * 4] = gray;
        rgbaData[i * 4 + 1] = gray;
        rgbaData[i * 4 + 2] = gray;
        rgbaData[i * 4 + 3] = 255;
      }
    }

    // Convert to JPEG using @napi-rs/canvas
    const jpegBuffer = await rawRgbaToJpeg(
      rgbaData,
      frameInfo.width,
      frameInfo.height,
      quality
    );

    // Write JPEG file
    fs.writeFileSync(jpgPath, jpegBuffer);

    const newSize = fs.statSync(jpgPath).size;

    // Delete original JP2 file if requested
    if (deleteOriginal) {
      fs.unlinkSync(jp2Path);
    }

    if (verbose) {
      console.log(
        `   ✅ Converted: ${path.basename(
          jpgPath
        )} (${originalSize} → ${newSize} bytes)`
      );
    }

    return {
      success: true,
      newPath: jpgPath,
      originalSize,
      newSize,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Conversion failed: ${error.message}`,
    };
  }
}

/**
 * Convert JP2 image to JPG using OpenJPEG WASM decoder + Sharp (Better Color Preservation)
 *
 * Requires Sharp to be installed as an optional dependency.
 * Provides better color space handling than Jimp.
 *
 * @param jp2Path - Path to the JP2 file
 * @param options - Conversion options
 * @returns Conversion result with new file path
 */
export async function convertJp2ToJpgSharp(
  jp2Path: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const quality = options.quality !== undefined ? options.quality : 100;
  const verbose = options.verbose !== undefined ? options.verbose : false;
  const deleteOriginal =
    options.deleteOriginal !== undefined ? options.deleteOriginal : true;

  if (!fs.existsSync(jp2Path)) {
    return {
      success: false,
      error: `File not found: ${jp2Path}`,
    };
  }

  try {
    const originalSize = fs.statSync(jp2Path).size;
    const jpgPath = jp2Path.replace(/\.jp2$/i, ".jpg");

    if (verbose) {
      console.log(
        `   🔄 Converting JP2 to JPG: ${path.basename(
          jp2Path
        )} (quality: ${quality}, engine: Sharp)`
      );
    }

    // Read JP2 file
    const jp2Data = fs.readFileSync(jp2Path);

    // Get cached OpenJPEG WASM instance (singleton to avoid memory leaks)
    const openjpeg = await getOpenjpeg();

    if (verbose) {
      console.log(`   📦 Using OpenJPEG WASM decoder + Sharp`);
    }

    // Create decoder instance
    const decoder = new openjpeg.J2KDecoder();

    // Get encoded buffer and copy JP2 data
    const encodedBuffer = decoder.getEncodedBuffer(jp2Data.length);
    encodedBuffer.set(jp2Data);

    // Decode JP2
    decoder.decode();

    // Get decoded buffer and frame info
    const decodedBuffer = decoder.getDecodedBuffer();
    const frameInfo = decoder.getFrameInfo();

    if (verbose) {
      console.log(
        `   🖼️  Decoded: ${frameInfo.width}x${frameInfo.height}, ${frameInfo.bitsPerSample} bits, ${frameInfo.componentCount} components`
      );
    }

    // Get Sharp module
    const sharp = await getSharp();
    if (!sharp) {
      throw new Error("Sharp module not available");
    }

    // Convert decoded buffer to proper format for Sharp
    // OpenJPEG returns interleaved RGB(A) data
    const buffer = Buffer.from(decodedBuffer);
    const channels = frameInfo.componentCount;

    // Create Sharp image from raw pixel data with proper color space handling
    const sharpImage = sharp(buffer, {
      raw: {
        width: frameInfo.width,
        height: frameInfo.height,
        channels: channels, // 3 for RGB, 4 for RGBA
      },
    });

    // Preserve color space and convert to JPEG with high quality
    await sharpImage
      .jpeg({
        quality: quality,
        chromaSubsampling: "4:4:4", // No chroma subsampling for better color preservation
        mozjpeg: true, // Use mozjpeg for better quality
      })
      .toFile(jpgPath);

    const newSize = fs.statSync(jpgPath).size;

    // Delete original JP2 file if requested
    if (deleteOriginal) {
      fs.unlinkSync(jp2Path);
    }

    if (verbose) {
      console.log(
        `   ✅ Converted: ${path.basename(
          jpgPath
        )} (${originalSize} → ${newSize} bytes)`
      );
    }

    return {
      success: true,
      newPath: jpgPath,
      originalSize,
      newSize,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Conversion failed: ${error.message}`,
    };
  }
}

/**
 * Convert JP2 image to JPG (Main Entry Point)
 *
 * Automatically chooses between Sharp (better quality) and @napi-rs/canvas (default)
 * based on availability and user preference.
 *
 * @param jp2Path - Path to the JP2 file
 * @param options - Conversion options
 * @returns Conversion result with new file path
 */
export async function convertJp2ToJpg(
  jp2Path: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const verbose = options.verbose !== undefined ? options.verbose : false;

  // Check if Sharp should be used
  if (options.useSharp) {
    if (verbose) {
      console.log("   🔍 Sharp requested, checking availability...");
    }

    // Check if Sharp is available
    const sharpAvailable = await isSharpAvailable();

    if (verbose) {
      console.log(`   🔍 Sharp available: ${sharpAvailable}`);
    }

    if (sharpAvailable) {
      if (verbose) {
        console.log("   ✅ Using Sharp for JP2 conversion (better quality)");
      }
      // Use Sharp for better color preservation
      return convertJp2ToJpgSharp(jp2Path, options);
    }

    // Sharp requested but not available - warn and fall back
    if (verbose) {
      console.log(
        "   ⚠️  Sharp requested but not available. Install with: npm install sharp"
      );
      console.log("   ⚠️  Falling back to @napi-rs/canvas");
    }
  } else if (verbose) {
    console.log("   ℹ️  useSharp not enabled, using @napi-rs/canvas");
  }

  // Default: use @napi-rs/canvas
  return convertJp2ToJpgWasm(jp2Path, options);
}
