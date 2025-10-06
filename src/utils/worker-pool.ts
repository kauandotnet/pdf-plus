/**
 * Adaptive Worker Pool with auto-scaling based on system resources
 */

import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  WorkerTask,
  WorkerResult,
  WorkerPoolOptions,
  WorkerPoolStats,
  WorkerInfo,
  QueuedTask,
} from "../types/worker-types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AdaptiveWorkerPool {
  private workers: Map<string, WorkerInfo> = new Map();
  private availableWorkers: string[] = [];
  private taskQueue: QueuedTask[] = [];
  private workerInstances: Map<string, Worker> = new Map();

  private options: Required<WorkerPoolOptions>;
  private stats = {
    completedTasks: 0,
    failedTasks: 0,
    totalTaskDuration: 0,
  };

  private monitorInterval?: NodeJS.Timeout;
  private isTerminating = false;

  constructor(options: WorkerPoolOptions = {}) {
    const cpuCount = os.cpus().length;

    this.options = {
      maxWorkerThreads: options.maxWorkerThreads ?? Math.max(1, cpuCount - 1),
      minWorkerThreads: options.minWorkerThreads ?? 1,
      autoScaleWorkers: options.autoScaleWorkers ?? true,
      memoryThreshold: options.memoryThreshold ?? 0.8,
      cpuThreshold: options.cpuThreshold ?? 0.9,
      workerTaskTimeout: options.workerTaskTimeout ?? 30000,
      workerIdleTimeout: options.workerIdleTimeout ?? 60000,
      workerMemoryLimit: options.workerMemoryLimit ?? 512,
      verbose: options.verbose ?? false,
    };

    // DON'T initialize workers in constructor - do it in async initialize() method
  }

  /**
   * Initialize the worker pool (must be called after construction)
   */
  async initialize(): Promise<void> {
    // Start with minimum workers
    await this.initializeWorkers();

    // Start resource monitoring if auto-scaling is enabled
    if (this.options.autoScaleWorkers) {
      this.startMonitoring();
    }
  }

  /**
   * Initialize minimum number of workers
   */
  private async initializeWorkers(): Promise<void> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Worker initialization timeout after 10s")),
        10000
      )
    );

    const workerIndices = Array.from(
      { length: this.options.minWorkerThreads },
      (_, i) => i
    );

    const init = Promise.all(workerIndices.map(() => this.spawnWorker()));
    await Promise.race([init, timeout]);
  }

  /**
   * Spawn a new worker
   * Note: This just creates the worker metadata. The actual Worker instance
   * is created lazily when first needed (in getWorkerInstance).
   */
  private async spawnWorker(): Promise<string> {
    const workerId = `worker-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const workerInfo: WorkerInfo = {
      id: workerId,
      state: "idle",
      tasksCompleted: 0,
      lastTaskTime: Date.now(),
      memoryUsage: 0,
    };

    this.workers.set(workerId, workerInfo);
    this.availableWorkers.push(workerId);

    if (this.options.verbose) {
      console.log(
        `🔧 Spawned worker ${workerId} (total: ${this.workers.size})`
      );
    }

    return workerId;
  }

  /**
   * Get or create a worker instance for a specific task type
   */
  private async getWorkerInstance(
    workerId: string,
    taskType: string
  ): Promise<Worker> {
    const key = `${workerId}-${taskType}`;
    const existingWorker = this.workerInstances.get(key);

    if (existingWorker) {
      return existingWorker;
    }

    // Determine worker script path based on task type
    const workerScript = this.getWorkerScriptPath(taskType);

    // Check if file exists
    const fs = await import("node:fs");
    if (!fs.existsSync(workerScript)) {
      throw new Error(`Worker script not found: ${workerScript}`);
    }

    const newWorker = new Worker(workerScript, {
      resourceLimits: {
        maxOldGenerationSizeMb: this.options.workerMemoryLimit,
        maxYoungGenerationSizeMb: Math.floor(
          this.options.workerMemoryLimit / 4
        ),
      },
    });

    this.workerInstances.set(key, newWorker);

    // Handle worker errors
    newWorker.on("error", (error) => {
      if (this.options.verbose) {
        console.error(`❌ Worker ${workerId} error:`, error);
      }
      this.handleWorkerError(workerId, error);
    });

    newWorker.on("exit", (code) => {
      if (code !== 0 && this.options.verbose) {
        console.error(`❌ Worker ${workerId} exited with code ${code}`);
      }
      this.workerInstances.delete(key);
    });

    return newWorker;
  }

  /**
   * Get worker script path based on task type
   */
  private getWorkerScriptPath(taskType: string): string {
    // The worker-pool code is bundled into dist/index.js
    // __dirname will be dist/ when running
    // Workers are in dist/workers/
    const workerScripts: Record<string, string> = {
      decode: path.resolve(__dirname, "workers/image-decoder.worker.js"),
      convert: path.resolve(__dirname, "workers/jp2-converter.worker.js"),
      optimize: path.resolve(__dirname, "workers/image-optimizer.worker.js"),
    };

    return workerScripts[taskType] || workerScripts.decode;
  }

  /**
   * Execute a task in a worker thread
   */
  async execute<T = WorkerResult>(task: WorkerTask): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask = {
        task,
        resolve: resolve as (result: WorkerResult) => void,
        reject,
        timestamp: Date.now(),
      };

      this.taskQueue.push(queuedTask);
      this.processQueue();
    });
  }

  /**
   * Process queued tasks
   */
  private async processQueue(): Promise<void> {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const queuedTask = this.taskQueue.shift();
      const workerId = this.availableWorkers.shift();

      if (!queuedTask || !workerId) break;

      this.executeTask(workerId, queuedTask);
    }

    // Scale up if needed
    if (
      this.taskQueue.length > 0 &&
      this.availableWorkers.length === 0 &&
      this.workers.size < this.options.maxWorkerThreads
    ) {
      await this.scaleUp();
      this.processQueue(); // Try again with new worker
    }
  }

  /**
   * Execute a task on a specific worker
   */
  private async executeTask(
    workerId: string,
    queuedTask: QueuedTask
  ): Promise<void> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.state = "busy";
    const startTime = Date.now();

    try {
      const worker = await this.getWorkerInstance(
        workerId,
        queuedTask.task.type
      );

      // Set up timeout
      const timeout = setTimeout(() => {
        queuedTask.reject(
          new Error(
            `Worker task ${queuedTask.task.taskId} timed out after ${this.options.workerTaskTimeout}ms`
          )
        );
        this.handleWorkerTimeout(workerId);
      }, this.options.workerTaskTimeout);

      // Listen for result
      const messageHandler = (result: WorkerResult) => {
        clearTimeout(timeout);
        worker.off("message", messageHandler);

        const duration = Date.now() - startTime;
        this.stats.completedTasks++;
        this.stats.totalTaskDuration += duration;

        workerInfo.tasksCompleted++;
        workerInfo.lastTaskTime = Date.now();
        workerInfo.state = "idle";

        this.availableWorkers.push(workerId);

        if (result.success) {
          queuedTask.resolve(result);
        } else {
          queuedTask.reject(new Error(result.error || "Worker task failed"));
        }

        // Process next task
        this.processQueue();
      };

      worker.on("message", messageHandler);

      // Send task to worker
      worker.postMessage(queuedTask.task);
    } catch (error) {
      clearTimeout(setTimeout(() => {}, this.options.workerTaskTimeout));
      this.stats.failedTasks++;
      workerInfo.state = "idle";
      this.availableWorkers.push(workerId);
      queuedTask.reject(
        error instanceof Error ? error : new Error("Unknown worker error")
      );
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, _error: Error): void {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.state = "idle";
      // Don't add back to available workers - let it be cleaned up
    }
  }

  /**
   * Handle worker timeout
   */
  private handleWorkerTimeout(workerId: string): void {
    if (this.options.verbose) {
      console.log(`⏱️  Worker ${workerId} timed out, terminating...`);
    }
    this.terminateWorker(workerId);
  }

  /**
   * Terminate a specific worker
   */
  private async terminateWorker(workerId: string): Promise<void> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.state = "terminating";

    // Terminate all worker instances for this worker ID
    for (const [key, worker] of this.workerInstances.entries()) {
      if (key.startsWith(workerId)) {
        await worker.terminate();
        this.workerInstances.delete(key);
      }
    }

    this.workers.delete(workerId);
    const index = this.availableWorkers.indexOf(workerId);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }

    if (this.options.verbose) {
      console.log(
        `🗑️  Terminated worker ${workerId} (remaining: ${this.workers.size})`
      );
    }
  }

  /**
   * Scale up workers
   */
  private async scaleUp(): Promise<void> {
    if (this.workers.size >= this.options.maxWorkerThreads) return;

    const memUsage = this.getMemoryUsage();
    if (memUsage > this.options.memoryThreshold) {
      if (this.options.verbose) {
        console.log(
          `⚠️  Memory usage ${(memUsage * 100).toFixed(1)}% - not scaling up`
        );
      }
      return;
    }

    await this.spawnWorker();
  }

  /**
   * Scale down workers
   */
  private async scaleDown(): Promise<void> {
    if (this.workers.size <= this.options.minWorkerThreads) return;

    // Find idle workers
    const idleWorkers = Array.from(this.workers.entries())
      .filter(
        ([, info]) =>
          info.state === "idle" &&
          Date.now() - info.lastTaskTime > this.options.workerIdleTimeout
      )
      .map(([id]) => id);

    if (idleWorkers.length > 0) {
      const workerToTerminate = idleWorkers[0];
      await this.terminateWorker(workerToTerminate);
    }
  }

  /**
   * Start resource monitoring
   */
  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      this.monitorResources();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Monitor system resources and scale accordingly
   */
  private async monitorResources(): Promise<void> {
    if (this.isTerminating) return;

    const memUsage = this.getMemoryUsage();

    if (memUsage > this.options.memoryThreshold) {
      // Memory pressure - scale down
      await this.scaleDown();
    } else if (this.taskQueue.length > 0) {
      // Tasks waiting and memory OK - scale up
      await this.scaleUp();
    } else {
      // No tasks - clean up idle workers
      await this.scaleDown();
    }
  }

  /**
   * Get current memory usage (0-1)
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    const totalMem = os.totalmem();
    return usage.heapUsed / totalMem;
  }

  /**
   * Get pool statistics
   */
  getStats(): WorkerPoolStats {
    const activeWorkers = Array.from(this.workers.values()).filter(
      (w) => w.state === "busy"
    ).length;

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      idleWorkers: this.workers.size - activeWorkers,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
      averageTaskDuration:
        this.stats.completedTasks > 0
          ? this.stats.totalTaskDuration / this.stats.completedTasks
          : 0,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: 0, // TODO: Implement CPU usage tracking
    };
  }

  /**
   * Terminate all workers and clean up
   */
  async terminate(): Promise<void> {
    this.isTerminating = true;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Terminate all workers
    const terminatePromises = Array.from(this.workers.keys()).map((id) =>
      this.terminateWorker(id)
    );

    await Promise.all(terminatePromises);

    if (this.options.verbose) {
      console.log("🛑 Worker pool terminated");
    }
  }
}
