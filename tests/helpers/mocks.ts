import type { ExtractionOptions, ExtractionResult, ImageItem, PageData } from "../../src/types/index.js";

/**
 * Create a mock ExtractionResult
 */
export function createMockExtractionResult(
  overrides?: Partial<ExtractionResult>
): ExtractionResult {
  return {
    text: "Mock PDF text content",
    images: [],
    metadata: {
      title: "Mock PDF",
      author: "Test Author",
      subject: "Test Subject",
      keywords: "test, mock, pdf",
      creator: "Test Creator",
      producer: "Test Producer",
      creationDate: new Date("2024-01-01"),
      modificationDate: new Date("2024-01-01"),
      pageCount: 1,
    },
    pages: [
      {
        pageNumber: 1,
        text: {
          content: "Mock PDF text content",
          rawText: "Mock PDF text content",
          wordCount: 4,
          characterCount: 24,
        },
        images: [],
        imageCount: 0,
        width: 612,
        height: 792,
      },
    ],
    ...overrides,
  };
}

/**
 * Create a mock ImageItem
 */
export function createMockImageItem(
  overrides?: Partial<ImageItem>
): ImageItem {
  return {
    id: "img-1",
    name: "image-1.jpg",
    format: "jpeg",
    width: 800,
    height: 600,
    data: Buffer.from("mock-image-data"),
    pageNumber: 1,
    ...overrides,
  };
}

/**
 * Create a mock PageData
 */
export function createMockPageData(overrides?: Partial<PageData>): PageData {
  return {
    pageNumber: 1,
    text: {
      content: "Mock page text",
      rawText: "Mock page text",
      wordCount: 3,
      characterCount: 14,
    },
    images: [],
    imageCount: 0,
    width: 612,
    height: 792,
    ...overrides,
  };
}

/**
 * Create mock ExtractionOptions
 */
export function createMockOptions(
  overrides?: Partial<ExtractionOptions>
): ExtractionOptions {
  return {
    extractText: true,
    extractImages: false,
    extractImageFiles: false,
    verbose: false,
    ...overrides,
  };
}

/**
 * Mock console methods for testing
 */
export class MockConsole {
  private logs: string[] = [];
  private errors: string[] = [];
  private warns: string[] = [];

  log(...args: any[]): void {
    this.logs.push(args.join(" "));
  }

  error(...args: any[]): void {
    this.errors.push(args.join(" "));
  }

  warn(...args: any[]): void {
    this.warns.push(args.join(" "));
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  getWarns(): string[] {
    return [...this.warns];
  }

  clear(): void {
    this.logs = [];
    this.errors = [];
    this.warns = [];
  }

  hasLog(message: string): boolean {
    return this.logs.some((log) => log.includes(message));
  }

  hasError(message: string): boolean {
    return this.errors.some((error) => error.includes(message));
  }

  hasWarn(message: string): boolean {
    return this.warns.some((warn) => warn.includes(message));
  }
}

/**
 * Create a spy function for testing
 */
export function createSpy<T extends (...args: any[]) => any>(): {
  fn: T;
  calls: any[][];
  callCount: number;
  reset: () => void;
} {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
  }) as T;

  return {
    fn,
    calls,
    get callCount() {
      return calls.length;
    },
    reset() {
      calls.length = 0;
    },
  };
}

/**
 * Mock file system operations
 */
export class MockFileSystem {
  private files = new Map<string, Buffer | string>();

  writeFileSync(path: string, data: Buffer | string): void {
    this.files.set(path, data);
  }

  readFileSync(path: string): Buffer | string {
    const data = this.files.get(path);
    if (!data) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return data;
  }

  existsSync(path: string): boolean {
    return this.files.has(path);
  }

  unlinkSync(path: string): void {
    this.files.delete(path);
  }

  getFiles(): Map<string, Buffer | string> {
    return new Map(this.files);
  }

  clear(): void {
    this.files.clear();
  }
}

/**
 * Create a mock progress callback
 */
export function createMockProgressCallback() {
  const calls: Array<{
    current: number;
    total: number;
    percentage: number;
    message?: string;
  }> = [];

  const callback = (progress: {
    current: number;
    total: number;
    percentage: number;
    message?: string;
  }) => {
    calls.push({ ...progress });
  };

  return {
    callback,
    calls,
    get callCount() {
      return calls.length;
    },
    getLastCall() {
      return calls[calls.length - 1];
    },
    reset() {
      calls.length = 0;
    },
  };
}

/**
 * Delay execution (for testing async operations)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock async iterator
 */
export async function* createMockAsyncIterator<T>(
  items: T[]
): AsyncIterableIterator<T> {
  for (const item of items) {
    await delay(10); // Simulate async delay
    yield item;
  }
}

