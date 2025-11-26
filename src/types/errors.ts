/**
 * Device error type definitions and hierarchy.
 *
 * Standardized error types for device operations with retry logic support,
 * severity levels, and contextual information for debugging.
 *
 * Design Principles:
 * - Hierarchy: All errors extend DeviceError base class
 * - Metadata: isRetryable and severity computed from error type
 * - Context: Rich contextual information for debugging
 * - Type-safe: Specific error classes for each failure mode
 * - Platform-agnostic: Errors work across all platforms
 *
 * Critical Fix from Code Review:
 * - Added isRetryable and severity as readonly properties
 * - Implemented determineRetryable() and determineSeverity() abstract methods
 * - Each error class defines its own retry and severity behavior
 *
 * @module types/errors
 */

/**
 * Error severity levels.
 *
 * Used for alerting, logging, and error handling priorities.
 *
 * - low: Minor issues, degraded functionality
 * - medium: Significant issues, some functionality lost
 * - high: Major issues, critical functionality lost
 * - critical: System failure, immediate attention required
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Base device error class.
 *
 * All device-related errors extend this class.
 * Provides standardized error handling with retry logic support.
 *
 * Critical Fix from Code Review:
 * - isRetryable and severity are now readonly properties
 * - Computed via abstract methods in each subclass
 * - Prevents accidental modification after construction
 */
export abstract class DeviceError extends Error {
  /**
   * Whether this error is transient and retryable.
   *
   * Computed by determineRetryable() in each subclass.
   * Readonly to prevent modification after construction.
   */
  public readonly isRetryable!: boolean;

  /**
   * Error severity level.
   *
   * Computed by determineSeverity() in each subclass.
   * Readonly to prevent modification after construction.
   */
  public readonly severity!: ErrorSeverity;

  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;

    // ✅ CRITICAL FIX from code review
    // Compute and freeze isRetryable and severity
    Object.defineProperty(this, 'isRetryable', {
      value: this.determineRetryable(),
      writable: false,
      enumerable: true,
      configurable: false,
    });

    Object.defineProperty(this, 'severity', {
      value: this.determineSeverity(),
      writable: false,
      enumerable: true,
      configurable: false,
    });

    // Maintains proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Determine if this error is retryable.
   *
   * Subclasses override to define retry behavior.
   * Called once during construction.
   */
  protected abstract determineRetryable(): boolean;

  /**
   * Determine error severity level.
   *
   * Subclasses override to define severity.
   * Called once during construction.
   */
  protected abstract determineSeverity(): ErrorSeverity;

  /**
   * Serialize error to JSON.
   *
   * Useful for logging and API responses.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      isRetryable: this.isRetryable,
      severity: this.severity,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Authentication error - Invalid or expired credentials.
 *
 * Thrown when:
 * - API token is invalid
 * - Token has expired
 * - Insufficient permissions
 * - OAuth refresh failed
 *
 * Not Retryable: Credentials need manual intervention
 * Severity: High - Cannot perform any operations
 */
export class AuthenticationError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', context);
  }

  protected determineRetryable(): boolean {
    return false; // Credentials need manual fix
  }

  protected determineSeverity(): ErrorSeverity {
    return 'high'; // Cannot operate without valid credentials
  }
}

/**
 * Device not found error - Device does not exist or is not accessible.
 *
 * Thrown when:
 * - Device ID is invalid
 * - Device was deleted
 * - Device belongs to different account
 * - Wrong platform for device ID
 *
 * Not Retryable: Device won't appear by retrying
 * Severity: Medium - Specific device inaccessible
 */
export class DeviceNotFoundError extends DeviceError {
  constructor(deviceId: string, context?: Record<string, unknown>) {
    super(`Device not found: ${deviceId}`, 'DEVICE_NOT_FOUND', {
      deviceId,
      ...context,
    });
  }

  protected determineRetryable(): boolean {
    return false; // Device doesn't exist
  }

  protected determineSeverity(): ErrorSeverity {
    return 'medium'; // Specific device unavailable
  }
}

/**
 * Capability not supported error - Device lacks required capability.
 *
 * Thrown when:
 * - Device doesn't have required capability
 * - Capability not supported by platform
 * - Capability mapping failed
 *
 * Not Retryable: Device capabilities are fixed
 * Severity: Low - User error, not system issue
 */
