/**
 * Streaming PDF extractor for large PDFs
 * Provides async iterator and event-based APIs
 */

import type { ExtractionOptions } from "../types/index.js";
import type {
  StreamEventUnion,
  StreamingExtractionResult,
  StreamingOptions,
  StreamingState,
  StreamingStats,
  StartEvent,
  PageEvent,
  ImageEvent,
  ProgressEvent,
  CompleteEvent,
  ErrorEvent,
} from "../types/streaming-types.js";
import { PDFExtractor } from "./extractor.js";

/**
 * Streaming PDF extractor implementation
 */
export class StreamingPDFExtractor implements StreamingExtractionResult {
  private state: StreamingState;
  private options: ExtractionOptions & StreamingOptions;
  private pdfPath: string;
  private extractor: PDFExtractor;
  private eventQueue: StreamEventUnion[] = [];
  private resolveNext: (() => void) | null = null;
  private extractionPromise: Promise<void> | null = null;

  constructor(
    pdfPath: string,
    options: ExtractionOptions & StreamingOptions = {}
  ) {
    this.pdfPath = pdfPath;
    this.options = {
      progressInterval: 5,
      enableBackpressure: true,
      maxBufferedPages: 10,
      ...options,
    };
    this.extractor = new PDFExtractor();

    this.state = {
      totalPages: 0,
      pagesProcessed: 0,
      imagesExtracted: 0,
      totalTextLength: 0,
      bytesProcessed: 0,
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      isPaused: false,
      isCancelled: false,
      isComplete: false,
      bufferedPages: 0,
      eventQueue: [],
      callbacks: {},
    };
  }

