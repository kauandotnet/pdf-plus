/**
 * Color Space Configuration Utility
 *
 * Centralized color space detection and configuration for PDF image processing.
 * Eliminates duplicated color space logic across the codebase.
 */

/**
 * Color space configuration
 */
export interface ColorSpaceConfig {
  readonly components: number;
  readonly colorType: number;
  readonly name: string;
}

/**
 * Color space definitions with their keywords
 */
interface ColorSpaceDefinition extends ColorSpaceConfig {
  readonly keywords: readonly string[];
}

/**
 * Color space lookup table
 */
const COLOR_SPACES: ReadonlyArray<
  readonly [string, ColorSpaceDefinition]
> = Object.freeze([
  [
    "grayscale",
    {
      components: 1,
      colorType: 0,
      name: "Grayscale",
      keywords: ["DeviceGray", "Gray", "CalGray", "G"],
    },
  ],
  [
    "rgb",
    {
      components: 3,
      colorType: 2,
      name: "RGB",
      keywords: ["DeviceRGB", "RGB", "CalRGB", "sRGB"],
    },
  ],
  [
    "cmyk",
    {
      components: 4,
      colorType: 2, // Will convert to RGB
      name: "CMYK",
      keywords: ["DeviceCMYK", "CMYK"],
    },
  ],
  [
    "indexed",
    {
      components: 1,
      colorType: 3,
      name: "Indexed",
      keywords: ["Indexed", "Index", "I"],
    },
  ],
]);

/**
 * Default color space (RGB)
 */
const DEFAULT_COLOR_SPACE: ColorSpaceConfig = Object.freeze({
  components: 3,
  colorType: 2,
  name: "RGB",
});

/**
 * Detect color space from a PDF color space string
 *
 * @param colorSpaceStr - Color space string from PDF metadata
 * @returns Color space configuration
 *
 * @example
 * ```typescript
 * detectColorSpace("/DeviceRGB"); // { components: 3, colorType: 2, name: "RGB" }
 * detectColorSpace("/DeviceGray"); // { components: 1, colorType: 0, name: "Grayscale" }
 * detectColorSpace("/DeviceCMYK"); // { components: 4, colorType: 2, name: "CMYK" }
 * ```
 */
export function detectColorSpace(colorSpaceStr: string): ColorSpaceConfig {
  if (!colorSpaceStr) {
    return DEFAULT_COLOR_SPACE;
  }

  // Check each color space definition for matching keywords
  for (const [, definition] of COLOR_SPACES) {
    for (const keyword of definition.keywords) {
      if (colorSpaceStr.includes(keyword)) {
        return {
          components: definition.components,
          colorType: definition.colorType,
          name: definition.name,
        };
      }
    }
  }

  return DEFAULT_COLOR_SPACE;
}

/**
 * Get the number of color components from a PDF color space
 *
 * @param colorSpaceStr - Color space string from PDF metadata
 * @returns Number of color components (1, 3, or 4)
 *
 * @example
 * ```typescript
 * getColorComponents("/DeviceRGB");  // 3
 * getColorComponents("/DeviceGray"); // 1
 * getColorComponents("/DeviceCMYK"); // 4
 * getColorComponents(null);          // 3 (default)
 * ```
 */
export function getColorComponents(colorSpaceStr: string | null | undefined): number {
  if (!colorSpaceStr) {
    return DEFAULT_COLOR_SPACE.components;
  }

  return detectColorSpace(colorSpaceStr).components;
}

/**
 * Check if a color space is CMYK
 *
 * @param colorSpaceStr - Color space string
 * @returns true if CMYK
 */
export function isCmykColorSpace(colorSpaceStr: string): boolean {
  const definition = COLOR_SPACES.find(([key]) => key === "cmyk")?.[1];
  if (!definition) return false;

  return definition.keywords.some((keyword) => colorSpaceStr.includes(keyword));
}

/**
 * Check if a color space is grayscale
 *
 * @param colorSpaceStr - Color space string
 * @returns true if grayscale
 */
export function isGrayscaleColorSpace(colorSpaceStr: string): boolean {
  const definition = COLOR_SPACES.find(([key]) => key === "grayscale")?.[1];
  if (!definition) return false;

  return definition.keywords.some((keyword) => colorSpaceStr.includes(keyword));
}

/**
 * Get color space name from number of components
 *
 * @param components - Number of color components
 * @returns Color space name or "Unknown"
 */
export function getColorSpaceNameFromComponents(components: number): string {
  switch (components) {
    case 1:
      return "Grayscale";
    case 3:
      return "RGB";
    case 4:
      return "CMYK";
    default:
      return "Unknown";
  }
}
