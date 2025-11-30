/**
 * Type definitions for Direct Mode API.
 *
 * Direct Mode provides type-safe, zero-overhead access to MCP tools
 * without protocol marshalling overhead.
 *
 * Design Decision: Result Type Pattern
 * ------------------------------------
 * Rationale: Discriminated union for explicit error handling
 * - Eliminates throwing exceptions for business logic errors
 * - Type-safe success/error checking with TypeScript narrowing
 * - Consistent with functional programming best practices
 *
 * Trade-offs:
 * - Verbosity: Requires .success checks vs try/catch
 * - Type Safety: Compiler enforces error handling (wins)
 * - Performance: No stack unwinding overhead for business errors
 *
 * Alternatives Considered:
 * 1. Throwing exceptions: Rejected due to performance and type safety
 * 2. Callbacks: Rejected due to callback hell and lack of type inference
 * 3. Promise rejection: Rejected due to inconsistent error handling
 *
 * @module direct/types
 */

/**
 * Result type for Direct Mode operations.
 *
 * Discriminated union for success/error results with full type safety.
 *
 * Performance: O(1) type checking via discriminant field
 * Memory: ~40 bytes (success) or ~80 bytes (error) per result
 *
 * Example Usage:
 * ```typescript
 * const result = await executor.turnOnDevice(deviceId);
 * if (result.success) {
 *   console.log(result.data); // Type: T
 * } else {
 *   console.error(result.error.message); // Type: string
 * }
 * ```
 */
export type DirectResult<T> =
  | {
      /** Success indicator */
      success: true;
      /** Typed result data */
      data: T;
    }
  | {
      /** Error indicator */
      success: false;
      /** Structured error information */
      error: {
        /** Error classification code (e.g., DEVICE_NOT_FOUND, VALIDATION_ERROR) */
        code: string;
        /** Human-readable error message */
        message: string;
        /** Optional additional error context */
        details?: unknown;
      };
    };

/**
 * Type guard for success results.
 *
 * Enables TypeScript type narrowing for safe data access.
 *
 * Time Complexity: O(1) - single boolean check
 *
 * @param result DirectResult to check
 * @returns true if result is success, false otherwise
 *
 * @example
 * ```typescript
 * const result = await executor.getDevice(deviceId);
 * if (isSuccess(result)) {
 *   console.log(result.data.name); // Type-safe access
 * }
 * ```
 */
export function isSuccess<T>(result: DirectResult<T>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard for error results.
 *
 * Enables TypeScript type narrowing for safe error handling.
 *
 * Time Complexity: O(1) - single boolean check
 *
 * @param result DirectResult to check
 * @returns true if result is error, false otherwise
 *
 * @example
 * ```typescript
 * const result = await executor.turnOnDevice(deviceId);
 * if (isError(result)) {
 *   logger.error(`Operation failed: ${result.error.code} - ${result.error.message}`);
 * }
 * ```
 */
export function isError<T>(result: DirectResult<T>): result is {
  success: false;
  error: { code: string; message: string; details?: unknown };
} {
  return !result.success;
}
