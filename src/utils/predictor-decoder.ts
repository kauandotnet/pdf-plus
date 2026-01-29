/**
 * PNG Predictor Decoder
 * 
 * Handles PNG predictor filters used in PDF FlateDecode streams.
 * Based on implementations from:
 * - https://github.com/chbrown/pdfi
 * - https://github.com/yermolim/ts-pdf
 * 
 * PDF Reference: PDF32000_2008.pdf:7.4.4.4 "LZW and Flate Predictor Functions"
 * PNG Specification: http://www.libpng.org/pub/png/spec/1.2/PNG-Filters.html
 */

/**
 * PNG Predictor types (PDF spec)
 */
export enum PNGPredictor {
  NONE = 10,      // No prediction
  SUB = 11,       // Difference from left pixel
  UP = 12,        // Difference from above pixel
  AVERAGE = 13,   // Average of left and above pixels
  PAETH = 14,     // Paeth predictor
  OPTIMUM = 15,   // Optimum predictor (encoder chooses best per row)
}

/**
 * TIFF Predictor type
 */
export const TIFF_PREDICTOR = 2;

/**
 * Paeth predictor algorithm
 *
 * Computes a simple linear function of the three neighboring pixels
 * (left, above, upper left), then chooses as predictor the neighboring
 * pixel closest to the computed value.
 *
 * @param a - Left pixel value
 * @param b - Above pixel value
 * @param c - Upper left pixel value
 * @returns Predicted value
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  } else if (pb <= pc) {
    return b;
  } else {
    return c;
  }
}

/**
 * PNG filter type handlers
 * Maps filter type byte to decoding function
 * Each function: (input, left, above, upperLeft) => decoded value
 */
type PngFilterFn = (
  input: number,
  left: number,
  above: number,
  upperLeft: number
) => number;

const PNG_FILTERS = new Map<number, PngFilterFn>([
  // NONE - No filtering, use value as-is
  [0, (input) => input],
  // SUB - Add the byte to the left
  [1, (input, left) => (input + left) & 0xff],
  // UP - Add the byte above
  [2, (input, _left, above) => (input + above) & 0xff],
  // AVERAGE - Add the average of left and above bytes
  [3, (input, left, above) => (input + Math.floor((left + above) / 2)) & 0xff],
  // PAETH - Add the Paeth predictor
  [4, (input, left, above, upperLeft) => (input + paethPredictor(left, above, upperLeft)) & 0xff],
]);

/**
 * Remove PNG predictor filters from decompressed data
 * 
 * @param input - Decompressed data with PNG predictor bytes
 * @param columns - Number of columns (width in pixels)
 * @param components - Number of color components (1=Gray, 3=RGB, 4=CMYK)
 * @param bitsPerComponent - Bits per component (usually 8)
 * @returns Decoded data without predictor bytes
 */
export function removePngPredictor(
  input: Buffer,
  columns: number,
  components: number = 3,
  bitsPerComponent: number = 8
): Buffer {
  // Calculate bytes per pixel
  const bytesPerPixel = Math.ceil((components * bitsPerComponent) / 8);
  
  // Calculate row length
  const rowLength = columns * bytesPerPixel;
  const rowLengthWithFilter = rowLength + 1; // +1 for filter type byte

  // Validate input length
  if (input.length % rowLengthWithFilter !== 0) {
    throw new Error(
      `Data length doesn't match filter columns: ${input.length} % ${rowLengthWithFilter} !== 0`
    );
  }

  const rowCount = input.length / rowLengthWithFilter;
  const output = Buffer.alloc(rowCount * rowLength);

  // Buffers for previous and current rows
  const previousRow = Buffer.alloc(rowLength);
  const currentRow = Buffer.alloc(rowLength);

  // Helper functions to get neighboring pixels
  const getLeft = (index: number): number =>
    index - bytesPerPixel < 0 ? 0 : currentRow[index - bytesPerPixel];

  const getAbove = (index: number): number => previousRow[index];

  const getUpperLeft = (index: number): number =>
    index - bytesPerPixel < 0 ? 0 : previousRow[index - bytesPerPixel];

  let outputIndex = 0;

  // Process each row
  for (let row = 0; row < rowCount; row++) {
    const rowStart = row * rowLengthWithFilter;
    const filterType = input[rowStart];

    // Decode the row based on filter type using lookup map
    const filterFn = PNG_FILTERS.get(filterType);
    if (!filterFn) {
      throw new Error(`Unknown PNG filter type: ${filterType}`);
    }

    for (let col = 0; col < rowLength; col++) {
      const inputValue = input[rowStart + 1 + col];
      const decodedValue = filterFn(
        inputValue,
        getLeft(col),
        getAbove(col),
        getUpperLeft(col)
      );

      currentRow[col] = decodedValue;
      output[outputIndex++] = decodedValue;
    }

    // Copy current row to previous row for next iteration
    currentRow.copy(previousRow);
  }

  return output;
}

