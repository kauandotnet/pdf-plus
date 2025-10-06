import type { BaseImageEngine } from "./base-image-engine.js";
import { PdfLibEngine } from "./pdf-lib-engine.js";

/**
 * Factory for creating and managing image extraction engines
 *
 * Simplified to use only PDF-lib for extraction.
 * Image optimization is handled separately by Jimp (pure JavaScript).
 */
export class ImageEngineFactory {
  private static engine: BaseImageEngine | null = null;

  /**
   * Get the PDF-lib image extraction engine
   */
  static async getEngine(): Promise<BaseImageEngine> {
    // Check if engine is already cached
    if (ImageEngineFactory.engine) {
      return ImageEngineFactory.engine;
    }

    // Create new engine instance
    const engine = new PdfLibEngine();

    // Verify engine is available
    const isAvailable = await engine.isAvailable();
    if (!isAvailable) {
      throw new Error(
        "PDF-lib engine is not available on this system. Please install pdf-lib: npm install pdf-lib"
      );
    }

    // Cache and return
    ImageEngineFactory.engine = engine;
    return engine;
  }

  /**
   * Get all available engines
   */
  static async getAvailableEngines(): Promise<
    Array<{
      name: string;
      description: string;
      available: boolean;
    }>
  > {
    const engine = new PdfLibEngine();
    const available = await engine.isAvailable();

    return [
      {
        name: engine.name,
        description: engine.description,
        available,
      },
    ];
  }

  /**
   * Clear engine cache (useful for testing)
   */
  static clearCache(): void {
    ImageEngineFactory.engine = null;
  }

  /**
   * Get engine recommendations based on use case
   */
  static getRecommendations(): Array<{
    useCase: string;
    engine: "pdf-lib";
    reason: string;
  }> {
    return [
      {
        useCase: "Maximum format support and metadata accuracy",
        engine: "pdf-lib",
        reason:
          "Supports all PDF image formats including JPEG 2000, PNG with proper metadata extraction",
      },
      {
        useCase: "Cross-platform compatibility",
        engine: "pdf-lib",
        reason: "Pure JavaScript implementation, works everywhere Node.js runs",
      },
      {
        useCase: "Best performance",
        engine: "pdf-lib",
        reason: "Direct PDF buffer reading with no external dependencies",
      },
    ];
  }
}
