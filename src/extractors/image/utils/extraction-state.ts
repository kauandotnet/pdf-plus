/**
 * Extraction state manager using Maps for efficient lookups
 * Avoids arrays for better performance
 */

import type { ImageItem } from "../../../types/index.js";

/**
 * Page processing state
 */
interface PageState {
  readonly pageNumber: number;
  readonly imageCount: number;
  readonly processed: boolean;
}

/**
 * Extraction state manager with Map-based storage
 */
export class ExtractionState {
  private readonly imageMap: Map<string, ImageItem>;
  private readonly pageStates: Map<number, PageState>;
  private readonly jp2Images: Map<string, ImageItem>;
  private globalImageId: number;

  constructor() {
    this.imageMap = new Map();
    this.pageStates = new Map();
    this.jp2Images = new Map();
    this.globalImageId = 1;
  }

  /**
   * Get next image ID and increment
   */
  getNextImageId(): number {
    const id = this.globalImageId;
    this.globalImageId++;
    return id;
  }

  /**
   * Get current image ID without incrementing
   */
  getCurrentImageId(): number {
    return this.globalImageId;
  }

  /**
   * Add an image to the collection
   */
  addImage(image: ImageItem): void {
    this.imageMap.set(image.id, image);
  }

  /**
   * Add a JP2 image for later conversion
   */
  addJP2Image(image: ImageItem): void {
    this.jp2Images.set(image.id, image);
  }

  /**
   * Get all JP2 images
   */
  getJP2Images(): ReadonlyMap<string, ImageItem> {
    return this.jp2Images;
  }

  /**
   * Clear JP2 images after conversion
   */
  clearJP2Images(): void {
    this.jp2Images.clear();
  }

  /**
   * Update page state
   */
  updatePageState(pageNumber: number, imageCount: number): void {
    this.pageStates.set(pageNumber, {
      pageNumber,
      imageCount,
      processed: true,
    });
  }

  /**
   * Get page state
   */
  getPageState(pageNumber: number): PageState | undefined {
    return this.pageStates.get(pageNumber);
  }

  /**
   * Get total image count
   */
  getTotalImages(): number {
    return this.imageMap.size;
  }

  /**
   * Get total pages processed
   */
  getTotalPagesProcessed(): number {
    return this.pageStates.size;
  }

  /**
   * Get all images as array (only for final output)
   */
  toArray(): ReadonlyArray<ImageItem> {
    return Array.from(this.imageMap.values());
  }

  /**
   * Get images by page
   */
  getImagesByPage(pageNumber: number): ReadonlyArray<ImageItem> {
    const pageImages: ImageItem[] = [];
    this.imageMap.forEach((image) => {
      if (image.page === pageNumber) {
        pageImages.push(image);
      }
    });
    return pageImages;
  }

  /**
   * Check if an image exists
   */
  hasImage(id: string): boolean {
    return this.imageMap.has(id);
  }

  /**
   * Get an image by ID
   */
  getImage(id: string): ImageItem | undefined {
    return this.imageMap.get(id);
  }
}

