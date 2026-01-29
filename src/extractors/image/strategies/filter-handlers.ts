/**
 * PDF Filter Handlers Strategy Map
 *
 * Centralized filter handling using a strategy pattern.
 * Replaces 250+ lines of nested if/else with a clean lookup table.
 */

import zlib from "node:zlib";
import { detectImageFormat } from "../../../utils/image-format-detector.js";
import { getErrorMessage } from "../../../utils/error-utils.js";

/**
 * Filter extraction result
 */
export interface FilterResult {
  readonly success: boolean;
  readonly imageData?: Buffer;
  readonly mimeType?: string;
  readonly extension?: string;
  readonly error?: string;
}

/**
 * Filter handler context
 */
export interface FilterContext {
  readonly pdfObject: {
    readonly contents: Uint8Array;
    asUint8Array?: () => Promise<Uint8Array>;
  };
  readonly width: number;
  readonly height: number;
  readonly colorSpace: string;
  readonly bitsPerComponent: number;
  readonly verbose?: boolean;
  readonly decodeParms?: {
    Predictor?: number;
    Columns?: number;
    Colors?: number;
  };
}

/**
 * Filter handler interface
 */
interface FilterHandler {
  readonly name: string;
  readonly mimeType: string;
  readonly extension: string;
  extract(ctx: FilterContext): Promise<FilterResult>;
}

/**
 * Callback for PNG creation from raw pixel data
 */
export type PngCreator = (
  rawData: Buffer,
  width: number,
  height: number,
  colorSpace: string,
  bitsPerComponent: number
) => Promise<{ success: boolean; pngData?: Buffer; error?: string }>;

/**
 * Callback for predictor decoding
 */
export type PredictorDecoder = (
  data: Buffer,
  predictor: number,
  columns: number,
  components: number,
  bitsPerComponent: number
) => Buffer;

// Callbacks set by the engine
let pngCreator: PngCreator | null = null;
let predictorDecoder: PredictorDecoder | null = null;
let colorComponentsGetter: ((colorSpace: string) => number) | null = null;

/**
 * Set the PNG creator callback
 */
export function setPngCreator(creator: PngCreator): void {
  pngCreator = creator;
}

/**
 * Set the predictor decoder callback
 */
export function setPredictorDecoder(decoder: PredictorDecoder): void {
  predictorDecoder = decoder;
}

/**
 * Set the color components getter callback
 */
export function setColorComponentsGetter(
  getter: (colorSpace: string) => number
): void {
  colorComponentsGetter = getter;
}

/**
 * DCTDecode handler (JPEG)
 */
const dctDecodeHandler: FilterHandler = {
  name: "DCTDecode",
  mimeType: "image/jpeg",
  extension: "jpg",
  async extract(ctx: FilterContext): Promise<FilterResult> {
    try {
      const imageData = Buffer.from(ctx.pdfObject.contents);
      return {
        success: true,
        imageData,
        mimeType: this.mimeType,
        extension: this.extension,
      };
    } catch (error) {
      return {
        success: false,
        error: `DCTDecode extraction failed: ${getErrorMessage(error)}`,
      };
    }
  },
};

/**
 * JPXDecode handler (JPEG 2000)
 */
const jpxDecodeHandler: FilterHandler = {
  name: "JPXDecode",
  mimeType: "image/jp2",
  extension: "jp2",
  async extract(ctx: FilterContext): Promise<FilterResult> {
    try {
      const imageData = Buffer.from(ctx.pdfObject.contents);
      return {
        success: true,
        imageData,
        mimeType: this.mimeType,
        extension: this.extension,
      };
    } catch (error) {
      return {
        success: false,
        error: `JPXDecode extraction failed: ${getErrorMessage(error)}`,
      };
    }
  },
};

/**
 * FlateDecode handler (PNG/Raw)
 */
const flatDecodeHandler: FilterHandler = {
  name: "FlateDecode",
  mimeType: "image/png",
  extension: "png",
  async extract(ctx: FilterContext): Promise<FilterResult> {
    try {
      const compressedData = ctx.pdfObject.contents;
      let rawPixelData = zlib.inflateSync(Buffer.from(compressedData));

      // Handle predictor if present
      if (ctx.decodeParms?.Predictor && ctx.decodeParms.Predictor > 1) {
        if (!predictorDecoder) {
          return {
            success: false,
            error: "Predictor decoder not configured",
          };
        }

        const columns = ctx.decodeParms.Columns ?? ctx.width;
        const components =
          ctx.decodeParms.Colors ??
          (colorComponentsGetter
            ? colorComponentsGetter(ctx.colorSpace)
            : 3);

        rawPixelData = predictorDecoder(
          rawPixelData,
          ctx.decodeParms.Predictor,
          columns,
          components,
          ctx.bitsPerComponent
        );
      }

      // Check if decompressed data is already a valid image format
      const detected = detectImageFormat(rawPixelData);
      if (detected.valid) {
        return {
          success: true,
          imageData: rawPixelData,
          mimeType: detected.mimeType,
          extension: detected.extension,
        };
      }

      // Convert raw pixel data to PNG
      if (!pngCreator) {
        return {
          success: false,
          error: "PNG creator not configured",
        };
      }

      const pngResult = await pngCreator(
        rawPixelData,
        ctx.width,
        ctx.height,
        ctx.colorSpace,
        ctx.bitsPerComponent
      );

      if (pngResult.success && pngResult.pngData) {
        return {
          success: true,
          imageData: pngResult.pngData,
          mimeType: this.mimeType,
          extension: this.extension,
        };
      }

      return {
        success: false,
        error: pngResult.error || "PNG creation failed",
      };
    } catch (error) {
      return {
        success: false,
        error: `FlateDecode decompression failed: ${getErrorMessage(error)}`,
      };
    }
  },
};

