import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { CacheInfo, PageExtractionResult } from "../types/index.js";

/**
 * Manages caching of PDF extraction results to avoid re-parsing
 */
export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir: string = "./tmp/pdf-cache") {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  /**
   * Generate cache key for a PDF file
   */
  private generateCacheKey(pdfPath: string): string {
    const absolutePath = path.resolve(pdfPath);
    const stats = fs.statSync(absolutePath);
    const content = `${absolutePath}:${stats.mtime.getTime()}:${stats.size}`;
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * Get cache directory for a PDF
   */
  private getCacheDir(pdfPath: string): string {
    const cacheKey = this.generateCacheKey(pdfPath);
    return path.join(this.cacheDir, cacheKey);
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Check if cache exists for PDF
   */
  isCached(pdfPath: string): boolean {
    try {
      const cacheDir = this.getCacheDir(pdfPath);
      const infoPath = path.join(cacheDir, "cache-info.json");
      return fs.existsSync(infoPath);
    } catch {
      return false;
    }
  }

  /**
   * Get cache info for PDF
   */
  getCacheInfo(pdfPath: string): CacheInfo | null {
    try {
      const cacheDir = this.getCacheDir(pdfPath);
      const infoPath = path.join(cacheDir, "cache-info.json");

      if (!fs.existsSync(infoPath)) {
        return null;
      }

      const info = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
      return info as CacheInfo;
    } catch {
      return null;
    }
  }

  /**
   * Create cache for PDF
   */
  createCache(pdfPath: string, totalPages: number): string {
    const cacheDir = this.getCacheDir(pdfPath);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const stats = fs.statSync(pdfPath);
    const cacheInfo: CacheInfo = {
      pdfPath: path.resolve(pdfPath),
      lastModified: stats.mtime.getTime(),
      totalPages,
      cacheDir,
      created: new Date().toISOString(),
    };

    const infoPath = path.join(cacheDir, "cache-info.json");
    fs.writeFileSync(infoPath, JSON.stringify(cacheInfo, null, 2));

    return cacheDir;
  }

  /**
   * Cache page extraction result
   */
  cachePageResult(
    pdfPath: string,
    pageNumber: number,
    result: PageExtractionResult
  ): void {
    try {
      const cacheDir = this.getCacheDir(pdfPath);
      const pageFile = path.join(cacheDir, `page-${pageNumber}.json`);
      fs.writeFileSync(pageFile, JSON.stringify(result, null, 2));
    } catch (_error) {
      // Silently fail cache writes
    }
  }

  /**
   * Get cached page result
   */
  getCachedPageResult(
    pdfPath: string,
    pageNumber: number
  ): PageExtractionResult | null {
    try {
      const cacheDir = this.getCacheDir(pdfPath);
      const pageFile = path.join(cacheDir, `page-${pageNumber}.json`);

      if (!fs.existsSync(pageFile)) {
        return null;
      }

      const result = JSON.parse(fs.readFileSync(pageFile, "utf-8"));
      return result as PageExtractionResult;
    } catch {
      return null;
    }
  }

  /**
   * Get all cached pages for PDF
   */
  getAllCachedPages(pdfPath: string): PageExtractionResult[] {
    try {
      const cacheDir = this.getCacheDir(pdfPath);
      const results: PageExtractionResult[] = [];

      if (!fs.existsSync(cacheDir)) {
        return results;
      }

      const files = fs.readdirSync(cacheDir);
      const pageFiles = files.filter(
        (f) => f.startsWith("page-") && f.endsWith(".json")
      );

      for (const file of pageFiles) {
        try {
          const filePath = path.join(cacheDir, file);
          const result = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          results.push(result as PageExtractionResult);
        } catch {
          // Skip corrupted cache files
        }
      }

      // Sort by page number
      results.sort((a, b) => a.pageNumber - b.pageNumber);
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Clear cache for PDF
   */
  clearCache(pdfPath: string): void {
    try {
      const cacheDir = this.getCacheDir(pdfPath);
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true, force: true });
      }
      this.ensureCacheDir();
    } catch {
      // Silently fail
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalCachedPdfs: number;
    totalCachedPages: number;
    totalCacheSize: number;
    cacheDir: string;
  } {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return {
          totalCachedPdfs: 0,
          totalCachedPages: 0,
          totalCacheSize: 0,
          cacheDir: this.cacheDir,
        };
      }

      const pdfDirs = fs.readdirSync(this.cacheDir);
      const totalCachedPdfs = pdfDirs.length;

      const { totalCachedPages, totalCacheSize } = pdfDirs.reduce(
        (acc, pdfDir) => {
          const pdfCacheDir = path.join(this.cacheDir, pdfDir);
          if (!fs.statSync(pdfCacheDir).isDirectory()) {
            return acc;
          }

          const files = fs.readdirSync(pdfCacheDir);
          const pageFiles = files.filter(
            (f) => f.startsWith("page-") && f.endsWith(".json")
          );

          const dirSize = files.reduce((sum, file) => {
            const filePath = path.join(pdfCacheDir, file);
            return sum + fs.statSync(filePath).size;
          }, 0);

          return {
            totalCachedPages: acc.totalCachedPages + pageFiles.length,
            totalCacheSize: acc.totalCacheSize + dirSize,
          };
        },
        { totalCachedPages: 0, totalCacheSize: 0 }
      );

      return {
        totalCachedPdfs,
        totalCachedPages,
        totalCacheSize,
        cacheDir: this.cacheDir,
      };
    } catch {
      return {
        totalCachedPdfs: 0,
        totalCachedPages: 0,
        totalCacheSize: 0,
        cacheDir: this.cacheDir,
      };
    }
  }
}
