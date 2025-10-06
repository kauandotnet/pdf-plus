declare module "@cornerstonejs/codec-openjpeg" {
  interface DecodeResult {
    width: number;
    height: number;
    componentsCount: number;
    tiles: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    isReady: () => boolean;
    getDecodedBuffer: () => ArrayBuffer;
  }

  interface OpenJPEGDecoder {
    decode: (buffer: ArrayBuffer) => DecodeResult;
  }

  const createDecoder: (options?: any) => Promise<OpenJPEGDecoder>;
  export { createDecoder as default };
}
