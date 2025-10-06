/**
 * Types for streaming PDF extraction
 */

import type { ImageItem, PageInfo } from "./index.js";

/**
 * Event types emitted during streaming extraction
 */
export type StreamEventType =
  | "start"
  | "page"
  | "image"
  | "progress"
  | "complete"
  | "error";

/**
 * Base event structure
 */
export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
}

/**
 * Start event - emitted when extraction begins
 */
export interface StartEvent extends StreamEvent {
  type: "start";
  totalPages: number;
  pdfPath: string;
}

/**
 * Page event - emitted when a page is processed
 */
export interface PageEvent extends StreamEvent {
  type: "page";
  pageNumber: number;
  totalPages: number;
  textLength: number;
  imageCount: number;
  pageInfo?: PageInfo;
}

/**
 * Image event - emitted when an image is extracted
 */
export interface ImageEvent extends StreamEvent {
  type: "image";
  image: ImageItem;
  pageNumber: number;
  imageIndex: number;
  totalImages: number;
}

/**
 * Progress event - emitted periodically during extraction
 */
export interface ProgressEvent extends StreamEvent {
  type: "progress";
  pagesProcessed: number;
  totalPages: number;
  imagesExtracted: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}

/**
 * Complete event - emitted when extraction finishes
 */
export interface CompleteEvent extends StreamEvent {
  type: "complete";
  totalPages: number;
  totalImages: number;
  totalTextLength: number;
  duration: number;
}

/**
 * Error event - emitted when an error occurs
 */
export interface ErrorEvent extends StreamEvent {
  type: "error";
  error: Error;
  pageNumber?: number;
  recoverable: boolean;
}

/**
 * Union type of all stream events
 */
export type StreamEventUnion =
  | StartEvent
  | PageEvent
  | ImageEvent
  | ProgressEvent
  | CompleteEvent
  | ErrorEvent;

/**
 * Streaming extraction options
 */
export interface StreamingOptions {
  /**
   * Enable streaming mode
   * @default false
   */
  streamMode?: boolean;

  /**
   * Automatically enable streaming for PDFs with more than this many pages
   * @default 100
   */
  autoStreamThreshold?: number;

  /**
   * Enable backpressure handling (pause extraction if consumer is slow)
   * @default true
   */
  enableBackpressure?: boolean;

  /**
   * Maximum number of pages to buffer before pausing (backpressure)
   * @default 10
   */
  maxBufferedPages?: number;

  /**
   * Emit progress events every N pages
   * @default 5
   */
  progressInterval?: number;

  /**
   * Enable event callbacks (in addition to async iterator)
   * @default false
   */
  enableEventCallbacks?: boolean;
}

/**
 * Event callback function type
 */
export type StreamEventCallback = (event: StreamEventUnion) => void | Promise<void>;

/**
 * Event callbacks map
 */
export interface StreamEventCallbacks {
  onStart?: (event: StartEvent) => void | Promise<void>;
  onPage?: (event: PageEvent) => void | Promise<void>;
  onImage?: (event: ImageEvent) => void | Promise<void>;
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  onComplete?: (event: CompleteEvent) => void | Promise<void>;
  onError?: (event: ErrorEvent) => void | Promise<void>;
  onAny?: StreamEventCallback;
}

/**
 * Streaming extraction result (async iterator)
 */
export interface StreamingExtractionResult {
  /**
   * Async iterator for streaming events
   */
  [Symbol.asyncIterator](): AsyncIterator<StreamEventUnion>;

  /**
   * Register event callbacks
   */
  on(event: "start", callback: (event: StartEvent) => void | Promise<void>): this;
  on(event: "page", callback: (event: PageEvent) => void | Promise<void>): this;
  on(event: "image", callback: (event: ImageEvent) => void | Promise<void>): this;
  on(
    event: "progress",
    callback: (event: ProgressEvent) => void | Promise<void>
  ): this;
  on(
    event: "complete",
    callback: (event: CompleteEvent) => void | Promise<void>
  ): this;
  on(event: "error", callback: (event: ErrorEvent) => void | Promise<void>): this;
  on(event: "any", callback: StreamEventCallback): this;

  /**
   * Cancel the streaming extraction
   */
  cancel(): Promise<void>;

  /**
   * Pause the streaming extraction (backpressure)
   */
  pause(): void;

  /**
   * Resume the streaming extraction
   */
  resume(): void;

  /**
   * Get current streaming statistics
   */
  getStats(): StreamingStats;
}

/**
 * Streaming statistics
 */
export interface StreamingStats {
  pagesProcessed: number;
  totalPages: number;
  imagesExtracted: number;
  bytesProcessed: number;
  startTime: number;
  elapsedTime: number;
  isPaused: boolean;
  isCancelled: boolean;
  isComplete: boolean;
  averagePageTime: number;
  estimatedTimeRemaining: number;
}

/**
 * Internal streaming state
 */
export interface StreamingState {
  totalPages: number;
  pagesProcessed: number;
  imagesExtracted: number;
  totalTextLength: number;
  bytesProcessed: number;
  startTime: number;
  lastProgressTime: number;
  isPaused: boolean;
  isCancelled: boolean;
  isComplete: boolean;
  bufferedPages: number;
  eventQueue: StreamEventUnion[];
  callbacks: StreamEventCallbacks;
}

