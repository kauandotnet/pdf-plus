import type { BaseImageEngine } from "./base-image-engine.js";
import { PdfLibEngine } from "./pdf-lib-engine.js";
import { PopplerEngine } from "./poppler-engine.js";
import type { ImageExtractionEngine } from "../../types/index.js";

/**
 * Factory for creating and managing image extraction engines
 */
export class ImageEngineFactory {
  private static engines: Map<string, BaseImageEngine> = new Map();

  /**
   * Get an image extraction engine by name
   */
  static async getEngine(engineName: ImageExtractionEngine): Promise<BaseImageEngine> {
    // Handle 'auto' selection
    if (engineName === 'auto') {
      engineName = await ImageEngineFactory.selectBestEngine();
    }

    // Check if engine is already cached
    if (ImageEngineFactory.engines.has(engineName)) {
      return ImageEngineFactory.engines.get(engineName)!;
    }

    // Create new engine instance
    let engine: BaseImageEngine;
    
    switch (engineName) {
      case 'pdf-lib':
        engine = new PdfLibEngine();
        break;
      case 'poppler':
        engine = new PopplerEngine();
        break;
      default:
        throw new Error(`Unknown image extraction engine: ${engineName}`);
    }

    // Verify engine is available
    const isAvailable = await engine.isAvailable();
    if (!isAvailable) {
      throw new Error(`Image extraction engine '${engineName}' is not available on this system`);
    }

    // Cache and return
    ImageEngineFactory.engines.set(engineName, engine);
    return engine;
  }

  /**
   * Get all available engines
   */
  static async getAvailableEngines(): Promise<Array<{
    name: string;
    description: string;
    available: boolean;
    capabilities: ReturnType<BaseImageEngine['getCapabilities']>;
  }>> {
    const engineClasses = [
      PdfLibEngine,
      PopplerEngine,
    ];

    const results = [];

    for (const EngineClass of engineClasses) {
      const engine = new EngineClass();
      const available = await engine.isAvailable();
      
      results.push({
        name: engine.name,
        description: engine.description,
        available,
        capabilities: engine.getCapabilities(),
      });
    }

    return results;
  }

  /**
   * Automatically select the best available engine
   */
  static async selectBestEngine(): Promise<Exclude<ImageExtractionEngine, 'auto'>> {
    const engines = await ImageEngineFactory.getAvailableEngines();
    
    // Priority order: pdf-lib (most comprehensive) > poppler
    const priorities: Array<Exclude<ImageExtractionEngine, 'auto'>> = ['pdf-lib', 'poppler'];
    
    for (const engineName of priorities) {
      const engine = engines.find(e => e.name === engineName);
      if (engine && engine.available) {
        return engineName;
      }
    }

    throw new Error('No image extraction engines are available on this system');
  }

  /**
   * Clear engine cache (useful for testing)
   */
  static clearCache(): void {
    ImageEngineFactory.engines.clear();
  }

  /**
   * Get engine recommendations based on use case
   */
  static getRecommendations(): Array<{
    useCase: string;
    engine: Exclude<ImageExtractionEngine, 'auto'>;
    reason: string;
  }> {
    return [
      {
        useCase: "Maximum format support and metadata accuracy",
        engine: "pdf-lib",
        reason: "Supports all PDF image formats including JPEG 2000, PNG with proper metadata extraction"
      },
      {
        useCase: "Fast extraction with system tools",
        engine: "poppler",
        reason: "Uses optimized native poppler tools, good for batch processing"
      },
      {
        useCase: "Cross-platform compatibility",
        engine: "pdf-lib",
        reason: "Pure JavaScript implementation, works everywhere Node.js runs"
      },
      {
        useCase: "Vector image extraction",
        engine: "poppler",
        reason: "Poppler can extract vector graphics as raster images"
      }
    ];
  }
}
