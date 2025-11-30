/**
 * Type conversion utilities for Direct Mode API.
 *
 * Provides bidirectional conversion between MCP protocol format
 * and Direct Mode type-safe format.
 *
 * Design Decision: Minimal Conversion Layer
 * ------------------------------------------
 * Rationale: Thin wrapper over existing MCP handlers
 * - Reuses all MCP validation and error handling logic
 * - Zero business logic duplication
 * - Conversion overhead: ~0.1ms per operation
 *
 * Trade-offs:
 * - Coupling: Depends on MCP CallToolResult structure (acceptable)
 * - Type Safety: Uses type assertions for data extraction (necessary)
 * - Performance: Minimal overhead vs protocol marshalling savings (wins)
 *
 * Alternatives Considered:
 * 1. Duplicate handlers: Rejected due to maintenance burden
 * 2. Direct SDK usage: Rejected due to protocol overhead
 * 3. Code generation: Deferred to future optimization
 *
 * Error Handling:
 * - All MCP errors preserved with code, message, and details
 * - Type casting for data extraction (validated by Zod in handlers)
 * - Unknown errors mapped to UNKNOWN_ERROR code
 *
 * @module direct/converters
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { DirectResult } from './types.js';

/**
 * MCP error response shape (from error-handler.ts).
 *
 * Extended CallToolResult with error metadata.
 */
interface McpErrorResponse extends CallToolResult {
  isError: true;
  code?: string;
  details?: unknown;
}

/**
 * Convert MCP CallToolResult to DirectResult.
 *
 * Extracts typed data from MCP content array and error information.
 * Preserves all error metadata for debugging and logging.
 *
 * Performance:
 * - Time Complexity: O(1) - field access and object construction
 * - Space Complexity: O(1) - creates single result object
 * - Expected Runtime: <0.1ms
 *
 * Type Safety:
 * - Generic type parameter T for typed data extraction
 * - Type assertion necessary (data validated by Zod in handlers)
 * - Error structure fully typed
 *
 * Error Handling:
 * 1. isError=true: Extract error code, message, details
 * 2. Missing code: Default to 'UNKNOWN_ERROR'
 * 3. Missing message: Extract from content[0].text or use 'Unknown error'
 *
 * @param mcpResult MCP CallToolResult from handler
 * @returns DirectResult with success/error discriminant
 *
 * @example
 * ```typescript
 * // Success case
 * const mcpResult = await handleTurnOnDevice({ deviceId: 'xxx' });
 * const directResult = unwrapMcpResult<void>(mcpResult);
 * // directResult: { success: true, data: undefined }
 *
 * // Error case
 * const mcpError = await handleTurnOnDevice({ deviceId: 'invalid' });
 * const directError = unwrapMcpResult<void>(mcpError);
 * // directError: { success: false, error: { code: 'VALIDATION_ERROR', ... } }
 * ```
 */
export function unwrapMcpResult<T>(mcpResult: CallToolResult): DirectResult<T> {
  // Check for error response
  if ('isError' in mcpResult && mcpResult.isError) {
    const errorResponse = mcpResult as McpErrorResponse;
    // Extract error message from first text content item
    let errorMessage = 'Unknown error';
    const firstContent = errorResponse.content[0];
    if (firstContent && 'text' in firstContent) {
      errorMessage = firstContent.text;
    }

    return {
      success: false,
      error: {
        code: errorResponse.code || 'UNKNOWN_ERROR',
        message: errorMessage,
        details: errorResponse.details,
      },
    };
  }

  // Success response - extract data from MCP response
  // Type assertion is safe here because:
  // 1. All handlers validate input with Zod schemas
  // 2. createMcpResponse() sets data field with correct type
  // 3. Generic type T matches handler return type
  return {
    success: true,
    data: (mcpResult as any).data as T,
  };
}

/**
 * Convert DirectResult to MCP CallToolResult.
 *
 * Used for internal consistency when Direct Mode tools need MCP format.
 * Unlikely to be needed in practice, but provided for completeness.
 *
 * Performance: O(1) - field access and object construction
 *
 * Use Cases:
 * - Testing Direct Mode against MCP mode
 * - Hybrid applications using both modes
 * - Internal consistency checks
 *
 * @param directResult DirectResult to convert
 * @returns CallToolResult compatible with MCP protocol
 *
 * @example
 * ```typescript
 * const directResult: DirectResult<void> = { success: true, data: undefined };
 * const mcpResult = wrapDirectResult(directResult);
 * // mcpResult: { content: [{ type: 'text', text: 'Success' }], isError: false, data: undefined }
 * ```
 */
export function wrapDirectResult<T>(directResult: DirectResult<T>): CallToolResult {
  if ('error' in directResult) {
    // Error result - format as MCP error
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error (${directResult.error.code}): ${directResult.error.message}`,
        },
      ],
      code: directResult.error.code,
      details: directResult.error.details,
    } as any;
  }

  // Success result - format as MCP success
  return {
    content: [{ type: 'text' as const, text: 'Success' }],
    isError: false,
    data: directResult.data,
  } as any;
}
