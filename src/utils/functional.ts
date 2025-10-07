/**
 * Functional programming utilities
 * 
 * Provides common functional patterns for cleaner, more composable code.
 */

/**
 * Pipe functions together (left to right)
 */
export const pipe = <T>(...fns: Array<(arg: T) => T>) => {
  return (value: T): T => fns.reduce((acc, fn) => fn(acc), value);
};

/**
 * Compose functions together (right to left)
 */
export const compose = <T>(...fns: Array<(arg: T) => T>) => {
  return (value: T): T => fns.reduceRight((acc, fn) => fn(acc), value);
};

/**
 * Async pipe functions together
 */
export const pipeAsync = <T>(
  ...fns: Array<(arg: T) => Promise<T> | T>
) => {
  return async (value: T): Promise<T> => {
    let result = value;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };
};

/**
 * Curry a function
 */
export const curry = <A, B, C>(fn: (a: A, b: B) => C) => {
  return (a: A) => (b: B) => fn(a, b);
};

/**
 * Partial application
 */
export const partial = <A extends unknown[], B, C>(
  fn: (...args: [...A, B]) => C,
  ...args: A
) => {
  return (b: B) => fn(...args, b);
};

/**
 * Memoize a function
 */
export const memoize = <T extends (...args: unknown[]) => unknown>(
  fn: T
): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

/**
 * Throttle a function
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

/**
 * Retry a function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: {
    readonly maxAttempts?: number;
    readonly delay?: number;
    readonly backoff?: number;
  } = {}
): Promise<T> => {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelay = options.delay ?? 1000;
  const backoff = options.backoff ?? 2;
  
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxAttempts) {
        const delay = initialDelay * backoff ** (attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

/**
 * Chunk an array into smaller arrays
 */
export const chunk = <T>(array: readonly T[], size: number): readonly (readonly T[])[] => {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
};

/**
 * Group array items by a key
 */
export const groupBy = <T, K extends string | number>(
  array: readonly T[],
  keyFn: (item: T) => K
): Readonly<Record<K, readonly T[]>> => {
  const groups = {} as Record<K, T[]>;
  
  for (const item of array) {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  
  return groups;
};

/**
 * Unique array items
 */
export const unique = <T>(array: readonly T[]): readonly T[] => {
  return [...new Set(array)];
};

/**
 * Unique array items by key
 */
export const uniqueBy = <T, K>(
  array: readonly T[],
  keyFn: (item: T) => K
): readonly T[] => {
  const seen = new Set<K>();
  const result: T[] = [];
  
  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
};

/**
 * Flatten nested arrays
 */
export const flatten = <T>(array: readonly (T | readonly T[])[]): readonly T[] => {
  return array.flat() as T[];
};

/**
 * Deep flatten nested arrays
 */
export const flattenDeep = <T>(array: readonly unknown[]): readonly T[] => {
  return array.flat(Infinity) as T[];
};

/**
 * Partition array into two arrays based on predicate
 */
export const partition = <T>(
  array: readonly T[],
  predicate: (item: T) => boolean
): readonly [readonly T[], readonly T[]] => {
  const truthy: T[] = [];
  const falsy: T[] = [];
  
  for (const item of array) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  
  return [truthy, falsy];
};

/**
 * Pick properties from object
 */
export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
};

/**
 * Omit properties from object
 */
export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> => {
  const result = { ...obj };
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
};

/**
 * Deep freeze an object
 */
export const deepFreeze = <T>(obj: T): Readonly<T> => {
  Object.freeze(obj);
  
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  
  return obj;
};

