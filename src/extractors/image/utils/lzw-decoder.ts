/**
 * High-performance LZW decoder using Map for dictionary
 * Optimized for speed with minimal allocations
 */

/**
 * LZW decoder with Map-based dictionary for O(1) lookups
 */
export class LZWDecoder {
  private readonly dictionary: Map<number, Buffer>;
  private nextCode: number;
  private readonly clearCode: number;
  private readonly endCode: number;

  constructor() {
    this.dictionary = new Map();
    this.clearCode = 256;
    this.endCode = 257;
    this.nextCode = 258;
    this.initializeDictionary();
  }

  /**
   * Initialize dictionary with single-byte values (0-255)
   */
  private initializeDictionary(): void {
    for (let i = 0; i < 256; i++) {
      this.dictionary.set(i, Buffer.from([i]));
    }
  }

  /**
   * Reset dictionary to initial state
   */
  private resetDictionary(): void {
    this.dictionary.clear();
    this.initializeDictionary();
    this.nextCode = 258;
  }

  /**
   * Decode LZW-compressed data
   */
  decode(compressedData: Buffer): Buffer {
    const bitReader = new BitReader(compressedData);
    const output: Buffer[] = [];

    const firstCode = bitReader.readCode();
    if (firstCode === this.clearCode) {
      const nextFirstCode = bitReader.readCode();
      const entry = this.dictionary.get(nextFirstCode);
      if (entry) {
        output.push(entry);
      }
      return this.decodeStream(bitReader, nextFirstCode, output);
    }

    const entry = this.dictionary.get(firstCode);
    if (entry) {
      output.push(entry);
    }
    return this.decodeStream(bitReader, firstCode, output);
  }

  /**
   * Decode the bit stream
   */
  private decodeStream(
    bitReader: BitReader,
    prevCode: number,
    output: Buffer[]
  ): Buffer {
    while (true) {
      const code = bitReader.readCode();

      if (code === this.endCode || code === -1) {
        break;
      }

      if (code === this.clearCode) {
        this.resetDictionary();
        bitReader.resetCodeSize();
        const nextCode = bitReader.readCode();
        if (nextCode === this.endCode || nextCode === -1) {
          break;
        }
        const entry = this.dictionary.get(nextCode);
        if (entry) {
          output.push(entry);
        }
        prevCode = nextCode;
        continue;
      }

      const dictEntry = this.dictionary.get(code);
      const entry = dictEntry ?? this.createNewEntry(prevCode, code);

      if (entry) {
        output.push(entry);

        // Add new dictionary entry
        const prevEntry = this.dictionary.get(prevCode);
        if (prevEntry && this.nextCode < 4096) {
          const newEntry = Buffer.concat([prevEntry, Buffer.from([entry[0]!])]);
          this.dictionary.set(this.nextCode, newEntry);
          this.nextCode++;

          // Increase code size when needed
          if (
            this.nextCode === 512 ||
            this.nextCode === 1024 ||
            this.nextCode === 2048
          ) {
            bitReader.increaseCodeSize();
          }
        }
      }

      prevCode = code;
    }

    return Buffer.concat(output);
  }

  /**
   * Create new entry when code is not in dictionary
   */
  private createNewEntry(prevCode: number, _code: number): Buffer | null {
    const prevEntry = this.dictionary.get(prevCode);
    if (!prevEntry) return null;

    return Buffer.concat([prevEntry, Buffer.from([prevEntry[0]!])]);
  }
}

/**
 * Efficient bit reader with minimal state
 */
class BitReader {
  private readonly data: Buffer;
  private bitPos: number;
  private codeSize: number;

  constructor(data: Buffer) {
    this.data = data;
    this.bitPos = 0;
    this.codeSize = 9;
  }

  /**
   * Read a code from the bit stream
   */
  readCode(): number {
    const totalBits = this.data.length * 8;
    if (this.bitPos + this.codeSize > totalBits) {
      return -1; // End of data
    }

    const code = this.extractBits(this.codeSize);
    this.bitPos += this.codeSize;
    return code;
  }

  /**
   * Extract bits from current position
   */
  private extractBits(numBits: number): number {
    let code = 0;
    for (let i = 0; i < numBits; i++) {
      const bytePos = Math.floor(this.bitPos / 8);
      const bitOffset = this.bitPos % 8;
      const byte = this.data[bytePos] ?? 0;
      const bit = (byte >> bitOffset) & 1;
      code |= bit << i;
      this.bitPos++;
    }
    this.bitPos -= numBits; // Reset for actual increment in readCode
    return code;
  }

  /**
   * Increase code size
   */
  increaseCodeSize(): void {
    if (this.codeSize < 12) {
      this.codeSize++;
    }
  }

  /**
   * Reset code size to initial value
   */
  resetCodeSize(): void {
    this.codeSize = 9;
  }
}
