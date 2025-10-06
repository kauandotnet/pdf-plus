/**
 * High-performance TIFF encoder
 * Optimized for minimal allocations and fast encoding
 */

/**
 * TIFF encoding configuration
 */
interface TIFFConfig {
  readonly width: number;
  readonly height: number;
  readonly bitsPerSample: number;
  readonly compression: number;
  readonly photometric: number;
  readonly samplesPerPixel: number;
}

/**
 * TIFF encoder with efficient buffer management
 */
export class TIFFEncoder {
  private readonly config: TIFFConfig;
  private readonly imageData: Buffer;

  constructor(config: TIFFConfig, imageData: Buffer) {
    this.config = config;
    this.imageData = imageData;
  }

  /**
   * Encode to TIFF format
   */
  encode(): Buffer {
    const ifdEntries = this.createIFDEntries();
    const ifdSize = 2 + ifdEntries.length * 12 + 4; // Count + entries + next IFD offset
    const headerSize = 8; // TIFF header
    const ifdOffset = headerSize;
    const imageDataOffset = headerSize + ifdSize;
    const totalSize = imageDataOffset + this.imageData.length;

    const buffer = Buffer.allocUnsafe(totalSize);
    const writer = new BufferWriter(buffer);

    // Write TIFF header
    this.writeHeader(writer, ifdOffset);

    // Write IFD
    this.writeIFD(writer, ifdEntries, imageDataOffset);

    // Write image data
    writer.writeBuffer(this.imageData);

    return buffer;
  }

  /**
   * Write TIFF header
   */
  private writeHeader(writer: BufferWriter, ifdOffset: number): void {
    writer.writeUInt16LE(0x4949); // Little-endian byte order
    writer.writeUInt16LE(42);     // TIFF magic number
    writer.writeUInt32LE(ifdOffset); // Offset to first IFD
  }

  /**
   * Create IFD entries
   */
  private createIFDEntries(): IFDEntry[] {
    return [
      { tag: 256, type: 4, count: 1, value: this.config.width },           // ImageWidth
      { tag: 257, type: 4, count: 1, value: this.config.height },          // ImageLength
      { tag: 258, type: 3, count: 1, value: this.config.bitsPerSample },   // BitsPerSample
      { tag: 259, type: 3, count: 1, value: this.config.compression },     // Compression
      { tag: 262, type: 3, count: 1, value: this.config.photometric },     // PhotometricInterpretation
      { tag: 273, type: 4, count: 1, value: 0 },                           // StripOffsets (will be set later)
      { tag: 277, type: 3, count: 1, value: this.config.samplesPerPixel }, // SamplesPerPixel
      { tag: 278, type: 4, count: 1, value: this.config.height },          // RowsPerStrip
      { tag: 279, type: 4, count: 1, value: this.imageData.length },       // StripByteCounts
    ];
  }

  /**
   * Write IFD
   */
  private writeIFD(
    writer: BufferWriter,
    entries: IFDEntry[],
    imageDataOffset: number
  ): void {
    writer.writeUInt16LE(entries.length);

    for (const entry of entries) {
      writer.writeUInt16LE(entry.tag);
      writer.writeUInt16LE(entry.type);
      writer.writeUInt32LE(entry.count);

      // Special handling for StripOffsets
      if (entry.tag === 273) {
        writer.writeUInt32LE(imageDataOffset);
      } else {
        writer.writeUInt32LE(entry.value);
      }
    }

    writer.writeUInt32LE(0); // No next IFD
  }
}

/**
 * IFD entry structure
 */
interface IFDEntry {
  readonly tag: number;
  readonly type: number;
  readonly count: number;
  readonly value: number;
}

/**
 * Efficient buffer writer with position tracking
 */
class BufferWriter {
  private readonly buffer: Buffer;
  private position: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.position = 0;
  }

  writeUInt16LE(value: number): void {
    this.buffer.writeUInt16LE(value, this.position);
    this.position += 2;
  }

  writeUInt32LE(value: number): void {
    this.buffer.writeUInt32LE(value, this.position);
    this.position += 4;
  }

  writeBuffer(data: Buffer): void {
    data.copy(this.buffer, this.position);
    this.position += data.length;
  }

  getPosition(): number {
    return this.position;
  }
}

