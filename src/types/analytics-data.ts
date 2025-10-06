/**
 * Analytics data
 */
export interface AnalyticsData {
  processingTime: number;
  memoryPeak: number;
  pagesPerSecond: number;
  errorCount: number;
  qualityScore?: number;
}

