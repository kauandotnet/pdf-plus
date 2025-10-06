/**
 * Logger abstraction for dependency injection and testability
 */

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  debug(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

/**
 * No-op logger for silent mode
 */
export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Create logger based on verbose flag
 */
export const createLogger = (verbose: boolean): Logger => {
  return verbose ? new ConsoleLogger() : new NoOpLogger();
};