/**
 * Dual compression handler (FlateDecode + DCTDecode)
 */
const dualCompressionHandler: FilterHandler = {
  name: "DCTDecode+FlateDecode",
  mimeType: "image/jpeg",
  extension: "jpg",
  async extract(ctx: FilterContext): Promise<FilterResult> {
    try {
      const compressedData = ctx.pdfObject.contents;
      const imageData = zlib.inflateSync(Buffer.from(compressedData));
      return {
        success: true,
        imageData,
        mimeType: this.mimeType,
        extension: this.extension,
      };
    } catch (error) {
      return {
        success: false,
        error: `Dual compression decompression failed: ${getErrorMessage(error)}`,
      };
    }
  },
};

/**
 * Generic/Unknown filter handler
 */
const genericHandler: FilterHandler = {
  name: "Generic",
  mimeType: "image/jpeg",
  extension: "jpg",
  async extract(ctx: FilterContext): Promise<FilterResult> {
    try {
      if (!ctx.pdfObject.asUint8Array) {
        return {
          success: false,
          error: "PDF object does not support asUint8Array",
        };
      }

      const rawData = await ctx.pdfObject.asUint8Array();
      const imageData = Buffer.from(rawData);

      // Try to detect format from the data
      const detected = detectImageFormat(imageData);
      if (detected.valid) {
        return {
          success: true,
          imageData,
          mimeType: detected.mimeType,
          extension: detected.extension,
        };
      }

      return {
        success: true,
        imageData,
        mimeType: this.mimeType,
        extension: this.extension,
      };
    } catch (error) {
      return {
        success: false,
        error: `Generic extraction failed: ${getErrorMessage(error)}`,
      };
    }
  },
};

/**
 * No filter handler (raw data)
 */
const noFilterHandler: FilterHandler = {
  name: "NoFilter",
  mimeType: "image/jpeg",
  extension: "jpg",
  async extract(ctx: FilterContext): Promise<FilterResult> {
    try {
      if (!ctx.pdfObject.asUint8Array) {
        return {
          success: false,
          error: "PDF object does not support asUint8Array",
        };
      }

      const rawData = await ctx.pdfObject.asUint8Array();
      const imageData = Buffer.from(rawData);

      // Try to detect format
      const detected = detectImageFormat(imageData);
      if (detected.valid) {
        return {
          success: true,
          imageData,
          mimeType: detected.mimeType,
          extension: detected.extension,
        };
      }

      return {
        success: true,
        imageData,
        mimeType: this.mimeType,
        extension: this.extension,
      };
    } catch (error) {
      return {
        success: false,
        error: `Raw data extraction failed: ${getErrorMessage(error)}`,
      };
    }
  },
};

/**
 * Filter handler registry
 * Exported for potential external use or testing
 */
export const FILTER_HANDLERS = new Map<string, FilterHandler>([
  ["DCTDecode", dctDecodeHandler],
  ["JPXDecode", jpxDecodeHandler],
  ["FlateDecode", flatDecodeHandler],
  ["DCTDecode+FlateDecode", dualCompressionHandler],
  ["FlateDecode+DCTDecode", dualCompressionHandler],
  ["Generic", genericHandler],
  ["NoFilter", noFilterHandler],
]);

/**
 * Resolve the appropriate handler for a filter string
 */
function resolveHandler(filterStr: string | null | undefined): FilterHandler {
  // No filter
  if (!filterStr) {
    return noFilterHandler;
  }

  // Check for dual compression (order matters)
  if (filterStr.includes("DCTDecode") && filterStr.includes("FlateDecode")) {
    return dualCompressionHandler;
  }

  // Check for specific filters
  if (filterStr.includes("DCTDecode")) {
    return dctDecodeHandler;
  }
  if (filterStr.includes("JPXDecode")) {
    return jpxDecodeHandler;
  }
  if (filterStr.includes("FlateDecode")) {
    return flatDecodeHandler;
  }

  // Unknown filter - try generic handler
  return genericHandler;
}

/**
 * Handle PDF filter extraction
 *
 * @param filterStr - Filter string from PDF metadata
 * @param ctx - Filter context with PDF object and metadata
 * @returns Filter extraction result
 *
 * @example
 * ```typescript
 * const result = await handleFilter("/DCTDecode", {
 *   pdfObject,
 *   width: 800,
 *   height: 600,
 *   colorSpace: "/DeviceRGB",
 *   bitsPerComponent: 8
 * });
 * ```
 */
export async function handleFilter(
  filterStr: string | null | undefined,
  ctx: FilterContext
): Promise<FilterResult> {
  const handler = resolveHandler(filterStr);

  if (ctx.verbose) {
    console.log(`   🔧 Using ${handler.name} handler for filter: ${filterStr || "none"}`);
  }

  return handler.extract(ctx);
}

/**
 * Get filter handler name for a filter string
 */
export function getFilterHandlerName(filterStr: string | null | undefined): string {
  return resolveHandler(filterStr).name;
}

/**
 * Check if a filter is supported
 */
export function isFilterSupported(filterStr: string): boolean {
  const handler = resolveHandler(filterStr);
  return handler !== genericHandler;
}
