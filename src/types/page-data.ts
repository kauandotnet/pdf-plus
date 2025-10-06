/**
 * Page data for structured output
 */
export interface PageImageData {
  id: string;
  name: string;
  filename?: string;
  path?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format: string;
  size?: number;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface PageData {
  pageNumber: number;
  text: {
    content: string;
    rawText: string;
    wordCount: number;
    characterCount: number;
  };
  images: PageImageData[];
  imageCount: number;
  pageImage?: {
    path: string;
    format: string;
    width: number;
    height: number;
    size: number;
    dpi?: number;
    quality?: number;
  };
  thumbnail?: {
    path: string;
    format: string;
    width: number;
    height: number;
    size: number;
    quality?: number;
  };
  pageImageVariants?: Array<{
    path: string;
    format: string;
    width: number;
    height: number;
    size: number;
    quality: number;
    dpi?: number;
  }>;
}

