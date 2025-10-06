/**
 * Sharp Availability Detector
 *
 * Detects if Sharp is available at runtime for optional enhanced image processing.
 * Sharp is an optional dependency that provides better color space handling.
 */

/**
 * Check if Sharp is available at runtime
 *
 * Sharp is an optional dependency that may not be installed or may fail to load
 * on some platforms due to native compilation requirements.
 *
 * @returns Promise resolving to true if Sharp is available, false otherwise
 */
export async function isSharpAvailable(): Promise<boolean> {
  try {
    // Try to dynamically import Sharp
    await import("sharp");
    return true;
  } catch (error) {
    // Sharp not installed or failed to load
    return false;
  }
}

/**
 * Get Sharp module if available
 *
 * @returns Promise resolving to Sharp module or null if not available
 */
export async function getSharp(): Promise<any | null> {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default;
  } catch (error) {
    return null;
  }
}

