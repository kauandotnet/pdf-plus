/**
 * Parallel Processor Utility
 *
 * Provides controlled parallel execution with concurrency limits
 * to prevent memory issues and optimize performance.
 */

export interface ParallelProcessorOptions {
  /** Maximum number of concurrent operations (default: 10) */
  maxConcurrency?: number;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

export class ParallelProcessor {
  /**
   * Execute tasks in parallel with concurrency limit
   *
   * @param tasks - Array of async functions to execute
   * @param options - Processor options
   * @returns Promise resolving to array of results
   */
  static async executeWithLimit<T>(
    tasks: (() => Promise<T>)[],
    options: ParallelProcessorOptions = {}
  ): Promise<T[]> {
    const maxConcurrency = options.maxConcurrency || 10;
    const verbose = options.verbose || false;

    if (tasks.length === 0) {
      return [];
    }

    // If tasks are fewer than max concurrency, just run them all
    if (tasks.length <= maxConcurrency) {
      if (verbose) {
        console.log(`   🚀 Running ${tasks.length} tasks in parallel`);
      }
      return Promise.all(tasks.map((task) => task()));
    }

    // Otherwise, run in batches - TRUE PARALLEL (all batches start immediately)
    if (verbose) {
      console.log(
        `   🚀 Running ${tasks.length} tasks in batches of ${maxConcurrency} (true parallel)`
      );
    }

    const batchCount = Math.ceil(tasks.length / maxConcurrency);
    const batchIndices = Array.from({ length: batchCount }, (_, i) => i);

    // Create all batch promises at once (they all start immediately)
    const batchPromises = batchIndices.map(async (batchIndex) => {
      const startIdx = batchIndex * maxConcurrency;
      const batch = tasks.slice(startIdx, startIdx + maxConcurrency);
      const batchResults = await Promise.all(batch.map((task) => task()));

      if (verbose && startIdx + maxConcurrency < tasks.length) {
        console.log(
          `   ✅ Completed batch ${batchIndex + 1}/${batchCount} (${Math.min(
            startIdx + maxConcurrency,
            tasks.length
          )}/${tasks.length} tasks)`
        );
      }

      return batchResults;
    });

    // Wait for all batches to complete
    const batchResults = await Promise.all(batchPromises);

    // Flatten results
    return batchResults.flat();
  }

  /**
   * Execute tasks in parallel with concurrency limit and error handling
   *
   * Uses Promise.allSettled to continue processing even if some tasks fail
   *
   * @param tasks - Array of async functions to execute
   * @param options - Processor options
   * @returns Promise resolving to array of settled results
   */
  static async executeWithLimitSettled<T>(
    tasks: (() => Promise<T>)[],
    options: ParallelProcessorOptions = {}
  ): Promise<PromiseSettledResult<T>[]> {
    const maxConcurrency = options.maxConcurrency || 10;
    const verbose = options.verbose || false;

    if (tasks.length === 0) {
      return [];
    }

    // If tasks are fewer than max concurrency, just run them all
    if (tasks.length <= maxConcurrency) {
      if (verbose) {
        console.log(
          `   🚀 Running ${tasks.length} tasks in parallel (with error handling)`
        );
      }
      return Promise.allSettled(tasks.map((task) => task()));
    }

    // Otherwise, run in batches - TRUE PARALLEL (all batches start immediately)
    if (verbose) {
      console.log(
        `   🚀 Running ${tasks.length} tasks in batches of ${maxConcurrency} (true parallel with error handling)`
      );
    }

    const batchCount = Math.ceil(tasks.length / maxConcurrency);
    const batchIndices = Array.from({ length: batchCount }, (_, i) => i);

    // Create all batch promises at once (they all start immediately)
    const batchPromises = batchIndices.map(async (batchIndex) => {
      const batchStartTime = Date.now();
      const startIdx = batchIndex * maxConcurrency;
      const batch = tasks.slice(startIdx, startIdx + maxConcurrency);

      if (verbose) {
        console.log(
          `   🚀 Batch ${batchIndex + 1}/${batchCount} started (tasks ${
            startIdx + 1
          }-${Math.min(startIdx + maxConcurrency, tasks.length)})`
        );
      }

      const batchResults = await Promise.allSettled(
        batch.map((task) => task())
      );

      const batchDuration = Date.now() - batchStartTime;

      if (verbose) {
        const succeeded = batchResults.filter(
          (r) => r.status === "fulfilled"
        ).length;
        const failed = batchResults.filter(
          (r) => r.status === "rejected"
        ).length;
        console.log(
          `   ✅ Batch ${
            batchIndex + 1
          }/${batchCount} completed in ${batchDuration}ms (${succeeded} succeeded, ${failed} failed)`
        );
      }

      return batchResults;
    });

    // Wait for all batches to complete
    const batchResults = await Promise.all(batchPromises);

    // Flatten results
    return batchResults.flat();
  }

  /**
   * Map array items to async operations with concurrency limit
   *
   * @param items - Array of items to process
   * @param mapper - Async function to apply to each item
   * @param options - Processor options
   * @returns Promise resolving to array of results
   */
  static async map<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>,
    options: ParallelProcessorOptions = {}
  ): Promise<R[]> {
    const tasks = items.map((item, index) => () => mapper(item, index));
    return ParallelProcessor.executeWithLimit(tasks, options);
  }

  /**
   * Map array items to async operations with concurrency limit and error handling
   *
   * @param items - Array of items to process
   * @param mapper - Async function to apply to each item
   * @param options - Processor options
   * @returns Promise resolving to array of settled results
   */
  static async mapSettled<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>,
    options: ParallelProcessorOptions = {}
  ): Promise<PromiseSettledResult<R>[]> {
    const tasks = items.map((item, index) => () => mapper(item, index));
    return ParallelProcessor.executeWithLimitSettled(tasks, options);
  }

  /**
   * Filter array items using async predicate with concurrency limit
   *
   * @param items - Array of items to filter
   * @param predicate - Async predicate function
   * @param options - Processor options
   * @returns Promise resolving to filtered array
   */
  static async filter<T>(
    items: T[],
    predicate: (item: T, index: number) => Promise<boolean>,
    options: ParallelProcessorOptions = {}
  ): Promise<T[]> {
    const results = await ParallelProcessor.map(items, predicate, options);
    return items.filter((_, index) => results[index]);
  }

  /**
   * Execute async operations in chunks/batches
   *
   * Useful for processing large datasets in manageable chunks
   *
   * @param items - Array of items to process
   * @param chunkSize - Size of each chunk
   * @param processor - Async function to process each chunk
   * @param options - Processor options
   * @returns Promise resolving to array of chunk results
   */
  static async processInChunks<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[], chunkIndex: number) => Promise<R>,
    options: ParallelProcessorOptions = {}
  ): Promise<R[]> {
    const chunkCount = Math.ceil(items.length / chunkSize);
    const chunks = Array.from({ length: chunkCount }, (_, i) => {
      const startIdx = i * chunkSize;
      return items.slice(startIdx, startIdx + chunkSize);
    });

    const tasks = chunks.map((chunk, index) => () => processor(chunk, index));
    return ParallelProcessor.executeWithLimit(tasks, options);
  }
}
