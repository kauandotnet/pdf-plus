/**
 * Worker thread types and interfaces
 */

export type WorkerTaskType = "decode" | "convert" | "optimize";

export interface WorkerTask {
  type: WorkerTaskType;
  taskId: string;
  data: {
    buffer: Buffer;
    options: any;
  };
}

export interface WorkerResult {
  success: boolean;
  taskId: string;
  data?: Buffer;
  error?: string;
  stats?: {
    duration: number;
    inputSize: number;
    outputSize: number;
    savedBytes?: number;
    savedPercent?: number;
  };
}

export interface WorkerPoolOptions {
  // User-facing options
  maxWorkerThreads?: number; // Max workers (default: CPU cores - 1)
  minWorkerThreads?: number; // Min workers (default: 1)

  // Auto-scaling options
  autoScaleWorkers?: boolean; // Auto-scale workers (default: true)
  memoryThreshold?: number; // Memory limit 0-1 (default: 0.8)
  cpuThreshold?: number; // CPU threshold 0-1 (default: 0.9)

  // Worker lifecycle
  workerTaskTimeout?: number; // Task timeout ms (default: 30000)
  workerIdleTimeout?: number; // Idle timeout ms (default: 60000)
  workerMemoryLimit?: number; // Memory per worker MB (default: 512)

  // Debugging
  verbose?: boolean;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface WorkerInfo {
  id: string;
  state: "idle" | "busy" | "terminating";
  tasksCompleted: number;
  lastTaskTime: number;
  memoryUsage: number;
}

export interface QueuedTask {
  task: WorkerTask;
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

