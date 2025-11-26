/**
 * Command execution type definitions.
 *
 * Defines types for executing device commands with proper error handling,
 * timeout support, retry logic, and confirmation patterns.
 *
 * Design Principles:
 * - Async-first: All operations return Promises
 * - Type-safe: Strong typing for commands and parameters
 * - Error-handled: Standardized error types with context
 * - Retry-aware: Support for retry logic with exponential backoff
 * - Batch-capable: Sequential and parallel execution patterns
 *
 * @module types/commands
 */

import type { DeviceCapability, UniversalDeviceId } from './unified-device.js';
import type { DeviceState } from './device-state.js';
import type { DeviceError } from './errors.js';

/**
 * Device command representing an action to execute on a device.
 *
 * Commands are capability-specific and have associated parameters.
 * The capability field enables type-safe command validation.
 *
 * @example
 * ```typescript
 * // Switch on command
 * const cmd: DeviceCommand = {
 *   capability: DeviceCapability.SWITCH,
 *   command: 'on'
 * };
 *
 * // Dimmer setLevel command
 * const cmd: DeviceCommand = {
 *   capability: DeviceCapability.DIMMER,
 *   command: 'setLevel',
 *   parameters: { level: 75, duration: 2 }
 * };
 *
 * // Thermostat command
 * const cmd: DeviceCommand = {
 *   capability: DeviceCapability.THERMOSTAT,
 *   command: 'setHeatingSetpoint',
 *   parameters: { temperature: 22, unit: 'C' }
 * };
 * ```
 */
export interface DeviceCommand {
  /** Capability this command belongs to */
  capability: DeviceCapability;
  /** Command name (e.g., 'on', 'off', 'setLevel') */
  command: string;
  /** Command parameters (optional, command-specific) */
  parameters?: Record<string, unknown>;
}

/**
 * Command execution options.
 *
 * Controls timeout, retry behavior, and confirmation patterns
 * for command execution.
 *
 * Design Rationale:
 * - timeout: Prevents indefinite waiting for slow devices
 * - retries: Handles transient failures (network, rate limits)
 * - waitForConfirmation: Optional state update verification
 * - component: SmartThings-specific component targeting
 * - correlationId: Track command-to-state-update relationships
 */
export interface CommandExecutionOptions {
  /**
   * Maximum time to wait for command completion (milliseconds).
   *
   * Default: 5000 (5 seconds)
   * Range: 1000-30000 (1-30 seconds)
   *
   * Timeout includes:
   * - Network round-trip
   * - Platform API processing
   * - Device execution time
   * - State update confirmation (if enabled)
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts on transient failures.
   *
   * Default: 3
   * Range: 0-5
   *
   * Retry behavior:
   * - Exponential backoff: 1s, 2s, 4s, 8s, 16s
   * - Only retries transient errors (network, rate limit)
   * - No retry on permanent errors (device not found, invalid command)
   */
  retries?: number;

  /**
   * Wait for device state to reflect command execution.
   *
   * Default: true
   *
   * When true:
   * - Polls device state after command
   * - Verifies expected state change occurred
   * - Returns updated state in CommandResult
   *
   * When false:
   * - Returns immediately after API confirmation
   * - Faster but no verification
   * - State may not reflect change yet
   */
  waitForConfirmation?: boolean;

  /**
   * SmartThings component to target (SmartThings-specific).
   *
   * Default: 'main'
   *
   * Most devices use 'main' component. Multi-component devices
   * (e.g., dual outlets, RGBW lights) may have 'switch1', 'switch2', etc.
   */
  component?: string;

  /**
   * Correlation ID for tracking command-to-state-update relationships.
   *
   * Optional: Generated automatically if not provided
   *
   * Use cases:
   * - Track which state updates correspond to which commands
   * - Debugging asynchronous state changes
   * - Metrics and monitoring
   */
  correlationId?: string;

  /**
   * AbortController signal for canceling command execution.
   *
   * Optional: Allows external cancellation of in-flight commands
   *
   * Use cases:
   * - User cancels operation before completion
   * - Timeout from higher-level orchestration
   * - Cleanup during shutdown
   */
  signal?: AbortSignal;
}

/**
 * Command execution result.
 *
 * Contains outcome of command execution including success status,
 * error details (if failed), and updated state (if available).
 *
 * Design Rationale:
 * - success: Quick check for error handling
 * - error: Standardized error with context and retryability
 * - newState: Enables read-after-write pattern
 * - executedAt: Timestamp for auditing and debugging
 * - correlationId: Links command to subsequent state updates
 */
export interface CommandResult {
  /** Whether command executed successfully */
  success: boolean;

  /** Device that executed the command */
  deviceId: UniversalDeviceId;

  /** Command that was executed */
  command: DeviceCommand;

  /** Timestamp when command was executed */
  executedAt: Date;

  /** Error details if execution failed */
  error?: DeviceError;

