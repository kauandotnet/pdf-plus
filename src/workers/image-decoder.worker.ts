/**
 * Image Decoder Worker
 * Handles decompression and decoding of image data in a separate thread
 */

import { parentPort } from "node:worker_threads";
import zlib from "node:zlib";
import { promisify } from "node:util";
import type { WorkerTask, WorkerResult } from "../types/worker-types.js";

const inflateAsync = promisify(zlib.inflate);

if (!parentPort) {
  throw new Error("This script must be run as a worker thread");
}

parentPort.on("message", async (task: WorkerTask) => {
  const startTime = Date.now();

  try {
    if (task.type !== "decode") {
      throw new Error(`Invalid task type: ${task.type}`);
    }

    const { buffer, options } = task.data;
    const { filter } = options;

    const inputSize = buffer.length;

    // Decode based on filter type
    const decodedData = await (async (): Promise<Buffer> => {
      switch (filter) {
        case "FlateDecode":
          // Decompress using zlib
          return await inflateAsync(buffer);

        case "DCTDecode":
          // JPEG - already compressed, no decoding needed
          return buffer;

        case "JPXDecode":
          // JPEG 2000 - already compressed, no decoding needed
          return buffer;

        default:
          // Unknown filter - return as-is
          return buffer;
      }
    })();

    const outputSize = decodedData.length;
    const duration = Date.now() - startTime;

    const result: WorkerResult = {
      success: true,
      taskId: task.taskId,
      data: decodedData,
      stats: {
        duration,
        inputSize,
        outputSize,
      },
    };

    parentPort!.postMessage(result);
  } catch (error) {
    const result: WorkerResult = {
      success: false,
      taskId: task.taskId,
      error: error instanceof Error ? error.message : "Unknown decode error",
    };

    parentPort!.postMessage(result);
  }
});
