/**
 * Error Handling Utilities
 *
 * Centralized error handling functions to eliminate repeated error message extraction.
 */

/**
 * Extract error message from an unknown error value
 *
 * Handles Error instances, strings, and other types safely.
 *
 * @param error - Unknown error value
 * @returns Error message string
 *
 * @example
 * ```typescript
 * try {
 *   // some operation
 * } catch (error) {
 *   console.log(`Error: ${getErrorMessage(error)}`);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * Create a formatted error message with context
 *
 * @param context - Context description (e.g., "Image extraction")
 * @param error - Unknown error value
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * try {
 *   await extractImage(data);
 * } catch (error) {
 *   return formatErrorMessage("Image extraction", error);
 *   // Returns: "Image extraction failed: <error message>"
 * }
 * ```
 */
export function formatErrorMessage(context: string, error: unknown): string {
  return `${context} failed: ${getErrorMessage(error)}`;
}

/**
 * Wrap an async function with error handling
 *
 * @param fn - Async function to wrap
 * @param context - Context for error messages
 * @returns Wrapped function that returns { success, result?, error? }
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context: string
): (
  ...args: Args
) => Promise<{ success: true; result: T } | { success: false; error: string }> {
  return async (...args: Args) => {
    try {
      const result = await fn(...args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: formatErrorMessage(context, error) };
    }
  };
}

/**
 * Check if a value is an Error instance
 *
 * @param value - Value to check
 * @returns true if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Create an Error from an unknown value
 *
 * @param error - Unknown error value
 * @returns Error instance
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}