export class CapabilityNotSupportedError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CAPABILITY_NOT_SUPPORTED', context);
  }

  protected determineRetryable(): boolean {
    return false; // Device capabilities don't change
  }

  protected determineSeverity(): ErrorSeverity {
    return 'low'; // User attempted invalid operation
  }
}

/**
 * Invalid command error - Command parameters are invalid.
 *
 * Thrown when:
 * - Command name is invalid for capability
 * - Parameters are out of range
 * - Required parameters missing
 * - Parameter type mismatch
 *
 * Not Retryable: Command is fundamentally invalid
 * Severity: Low - User error, not system issue
 */
export class InvalidCommandError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INVALID_COMMAND', context);
  }

  protected determineRetryable(): boolean {
    return false; // Command is invalid, won't become valid
  }

  protected determineSeverity(): ErrorSeverity {
    return 'low'; // User error
  }
}

/**
 * Device offline error - Device is not reachable.
 *
 * Thrown when:
 * - Device is powered off
 * - Device lost network connection
 * - Device is out of range
 * - Hub is offline
 *
 * Retryable: Device may come back online
 * Severity: Medium - Temporary unavailability
 */
export class DeviceOfflineError extends DeviceError {
  constructor(deviceId: string, context?: Record<string, unknown>) {
    super(`Device offline: ${deviceId}`, 'DEVICE_OFFLINE', {
      deviceId,
      ...context,
    });
  }

  protected determineRetryable(): boolean {
    return true; // Device may come back online
  }

  protected determineSeverity(): ErrorSeverity {
    return 'medium'; // Temporary unavailability
  }
}

/**
 * Network error - Network communication failed.
 *
 * Thrown when:
 * - DNS lookup failed
 * - Connection refused
 * - Connection timeout
 * - Socket error
 * - SSL/TLS error
 *
 * Retryable: Transient network issues often resolve
 * Severity: Medium - Temporary connectivity issue
 */
export class NetworkError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', context);
  }

  protected determineRetryable(): boolean {
    return true; // Network issues are often transient
  }

  protected determineSeverity(): ErrorSeverity {
    return 'medium'; // Temporary issue
  }
}

/**
 * Rate limit error - Too many requests to platform API.
 *
 * Thrown when:
 * - API rate limit exceeded
 * - Too many concurrent requests
 * - Quota exceeded
 *
 * Retryable: Retry after rate limit window expires
 * Severity: Medium - Temporary throttling
 *
 * Critical Fix from Code Review:
 * - Added retryAfter field for exponential backoff
 * - Retry logic should use retryAfter if provided
 */
export class RateLimitError extends DeviceError {
  /**
   * Number of seconds to wait before retrying.
   *
   * Platform APIs often provide this in response headers:
   * - Retry-After header (HTTP 429)
   * - X-RateLimit-Reset header
   *
   * If not provided, use exponential backoff.
   */
  public readonly retryAfter?: number;

  constructor(
    message: string,
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', { retryAfter, ...context });
    this.retryAfter = retryAfter;
  }

  protected determineRetryable(): boolean {
    return true; // Retry after waiting
  }

  protected determineSeverity(): ErrorSeverity {
    return 'medium'; // Temporary throttling
  }
}

/**
 * Timeout error - Operation exceeded time limit.
 *
 * Thrown when:
 * - API request timeout
 * - Command execution timeout
 * - State update confirmation timeout
 * - Long-running operation timeout
 *
 * Retryable: May succeed if retried with longer timeout
 * Severity: Medium - Operation took too long
 */
export class TimeoutError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', context);
  }

  protected determineRetryable(): boolean {
    return true; // May succeed on retry
  }

  protected determineSeverity(): ErrorSeverity {
    return 'medium'; // Temporary slowness
  }
}

/**
 * Command execution error - Command failed on platform.
 *
 * Thrown when:
 * - Platform API rejected command
 * - Device rejected command
 * - Command partially executed
 * - Unknown platform error
 *
 * Conditionally Retryable: Check context for details
 * Severity: Medium - Command failed
 */
export class CommandExecutionError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'COMMAND_EXECUTION_ERROR', context);
  }

  protected determineRetryable(): boolean {
    // Check context for platform-specific error codes
    const platformCode = this.context?.['platformErrorCode'];

    // Some platform errors are retryable
    const retryableCodes = [
      'TEMPORARY_ERROR',
      'BUSY',
      'RESOURCE_TEMPORARILY_UNAVAILABLE',
    ];

    return (
      typeof platformCode === 'string' && retryableCodes.includes(platformCode)
    );
  }

  protected determineSeverity(): ErrorSeverity {
    return 'medium'; // Command failed
  }
}

