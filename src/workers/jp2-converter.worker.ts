/**
 * JP2 Converter Worker
 * Converts JPEG 2000 (JP2) images to JPEG format in a worker thread
 */

import { parentPort } from "node:worker_threads";
import type { WorkerTask, WorkerResult } from "../types/worker-types.js";

if (!parentPort) {
  throw new Error("This script must be run as a worker thread");
}

parentPort.on("message", async (task: WorkerTask) => {
  const startTime = Date.now();

  try {
    if (task.type !== "convert") {
      throw new Error(`Invalid task type: ${task.type}`);
    }

    const { buffer, options } = task.data;
    const quality = options?.quality ?? 100;
    const useSharp = options?.useSharp ?? false;

    // Import the converter dynamically to avoid loading it at startup
    const { convertJp2ToJpg } = await import(
      "../utils/jp2-to-jpg-converter.js"
    );

    // For worker threads, we need to write the buffer to a temp file first
    // because the converter expects a file path
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");

    const tempDir = os.tmpdir();
    const tempJp2Path = path.join(tempDir, `worker-${task.taskId}.jp2`);
    const tempJpgPath = path.join(tempDir, `worker-${task.taskId}.jpg`);

    try {
      // Write JP2 buffer to temp file
      fs.writeFileSync(tempJp2Path, buffer);

      // Convert using the main converter
      const result = await convertJp2ToJpg(tempJp2Path, {
        quality,
        verbose: false,
        deleteOriginal: true,
        useSharp: useSharp,
      });

      if (!result.success || !result.newPath) {
        throw new Error(result.error || "Conversion failed");
      }

      // Read the converted JPG
      const jpgBuffer = fs.readFileSync(result.newPath);

      // Clean up temp files
      try {
        if (fs.existsSync(result.newPath)) {
          fs.unlinkSync(result.newPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      const duration = Date.now() - startTime;

      const workerResult: WorkerResult = {
        success: true,
        taskId: task.taskId,
        data: jpgBuffer,
        stats: {
          duration,
          inputSize: buffer.length,
          outputSize: jpgBuffer.length,
        },
      };

      parentPort!.postMessage(workerResult);
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(tempJp2Path)) {
          fs.unlinkSync(tempJp2Path);
        }
        if (fs.existsSync(tempJpgPath)) {
          fs.unlinkSync(tempJpgPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    const result: WorkerResult = {
      success: false,
      taskId: task.taskId,
      error:
        error instanceof Error ? error.message : "Unknown conversion error",
    };

    parentPort!.postMessage(result);
  }
});
