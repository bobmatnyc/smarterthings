/**
 * Command executor with retry logic and timeout support.
 *
 * Provides robust command execution with:
 * - Exponential backoff retry (1s, 2s, 4s, 8s, 16s)
 * - Rate limit aware retry (uses retryAfter from RateLimitError)
 * - Timeout support with AbortController
 * - Batch execution (sequential and parallel)
 * - Command correlation tracking for state updates
 * - Comprehensive metrics and monitoring
 *
 * Critical Fixes from Code Review:
 * - ✅ Rate limit aware retry using retryAfter field
 * - ✅ Jitter in exponential backoff to prevent thundering herd
 * - ✅ AbortSignal propagation for cancellation
 * - ✅ Command correlation for tracking state updates
 *
 * Design Principles:
 * - Resilient: Handles transient failures automatically
 * - Observable: Detailed metrics for monitoring
 * - Cancellable: Supports AbortSignal for cleanup
 * - Type-safe: Strong typing for commands and results
 *
 * @module utils/CommandExecutor
 */

import type {
  DeviceCommand,
  CommandResult,
  CommandExecutionOptions,
  BatchCommandOptions,
  BatchCommandInput,
  CommandExecutionContext,
  CommandExecutionMetrics,
  ResolvedCommandExecutionOptions,
} from '../types/commands.js';
import type { UniversalDeviceId } from '../types/unified-device.js';
import {
  DeviceNotFoundError,
  CapabilityNotSupportedError,
  InvalidCommandError,
  RateLimitError,
  TimeoutError,
  CommandExecutionError,
  isRetryableError,
  type DeviceError,
} from '../types/errors.js';

/**
 * Sleep utility for retry delays.
 *
 * @param ms Milliseconds to sleep
 * @param signal Optional AbortSignal for cancellation
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      });
    }
  });
}

/**
 * Generate correlation ID for command tracking.
 *
 * @returns Unique correlation ID (UUID v4 format)
 */