/**
 * Remove TIFF Predictor 2 from decompressed data
 * 
 * TIFF Predictor 2 stores the difference between adjacent pixels.
 * Each pixel value is the sum of the previous pixel and the stored difference.
 * 
 * @param input - Decompressed data with TIFF predictor
 * @param columns - Number of columns (width in pixels)
 * @param components - Number of color components
 * @param bitsPerComponent - Bits per component
 * @returns Decoded data without predictor
 */
export function removeTiffPredictor(
  input: Buffer,
  columns: number,
  components: number = 3,
  bitsPerComponent: number = 8
): Buffer {
  const bytesPerPixel = Math.ceil((components * bitsPerComponent) / 8);
  const rowLength = columns * bytesPerPixel;
  const rowCount = input.length / rowLength;

  const output = Buffer.alloc(input.length);

  for (let row = 0; row < rowCount; row++) {
    const rowStart = row * rowLength;

    // First pixel in each row is unchanged
    for (let i = 0; i < bytesPerPixel; i++) {
      output[rowStart + i] = input[rowStart + i];
    }

    // Subsequent pixels are cumulative differences
    for (let col = bytesPerPixel; col < rowLength; col++) {
      output[rowStart + col] =
        (input[rowStart + col] + output[rowStart + col - bytesPerPixel]) & 0xff;
    }
  }

  return output;
}

/**
 * Decode predictor-encoded data
 * 
 * @param input - Decompressed data (possibly with predictor encoding)
 * @param predictor - Predictor type (1=None, 2=TIFF, 10-15=PNG)
 * @param columns - Number of columns
 * @param components - Number of color components (default: 3 for RGB)
 * @param bitsPerComponent - Bits per component (default: 8)
 * @returns Decoded data
 */
export function decodePredictor(
  input: Buffer,
  predictor: number = 1,
  columns: number = 1,
  components: number = 3,
  bitsPerComponent: number = 8
): Buffer {
  // Predictor 1 = No prediction
  if (predictor === 1) {
    return input;
  }

  // Predictor 2 = TIFF Predictor 2
  if (predictor === TIFF_PREDICTOR) {
    return removeTiffPredictor(input, columns, components, bitsPerComponent);
  }

  // Predictors 10-15 = PNG predictors
  if (predictor >= 10 && predictor <= 15) {
    return removePngPredictor(input, columns, components, bitsPerComponent);
  }

  throw new Error(`Unsupported predictor type: ${predictor}`);
}

/**
 * Decode FlateDecode stream with optional predictor
 * 
 * This is a convenience function that combines zlib decompression
 * with predictor decoding.
 * 
 * @param compressed - Compressed data
 * @param decodeParms - Decode parameters from PDF
 * @returns Decompressed and decoded data
 */
export function decodeFlateDecode(
  compressed: Buffer,
  decodeParms?: {
    Predictor?: number;
    Columns?: number;
    Colors?: number;
    BitsPerComponent?: number;
  }
): Buffer {
  const zlib = require("zlib");
  const decompressed = Buffer.from(zlib.inflateSync(compressed));

  if (!decodeParms || !decodeParms.Predictor || decodeParms.Predictor === 1) {
    return decompressed;
  }

  return decodePredictor(
    decompressed,
    decodeParms.Predictor,
    decodeParms.Columns || 1,
    decodeParms.Colors || 3,
    decodeParms.BitsPerComponent || 8
  );
}

