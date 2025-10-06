/**
 * High-performance image collection using Map for O(1) lookups
 * Avoids array operations for better performance
 */

import type { ImageItem } from "../../../types/index.js";

/**
 * Efficient image collection with Map-based storage
 */
export class ImageCollection {
  private readonly imageMap: Map<string, ImageItem>;
  private nextId: number;

  constructor() {
    this.imageMap = new Map();
    this.nextId = 1;
  }

  /**
   * Add an image to the collection
   * Returns the assigned ID
   */
  add(image: Omit<ImageItem, "id">): string {
    const id = `img_${this.nextId}`;
    this.imageMap.set(id, { ...image, id });
    this.nextId++;
    return id;
  }

  /**
   * Get an image by ID
   */
  get(id: string): ImageItem | undefined {
    return this.imageMap.get(id);
  }

  /**
   * Check if an image exists
   */
  has(id: string): boolean {
    return this.imageMap.has(id);
  }

  /**
   * Get total count
   */
  get size(): number {
    return this.imageMap.size;
  }

  /**
   * Get current next ID value
   */
  get currentId(): number {
    return this.nextId;
  }

  /**
   * Convert to array (only when needed for final output)
   */
  toArray(): ReadonlyArray<ImageItem> {
    return Array.from(this.imageMap.values());
  }

  /**
   * Iterate over images
   */
  forEach(callback: (image: ImageItem) => void): void {
    this.imageMap.forEach(callback);
  }

  /**
   * Filter images
   */
  filter(predicate: (image: ImageItem) => boolean): ImageCollection {
    const filtered = new ImageCollection();
    this.imageMap.forEach((image) => {
      if (predicate(image)) {
        filtered.imageMap.set(image.id, image);
      }
    });
    return filtered;
  }

  /**
   * Get images by page
   */
  getByPage(pageNumber: number): ReadonlyArray<ImageItem> {
    const pageImages: ImageItem[] = [];
    this.imageMap.forEach((image) => {
      if (image.page === pageNumber) {
        pageImages.push(image);
      }
    });
    return pageImages;
  }
}