function generateCorrelationId(): string {
  // Simple UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Command executor with retry logic.
 *
 * Handles command execution with automatic retry on transient failures,
 * timeout support, and comprehensive error handling.
 *
 * Usage:
 * ```typescript
 * const executor = new CommandExecutor(adapter);
 * const result = await executor.execute(deviceId, command, {
 *   timeout: 5000,
 *   retries: 3,
 *   waitForConfirmation: true
 * });
 * ```
 */
export class CommandExecutor {
  /** Execution metrics for monitoring */
  private metrics: CommandExecutionMetrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageDuration: 0,
    p95Duration: 0,
    p99Duration: 0,
    totalRetries: 0,
    commandsWithRetries: 0,
    averageRetries: 0,
  };

  /** Duration samples for percentile calculation */
  private durationSamples: number[] = [];

  /** Maximum duration samples to keep (for memory bounds) */
  private readonly maxSamples = 1000;

  /**
   * Create command executor.
   *
   * @param adapter Adapter that will execute commands
   */
  constructor(
    private adapter: {
      executeCommand: (
        deviceId: string,
        command: DeviceCommand,
        options?: CommandExecutionOptions
      ) => Promise<CommandResult>;
      getDeviceCapabilities: (deviceId: string) => Promise<string[]>;
    }
  ) {}

  /**
   * Execute command with retry logic and timeout.
   *
   * ✅ CRITICAL FIXES from code review:
   * - Rate limit aware retry using retryAfter from RateLimitError
   * - Exponential backoff with jitter
   * - AbortSignal propagation
   * - Command correlation tracking
   *
   * @param deviceId Device to execute command on
   * @param command Command to execute
   * @param options Execution options
   * @returns Command result
   */
  async execute(
    deviceId: string,
    command: DeviceCommand,
    options: CommandExecutionOptions = {}
  ): Promise<CommandResult> {
    // Apply defaults
    const opts: ResolvedCommandExecutionOptions = {
      timeout: options.timeout ?? 5000,
      retries: options.retries ?? 3,
      waitForConfirmation: options.waitForConfirmation ?? true,
      component: options.component ?? 'main',
      correlationId: options.correlationId ?? generateCorrelationId(),
      signal: options.signal,
    };

    // Create execution context
    const context: CommandExecutionContext = {
      correlationId: opts.correlationId,
      startTime: new Date(),
      retryAttempt: 0,
      options: opts,
      adapterPlatform: 'unknown', // Set by adapter
    };

    let lastError: DeviceError | undefined;
    const startTime = Date.now();

    // Retry loop
    for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
      // Check if aborted
      if (opts.signal?.aborted) {
        throw new Error('Command execution aborted');
      }

      try {
        context.retryAttempt = attempt - 1;

        // Execute command with timeout
        const result = await this.executeWithTimeout(deviceId, command, opts, context);

        // Success! Update metrics
        const duration = Date.now() - startTime;
        this.updateMetrics(true, duration, attempt - 1);

        return {
          ...result,
          correlationId: opts.correlationId,
          retryCount: attempt - 1,
          duration,
        };
      } catch (error) {
        lastError = error as DeviceError;

        // Don't retry on permanent errors
        if (
          error instanceof DeviceNotFoundError ||
          error instanceof CapabilityNotSupportedError ||
          error instanceof InvalidCommandError
        ) {
          const duration = Date.now() - startTime;
          this.updateMetrics(false, duration, attempt - 1);
          throw error;
        }

        // Check if error is retryable
        if (!isRetryableError(error)) {
          const duration = Date.now() - startTime;
          this.updateMetrics(false, duration, attempt - 1);
          throw error;
        }

        // Last attempt failed - throw
        if (attempt > opts.retries) {
          const duration = Date.now() - startTime;
          this.updateMetrics(false, duration, attempt - 1);
          break; // Exit retry loop
        }

        // ✅ CRITICAL FIX: Calculate retry delay
        const delay = this.getRetryDelay(error, attempt);

        // Log retry attempt
        console.warn(
          `Command execution failed (attempt ${attempt}/${opts.retries + 1}), ` +
            `retrying in ${delay}ms`,
          {
            deviceId,
            command: command.command,
            error: lastError.message,
            correlationId: opts.correlationId,
          }
        );

        // Wait before retry
        await sleep(delay, opts.signal);
      }
    }

    // All retries exhausted
    throw new CommandExecutionError(
      `Command failed after ${opts.retries + 1} attempts: ${lastError?.message}`,
      {
        deviceId,
        command,
        lastError,
        correlationId: opts.correlationId,
        totalAttempts: opts.retries + 1,
      }
    );
  }

  /**
   * Execute multiple commands in batch.
   *
   * @param commands Commands to execute
   * @param options Batch execution options
   * @returns Array of command results
   */
  async executeBatch(
    commands: BatchCommandInput[],
    options: BatchCommandOptions = {}
  ): Promise<CommandResult[]> {
    const opts: Required<BatchCommandOptions> = {
      parallel: options.parallel ?? false,
      continueOnError: options.continueOnError ?? true,
      timeout: options.timeout ?? 0,
      maxConcurrency: options.maxConcurrency ?? 0,
    };

    if (opts.parallel) {
      return this.executeBatchParallel(commands, opts);
    } else {
      return this.executeBatchSequential(commands, opts);
    }
  }

  /**
   * Get execution metrics.
   *
   * @returns Current metrics
   */
  getMetrics(): CommandExecutionMetrics {
    this.updatePercentiles();
    return { ...this.metrics };
  }

  /**
   * Reset execution metrics.
   */
  resetMetrics(): void {
    this.metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      totalRetries: 0,
      commandsWithRetries: 0,
      averageRetries: 0,
    };
    this.durationSamples = [];
  }

  //
  // Private Helper Methods
  //

  /**
   * Execute command with timeout.
   *
   * @param deviceId Device ID
   * @param command Command to execute
   * @param options Execution options
   * @param context Execution context
   * @returns Command result
   */
  private async executeWithTimeout(
    deviceId: string,
    command: DeviceCommand,
    options: ResolvedCommandExecutionOptions,
    _context: CommandExecutionContext
  ): Promise<CommandResult> {
    return Promise.race([
      this.adapter.executeCommand(deviceId, command, options),
      this.createTimeoutPromise(options.timeout, deviceId),
    ]);
  }

  /**
   * Create timeout promise.
   *
   * @param timeout Timeout in milliseconds
   * @param deviceId Device ID for error context
   * @returns Promise that rejects after timeout
   */
  private createTimeoutPromise(timeout: number, deviceId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(`Command execution timeout after ${timeout}ms`, {
            deviceId,
            timeout,
          })
        );
      }, timeout);
    });
  }

  /**
   * Get retry delay for error.
   *
   * ✅ CRITICAL FIX from code review:
   * - Rate limit aware: Uses retryAfter from RateLimitError
   * - Exponential backoff: 1s, 2s, 4s, 8s, 16s
   * - Jitter: ±20% to prevent thundering herd
   *
   * @param error Error that occurred
   * @param attempt Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  private getRetryDelay(error: unknown, attempt: number): number {
    // ✅ CRITICAL FIX: Rate limit aware retry
    if (error instanceof RateLimitError && error.retryAfter) {
      // Use platform-provided retry delay
      return error.retryAfter * 1000; // Convert seconds to milliseconds
    }

    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 16000; // 16 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // ✅ CRITICAL FIX: Add jitter (±20%) to prevent thundering herd
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.round(delay + jitter);
  }

  /**
   * Execute commands sequentially.
   *
   * @param commands Commands to execute
   * @param options Batch options
   * @returns Array of results
   */
  private async executeBatchSequential(
    commands: BatchCommandInput[],
    options: Required<BatchCommandOptions>
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    const startTime = Date.now();

    for (const { deviceId, command, options: cmdOptions } of commands) {
      // Check total timeout
      if (options.timeout > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= options.timeout) {
          // Timeout exceeded, cancel remaining
          break;
        }
      }

      try {
        const result = await this.execute(deviceId, command, cmdOptions);
        results.push(result);

        // Stop on failure if continueOnError is false
        if (!result.success && !options.continueOnError) {
          break;
        }
      } catch (error) {
        // Create error result
        results.push({
          success: false,
          deviceId: deviceId as UniversalDeviceId,
          command,
          executedAt: new Date(),
          error: error as DeviceError,
        });

        // Stop on error if continueOnError is false
        if (!options.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute commands in parallel.
   *
   * @param commands Commands to execute
   * @param options Batch options
   * @returns Array of results
   */
  private async executeBatchParallel(
    commands: BatchCommandInput[],
    options: Required<BatchCommandOptions>
  ): Promise<CommandResult[]> {
    // Limit concurrency if specified
    if (options.maxConcurrency && options.maxConcurrency > 0) {
      return this.executeBatchLimitedConcurrency(commands, options);
    }

    // Execute all in parallel
    const promises = commands.map(async ({ deviceId, command, options: cmdOptions }) => {
      try {
        return await this.execute(deviceId, command, cmdOptions);
      } catch (error) {
        return {
          success: false,
          deviceId: deviceId as UniversalDeviceId,
          command,
          executedAt: new Date(),
          error: error as DeviceError,
        };
      }
    });

    // Apply total timeout if specified
    if (options.timeout) {
      return Promise.race([Promise.all(promises), this.createBatchTimeoutPromise(options.timeout)]);
    }

    return Promise.all(promises);
  }

  /**
   * Execute commands with limited concurrency.
   *
   * @param commands Commands to execute
   * @param options Batch options
   * @returns Array of results
   */
  private async executeBatchLimitedConcurrency(
    commands: BatchCommandInput[],
    options: Required<BatchCommandOptions>
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    const executing: Promise<unknown>[] = [];
    const maxConcurrency = options.maxConcurrency > 0 ? options.maxConcurrency : 5;

    for (const { deviceId, command, options: cmdOptions } of commands) {
      // Wait if at max concurrency
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }

      // Start execution
      const promise: Promise<unknown> = this.execute(deviceId, command, cmdOptions)
        .then((result) => {
          results.push(result);
        })
        .catch((error) => {
          results.push({
            success: false,
            deviceId: deviceId as UniversalDeviceId,
            command,
            executedAt: new Date(),
            error: error as DeviceError,
          });
        })
        .finally(() => {
          // Remove from executing list
          const index = executing.indexOf(promise);
          if (index !== -1) {
            executing.splice(index, 1);
          }
        });

      executing.push(promise);
    }

    // Wait for all to complete
    await Promise.all(executing);

    return results;
  }

  /**
   * Create timeout promise for batch execution.
   *
   * @param timeout Timeout in milliseconds
   * @returns Promise that rejects after timeout
   */
  private createBatchTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Batch execution timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Update execution metrics.
   *
   * @param success Whether command succeeded
   * @param duration Execution duration in milliseconds
   * @param retries Number of retries performed
   */
  private updateMetrics(success: boolean, duration: number, retries: number): void {
    this.metrics.totalCommands++;

    if (success) {
      this.metrics.successfulCommands++;
    } else {
      this.metrics.failedCommands++;
    }

    // Track duration
    this.durationSamples.push(duration);
    if (this.durationSamples.length > this.maxSamples) {
      this.durationSamples.shift(); // Remove oldest
    }

    // Update average duration
    const totalDuration = this.durationSamples.reduce((a, b) => a + b, 0);
    this.metrics.averageDuration = totalDuration / this.durationSamples.length;

    // Track retries
    if (retries > 0) {
      this.metrics.commandsWithRetries++;
      this.metrics.totalRetries += retries;
    }

    this.metrics.averageRetries =
      this.metrics.totalCommands > 0 ? this.metrics.totalRetries / this.metrics.totalCommands : 0;
  }

  /**
   * Update percentile metrics.
   */
  private updatePercentiles(): void {
    if (this.durationSamples.length === 0) {
      return;
    }

    const sorted = [...this.durationSamples].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.metrics.p95Duration = sorted[p95Index] ?? 0;
    this.metrics.p99Duration = sorted[p99Index] ?? 0;
  }
}
