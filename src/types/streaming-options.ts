/**
 * Streaming options
 */
export interface StreamingOptions {
  batchSize: number;
  memoryLimit: number;
  enableCaching: boolean;
  cacheSize?: number;
}