/**
 * Not supported error - Feature not supported by adapter.
 *
 * Thrown when:
 * - Platform doesn't support feature
 * - Adapter doesn't implement feature
 * - Feature disabled in configuration
 *
 * Not Retryable: Feature fundamentally unsupported
 * Severity: Low - Expected limitation
 */
export class NotSupportedError extends DeviceError {
  constructor(
    feature: string,
    platform: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Feature '${feature}' not supported by ${platform} adapter`,
      'NOT_SUPPORTED',
      { feature, platform, ...context }
    );
  }

  protected determineRetryable(): boolean {
    return false; // Feature won't become supported
  }

  protected determineSeverity(): ErrorSeverity {
    return 'low'; // Expected limitation
  }
}

/**
 * Configuration error - Invalid adapter configuration.
 *
 * Thrown when:
 * - Required configuration missing
 * - Invalid configuration values
 * - Configuration validation failed
 *
 * Not Retryable: Configuration needs manual fix
 * Severity: High - Adapter cannot initialize
 */
export class ConfigurationError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', context);
  }

  protected determineRetryable(): boolean {
    return false; // Configuration needs manual fix
  }

  protected determineSeverity(): ErrorSeverity {
    return 'high'; // Adapter cannot operate
  }
}

/**
 * State sync error - State synchronization failed.
 *
 * Thrown when:
 * - State cache inconsistent
 * - State update conflict
 * - State refresh failed
 *
 * Retryable: May resolve on next sync
 * Severity: Low - Stale data risk
 */
export class StateSyncError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STATE_SYNC_ERROR', context);
  }

  protected determineRetryable(): boolean {
    return true; // May resolve on next sync
  }

  protected determineSeverity(): ErrorSeverity {
    return 'low'; // Non-critical inconsistency
  }
}

/**
 * Type guard to check if error is a DeviceError.
 *
 * @param error Error to check
 * @returns True if error is DeviceError instance
 */
export function isDeviceError(error: unknown): error is DeviceError {
  return error instanceof DeviceError;
}

/**
 * Type guard to check if error is retryable.
 *
 * @param error Error to check
 * @returns True if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isDeviceError(error) && error.isRetryable;
}

/**
 * Get retry delay for error.
 *
 * Returns appropriate delay based on error type and attempt number.
 *
 * @param error Error that occurred
 * @param attemptNumber Current retry attempt (1-based)
 * @returns Delay in milliseconds before retry
 *
 * @example
 * ```typescript
 * const delay = getRetryDelay(error, 2);
 * await sleep(delay);
 * // Retry operation
 * ```
 */
export function getRetryDelay(error: unknown, attemptNumber: number): number {
  if (!isRetryableError(error)) {
    return 0; // No retry
  }

  // ✅ CRITICAL FIX: Rate limit aware retry
  if (error instanceof RateLimitError && error.retryAfter) {
    // Use platform-provided retry delay
    return error.retryAfter * 1000; // Convert seconds to milliseconds
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const baseDelay = 1000; // 1 second
  const maxDelay = 16000; // 16 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);

  // Add jitter to prevent thundering herd (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

/**
 * Error context builder for structured error information.
 *
 * Helps create consistent error context objects.
 */
export class ErrorContextBuilder {
  private context: Record<string, unknown> = {};

  /**
   * Add device ID to context.
   */
  withDeviceId(deviceId: string): this {
    this.context['deviceId'] = deviceId;
    return this;
  }

  /**
   * Add platform to context.
   */
  withPlatform(platform: string): this {
    this.context['platform'] = platform;
    return this;
  }

  /**
   * Add command to context.
   */
  withCommand(command: Record<string, unknown>): this {
    this.context['command'] = command;
    return this;
  }

  /**
   * Add platform-specific error code.
   */
  withPlatformErrorCode(code: string): this {
    this.context['platformErrorCode'] = code;
    return this;
  }

  /**
   * Add HTTP status code.
   */
  withHttpStatus(status: number): this {
    this.context['httpStatus'] = status;
    return this;
  }

  /**
   * Add custom field to context.
   */
  with(key: string, value: unknown): this {
    this.context[key] = value;
    return this;
  }

  /**
   * Build final context object.
   */
  build(): Record<string, unknown> {
    return { ...this.context };
  }
}