  /**
   * Async iterator implementation
   */
  async *[Symbol.asyncIterator](): AsyncIterator<StreamEventUnion> {
    // Start extraction in background
    if (!this.extractionPromise) {
      this.extractionPromise = this.startExtraction();
    }

    while (true) {
      // Check if cancelled
      if (this.state.isCancelled) {
        return;
      }

      // If we have events in queue, yield them
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        yield event;

        // If this was the complete event, we're done
        if (event.type === "complete" || event.type === "error") {
          return;
        }
        continue;
      }

      // If extraction is complete and queue is empty, we're done
      if (this.state.isComplete) {
        return;
      }

      // Wait for next event
      await new Promise<void>((resolve) => {
        this.resolveNext = () => resolve();
      });
    }
  }

  /**
   * Register event callbacks
   */
  on(event: "start", callback: (event: StartEvent) => void): this;
  on(event: "page", callback: (event: PageEvent) => void): this;
  on(event: "image", callback: (event: ImageEvent) => void): this;
  on(event: "progress", callback: (event: ProgressEvent) => void): this;
  on(event: "complete", callback: (event: CompleteEvent) => void): this;
  on(event: "error", callback: (event: ErrorEvent) => void): this;
  on(event: "any", callback: (event: StreamEventUnion) => void): this;
  on(event: string, callback: (event: any) => void): this {
    if (event === "start") {
      this.state.callbacks.onStart = callback as (event: StartEvent) => void;
    } else if (event === "page") {
      this.state.callbacks.onPage = callback as (event: PageEvent) => void;
    } else if (event === "image") {
      this.state.callbacks.onImage = callback as (event: ImageEvent) => void;
    } else if (event === "progress") {
      this.state.callbacks.onProgress = callback as (
        event: ProgressEvent
      ) => void;
    } else if (event === "complete") {
      this.state.callbacks.onComplete = callback as (
        event: CompleteEvent
      ) => void;
    } else if (event === "error") {
      this.state.callbacks.onError = callback as (event: ErrorEvent) => void;
    } else if (event === "any") {
      this.state.callbacks.onAny = callback as (
        event: StreamEventUnion
      ) => void;
    }
    return this;
  }

  /**
   * Cancel extraction
   */
  async cancel(): Promise<void> {
    this.state.isCancelled = true;
    if (this.resolveNext) {
      this.resolveNext();
    }
  }

  /**
   * Pause extraction (backpressure)
   */
  pause(): void {
    this.state.isPaused = true;
  }

  /**
   * Resume extraction
   */
  resume(): void {
    this.state.isPaused = false;
  }

  /**
   * Get streaming statistics
   */
  getStats(): StreamingStats {
    const elapsedTime = Date.now() - this.state.startTime;
    const averagePageTime =
      this.state.pagesProcessed > 0
        ? elapsedTime / this.state.pagesProcessed
        : 0;
    const remainingPages = this.state.totalPages - this.state.pagesProcessed;
    const estimatedTimeRemaining = averagePageTime * remainingPages;

    return {
      pagesProcessed: this.state.pagesProcessed,
      totalPages: this.state.totalPages,
      imagesExtracted: this.state.imagesExtracted,
      bytesProcessed: this.state.bytesProcessed,
      startTime: this.state.startTime,
      elapsedTime,
      isPaused: this.state.isPaused,
      isCancelled: this.state.isCancelled,
      isComplete: this.state.isComplete,
      averagePageTime,
      estimatedTimeRemaining,
    };
  }

  /**
   * Emit an event
   */
  private async emitEvent(event: StreamEventUnion): Promise<void> {
    // Add to queue
    this.eventQueue.push(event);

    // Call specific callback
    if (event.type === "start" && this.state.callbacks.onStart) {
      await this.state.callbacks.onStart(event as StartEvent);
    } else if (event.type === "page" && this.state.callbacks.onPage) {
      await this.state.callbacks.onPage(event as PageEvent);
    } else if (event.type === "image" && this.state.callbacks.onImage) {
      await this.state.callbacks.onImage(event as ImageEvent);
    } else if (event.type === "progress" && this.state.callbacks.onProgress) {
      await this.state.callbacks.onProgress(event as ProgressEvent);
    } else if (event.type === "complete" && this.state.callbacks.onComplete) {
      await this.state.callbacks.onComplete(event as CompleteEvent);
    } else if (event.type === "error" && this.state.callbacks.onError) {
      await this.state.callbacks.onError(event as ErrorEvent);
    }

    // Call generic callback
    if (this.state.callbacks.onAny) {
      await this.state.callbacks.onAny(event);
    }

    // Notify iterator
    if (this.resolveNext) {
      this.resolveNext();
      this.resolveNext = null;
    }
  }

  /**
   * Start the extraction process
   */
  private async startExtraction(): Promise<void> {
    try {
      // Get PDF info first to know total pages
      const result = await this.extractor.extract(this.pdfPath, {
        ...this.options,
        extractImageFiles: false, // Don't extract files yet
        extractImages: false, // Don't extract images yet
        verbose: false,
      });

      this.state.totalPages = result.document.pages || 0;

      // Emit start event
      await this.emitEvent({
        type: "start",
        timestamp: Date.now(),
        totalPages: this.state.totalPages,
        pdfPath: this.pdfPath,
      });

      // Process pages one by one
      const pageNumbers = Array.from(
        { length: this.state.totalPages },
        (_, i) => i + 1
      );

      for (const pageNum of pageNumbers) {
        // Check if cancelled
        if (this.state.isCancelled) {
          break;
        }

        // Handle backpressure
        while (
          this.state.isPaused ||
          (this.options.enableBackpressure &&
            this.state.bufferedPages >= (this.options.maxBufferedPages || 10))
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (this.state.isCancelled) {
            break;
          }
        }

        // Extract page
        const pageResult = await this.extractor.getPage(
          this.pdfPath,
          pageNum,
          this.options
        );

        this.state.pagesProcessed++;
        this.state.bufferedPages++;

        // Emit page event
        await this.emitEvent({
          type: "page",
          timestamp: Date.now(),
          pageNumber: pageNum,
          totalPages: this.state.totalPages,
          textLength: pageResult.text.length || 0,
          imageCount: pageResult.images.length || 0,
        });

        // Emit image events
        if (pageResult.images && pageResult.images.length > 0) {
          await Promise.all(
            pageResult.images.map(async (image, i) => {
              if (image) {
                this.state.imagesExtracted++;
                await this.emitEvent({
                  type: "image",
                  timestamp: Date.now(),
                  image,
                  pageNumber: pageNum,
                  imageIndex: i + 1,
                  totalImages: pageResult.images.length,
                });
              }
            })
          );
        }

        this.state.totalTextLength += pageResult.text.length || 0;
        this.state.bufferedPages--;

        // Emit progress event
        if (
          pageNum % (this.options.progressInterval || 5) === 0 ||
          pageNum === this.state.totalPages
        ) {
          const stats = this.getStats();
          await this.emitEvent({
            type: "progress",
            timestamp: Date.now(),
            pagesProcessed: this.state.pagesProcessed,
            totalPages: this.state.totalPages,
            imagesExtracted: this.state.imagesExtracted,
            percentComplete:
              (this.state.pagesProcessed / this.state.totalPages) * 100,
            estimatedTimeRemaining: stats.estimatedTimeRemaining,
          });
        }
      }

      // Emit complete event
      this.state.isComplete = true;
      const duration = Date.now() - this.state.startTime;

      await this.emitEvent({
        type: "complete",
        timestamp: Date.now(),
        totalPages: this.state.totalPages,
        totalImages: this.state.imagesExtracted,
        totalTextLength: this.state.totalTextLength,
        duration,
      });
    } catch (error) {
      // Emit error event
      await this.emitEvent({
        type: "error",
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error)),
        recoverable: false,
      });
      this.state.isComplete = true;
    }
  }
}