  /**
   * Updated device state after command execution.
   *
   * Available when:
   * - Command succeeded
   * - waitForConfirmation: true
   * - State update detected within timeout
   *
   * Undefined when:
   * - Command failed
   * - waitForConfirmation: false
   * - State update not detected (timeout)
   */
  newState?: DeviceState;

  /**
   * Correlation ID for tracking this command.
   *
   * Matches correlationId from CommandExecutionOptions if provided,
   * otherwise auto-generated UUID.
   */
  correlationId?: string;

  /**
   * Number of retry attempts made.
   *
   * - 0: Succeeded on first attempt
   * - >0: Failed initially, succeeded after retries
   */
  retryCount?: number;

  /**
   * Total execution duration in milliseconds.
   *
   * Includes:
   * - All retry attempts
   * - Network latency
   * - State confirmation polling (if enabled)
   */
  duration?: number;
}

/**
 * Batch command execution options.
 *
 * Controls how multiple commands are executed together.
 *
 * Execution Patterns:
 * - Sequential: Commands execute one after another (default)
 * - Parallel: Commands execute simultaneously (if supported)
 *
 * Error Handling:
 * - continueOnError: true - All commands attempted regardless of failures
 * - continueOnError: false - Stop on first failure
 */
export interface BatchCommandOptions {
  /**
   * Execute commands in parallel instead of sequentially.
   *
   * Default: false (sequential execution)
   *
   * Parallel execution:
   * - Faster for independent commands
   * - No guaranteed order
   * - All commands start simultaneously
   *
   * Sequential execution:
   * - Predictable order
   * - Each command waits for previous to complete
   * - Better for dependent operations
   *
   * Warning: Not all platforms support true parallel execution.
   * Some adapters may serialize parallel requests internally.
   */
  parallel?: boolean;

  /**
   * Continue executing remaining commands if one fails.
   *
   * Default: true
   *
   * When true:
   * - All commands attempted
   * - Failed commands have error in result
   * - Useful for "best effort" operations
   *
   * When false:
   * - Stop on first failure
   * - Remaining commands not attempted
   * - Useful when order matters
   */
  continueOnError?: boolean;

  /**
   * Total timeout for all commands (milliseconds).
   *
   * Default: undefined (no total timeout)
   *
   * Applies to entire batch:
   * - Sequential: Sum of individual timeouts
   * - Parallel: Max of individual timeouts
   *
   * If exceeded, remaining commands are canceled.
   */
  timeout?: number;

  /**
   * Maximum number of parallel commands to execute at once.
   *
   * Default: undefined (unlimited concurrency)
   *
   * Only applies when parallel: true
   * Limits concurrent API requests to prevent rate limiting.
   *
   * Recommended: 5-10 for most platforms
   */
  maxConcurrency?: number;
}

/**
 * Batch command input.
 *
 * Pairs device ID with command for batch execution.
 */
export interface BatchCommandInput {
  /** Device to execute command on */
  deviceId: string;
  /** Command to execute */
  command: DeviceCommand;
  /** Optional per-command execution options */
  options?: CommandExecutionOptions;
}

/**
 * Command validation result.
 *
 * Used internally to validate commands before execution.
 */
export interface CommandValidationResult {
  /** Whether command is valid */
  valid: boolean;
  /** Validation error message (if invalid) */
  error?: string;
  /** Warning messages (non-blocking) */
  warnings?: string[];
}

/**
 * Resolved command execution options.
 *
 * All required fields from CommandExecutionOptions with defaults applied,
 * except signal which remains optional.
 */
export type ResolvedCommandExecutionOptions = Required<
  Omit<CommandExecutionOptions, 'signal'>
> & {
  signal?: AbortSignal;
};

/**
 * Command execution context.
 *
 * Internal context passed through command execution pipeline.
 * Used for logging, metrics, and debugging.
 */
export interface CommandExecutionContext {
  /** Correlation ID for this execution */
  correlationId: string;
  /** Start timestamp */
  startTime: Date;
  /** Current retry attempt (0 = first attempt) */
  retryAttempt: number;
  /** Execution options */
  options: ResolvedCommandExecutionOptions;
  /** Platform adapter that will execute command */
  adapterPlatform: string;
}

/**
 * Command execution metrics.
 *
 * Performance and reliability metrics for monitoring.
 */
export interface CommandExecutionMetrics {
  /** Total commands executed */
  totalCommands: number;
  /** Successful commands */
  successfulCommands: number;
  /** Failed commands */
  failedCommands: number;
  /** Average execution duration (ms) */
  averageDuration: number;
  /** P95 execution duration (ms) */
  p95Duration: number;
  /** P99 execution duration (ms) */
  p99Duration: number;
  /** Total retry attempts */
  totalRetries: number;
  /** Commands that required retries */
  commandsWithRetries: number;
  /** Average retries per command */
  averageRetries: number;
}
