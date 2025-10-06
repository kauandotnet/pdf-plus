/**
 * Result type for functional error handling
 * 
 * Provides a type-safe way to handle success and failure cases
 * without throwing exceptions.
 */

import type { PDFExtractionError } from '../errors/index.js';

/**
 * Success result
 */
export interface Success<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * Failure result
 */
export interface Failure<E = PDFExtractionError> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type - either Success or Failure
 */
export type Result<T, E = PDFExtractionError> = Success<T> | Failure<E>;

/**
 * Create a success result
 */
export const success = <T>(data: T): Success<T> => ({
  success: true,
  data
});

/**
 * Create a failure result
 */
export const failure = <E = PDFExtractionError>(error: E): Failure<E> => ({
  success: false,
  error
});

/**
 * Type guard for success result
 */
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> => {
  return result.success === true;
};

/**
 * Type guard for failure result
 */
export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> => {
  return result.success === false;
};

/**
 * Map over a successful result
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> => {
  return isSuccess(result) ? success(fn(result.data)) : result;
};

/**
 * FlatMap over a successful result
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> => {
  return isSuccess(result) ? fn(result.data) : result;
};

/**
 * Get data or throw error
 */
export const unwrap = <T, E extends Error>(result: Result<T, E>): T => {
  if (isSuccess(result)) {
    return result.data;
  }
  throw result.error;
};

/**
 * Get data or return default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  return isSuccess(result) ? result.data : defaultValue;
};

/**
 * Convert a promise to a Result
 */
export const fromPromise = async <T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> => {
  try {
    const data = await promise;
    return success(data);
  } catch (error) {
    return failure(error as E);
  }
};

/**
 * Convert a function that might throw to a Result
 */
export const tryCatch = <T, E = Error>(
  fn: () => T
): Result<T, E> => {
  try {
    return success(fn());
  } catch (error) {
    return failure(error as E);
  }
};

/**
 * Convert an async function that might throw to a Result
 */
export const tryCatchAsync = async <T, E = Error>(
  fn: () => Promise<T>
): Promise<Result<T, E>> => {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    return failure(error as E);
  }
};

