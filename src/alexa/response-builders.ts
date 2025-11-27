/**
 * Alexa response builders
 *
 * Design Decision: Centralized response formatting
 * Rationale: Alexa Smart Home API v3 has strict response format requirements
 * with mandatory fields (context, event, payloadVersion, messageId, etc.).
 * Centralizing response building ensures consistency and reduces errors.
 *
 * Response Structure (Mandatory):
 * - context: Current device state (properties array)
 * - event: Confirmation event with header, endpoint, payload
 * - payloadVersion: Must be "3" (v2 deprecated Nov 2025)
 * - messageId: Unique UUID for tracking
 * - correlationToken: Echo correlationToken from request (if present)
 *
 * Trade-offs:
 * - Verbosity: More boilerplate vs. manual response construction
 * - Type Safety: Strongly typed builders vs. runtime errors
 * - Flexibility: Standardized format vs. custom responses
 *
 * Performance: Minimal overhead (~1-5ms per response)
 */

import { randomUUID } from 'crypto';
import type {
  AlexaResponse,
  AlexaContext,
  AlexaDirective,
  AlexaDiscoveryEndpoint,
  AlexaCapability,
  DisplayCategory,
  ContextProperty,
  ErrorResponsePayload,
  AlexaErrorType,
  DiscoveryResponsePayload,
} from './types.js';
import type { DeviceInfo } from '../types/smartthings.js';
import { AlexaCapabilities } from './types.js';
import logger from '../utils/logger.js';

/**
 * Generate unique message ID for Alexa responses
 *
 * @returns UUID v4 string
 */
function generateMessageId(): string {
  return randomUUID();
}

/**
 * Get current ISO 8601 timestamp
 *
 * @returns ISO 8601 timestamp string
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Build discovery response with SmartThings devices mapped to Alexa endpoints
 *
 * This function maps SmartThings devices to Alexa discovery format, including:
 * - Device identification (endpointId, friendlyName)
 * - Capabilities (PowerController, BrightnessController, etc.)
 * - Display categories (LIGHT, SWITCH, etc.)
 * - Manufacturer information
 *
 * @param devices Array of SmartThings devices
 * @returns Alexa discovery response
 */
export function buildDiscoveryResponse(
  devices: DeviceInfo[]
): AlexaResponse<DiscoveryResponsePayload> {
  logger.debug('Building discovery response', { deviceCount: devices.length });

  // Map SmartThings devices to Alexa endpoints
  const endpoints: AlexaDiscoveryEndpoint[] = devices
    .filter((device) => {
      // Only include devices with supported capabilities
      const hasSwitch = device.capabilities?.includes('switch') ?? false;
      return hasSwitch; // Expand as more capabilities are added
    })
    .map((device) => mapDeviceToEndpoint(device));

  logger.info('Discovery response built', {
    totalDevices: devices.length,
    supportedDevices: endpoints.length,
  });

  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        payloadVersion: '3',
        messageId: generateMessageId(),
      },
      payload: {
        endpoints,
      },
    },
  };
}

/**
 * Map SmartThings device to Alexa endpoint
 *
 * Device Capability Mapping:
 * - switch → Alexa.PowerController
 * - switchLevel → Alexa.BrightnessController (future)
 * - colorControl → Alexa.ColorController (future)
 * - thermostat → Alexa.ThermostatController (future)
 *
 * Display Category Inference:
 * - Contains "light", "bulb", "lamp" → LIGHT
 * - Contains "switch" → SWITCH
 * - Contains "outlet", "plug" → SMARTPLUG
 * - Default → OTHER
 *
 * @param device SmartThings device information
 * @returns Alexa discovery endpoint
 */
function mapDeviceToEndpoint(device: DeviceInfo): AlexaDiscoveryEndpoint {
  const capabilities: AlexaCapability[] = [];
  const displayCategories: DisplayCategory[] = [];

  // Map switch capability to PowerController
  if (device.capabilities?.includes('switch')) {
    capabilities.push({
      type: 'AlexaInterface',
      interface: AlexaCapabilities.POWER_CONTROLLER,
      version: '3',
      properties: {
        supported: [{ name: 'powerState' }],
        proactivelyReported: false,
        retrievable: true,
      },
    });
  }

  // Infer display category from device name/type
  const nameLower = (device.name || '').toLowerCase();
  const labelLower = (device.label || '').toLowerCase();

  if (
    nameLower.includes('light') ||
    nameLower.includes('bulb') ||
    nameLower.includes('lamp') ||
    labelLower.includes('light') ||
    labelLower.includes('bulb') ||
    labelLower.includes('lamp')
  ) {
    displayCategories.push('LIGHT');
  } else if (
    nameLower.includes('outlet') ||
    nameLower.includes('plug') ||
    labelLower.includes('outlet') ||
    labelLower.includes('plug')
  ) {
    displayCategories.push('SMARTPLUG');
  } else if (nameLower.includes('switch') || labelLower.includes('switch')) {
    displayCategories.push('SWITCH');
  } else {
    displayCategories.push('OTHER');
  }

  // Always include Alexa interface for state reporting
  capabilities.push({
    type: 'AlexaInterface',
    interface: 'Alexa',
    version: '3',
  });

  return {
    endpointId: device.deviceId,
    manufacturerName: 'SmartThings',
    friendlyName: device.label || device.name,
    description: `SmartThings ${device.type || 'device'}${device.roomName ? ` in ${device.roomName}` : ''}`,
    displayCategories,
    capabilities,
    cookie: {
      // Store additional device metadata for internal use
      deviceId: device.deviceId,
      deviceType: device.type,
      roomId: device.roomId,
      roomName: device.roomName,
    },
  };
}

/**
 * Build successful power controller response
 *
 * Response includes:
 * - context: Current power state (ON or OFF)
 * - event: Alexa.Response confirmation
 * - correlationToken: Echoed from request
 *
 * @param directive Original Alexa directive
 * @param powerState New power state ("ON" or "OFF")
 * @returns Alexa response with context
 */
export function buildPowerControllerResponse(
  directive: AlexaDirective,
  powerState: 'ON' | 'OFF'
): AlexaResponse {
  const { header, endpoint } = directive.directive;

  // Build context with current power state
  const context: AlexaContext = {
    properties: [
      {
        namespace: AlexaCapabilities.POWER_CONTROLLER,
        name: 'powerState',
        value: powerState,
        timeOfSample: getCurrentTimestamp(),
        uncertaintyInMilliseconds: 500, // Estimate of state staleness
      },
    ],
  };

  // Build response event
  const response: AlexaResponse = {
    context,
    event: {
      header: {
        namespace: 'Alexa',
        name: 'Response',
        payloadVersion: '3',
        messageId: generateMessageId(),
        correlationToken: header.correlationToken,
      },
      endpoint: {
        endpointId: endpoint?.endpointId || '',
      },
      payload: {},
    },
  };

  logger.debug('Built power controller response', {
    deviceId: endpoint?.endpointId,
    powerState,
    correlationToken: header.correlationToken,
  });

  return response;
}

/**
 * Build Alexa error response
 *
 * Error Type Mapping:
 * - "not found" → NO_SUCH_ENDPOINT
 * - "timeout", "unreachable" → ENDPOINT_UNREACHABLE
 * - "capability", "not supported" → INVALID_DIRECTIVE
 * - "validation", "invalid" → INVALID_VALUE
 * - "rate limit" → RATE_LIMIT_EXCEEDED
 * - Default → INTERNAL_ERROR
 *
 * @param directive Original Alexa directive
 * @param error Error object or message
 * @param errorType Optional specific Alexa error type
 * @returns Alexa error response
 */
export function buildErrorResponse(
  directive: AlexaDirective,
  error: Error | string,
  errorType?: AlexaErrorType
): AlexaResponse<ErrorResponsePayload> {
  const { header, endpoint } = directive.directive;
  const errorMessage = error instanceof Error ? error.message : error;

  // Infer error type from message if not provided
  const type: AlexaErrorType = errorType || inferErrorType(errorMessage);

  const payload: ErrorResponsePayload = {
    type,
    message: errorMessage,
  };

  const response: AlexaResponse<ErrorResponsePayload> = {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'ErrorResponse',
        payloadVersion: '3',
        messageId: generateMessageId(),
        correlationToken: header.correlationToken,
      },
      endpoint: endpoint
        ? {
            endpointId: endpoint.endpointId,
          }
        : undefined,
      payload,
    },
  };

  logger.error('Built error response', {
    deviceId: endpoint?.endpointId,
    errorType: type,
    errorMessage,
    originalDirective: `${header.namespace}.${header.name}`,
  });

  return response;
}

/**
 * Infer Alexa error type from error message
 *
 * This function uses keyword matching to map generic error messages
 * to specific Alexa error types. Not perfect, but provides reasonable
 * defaults when error type is not explicitly provided.
 *
 * @param message Error message
 * @returns Inferred Alexa error type
 */
function inferErrorType(message: string): AlexaErrorType {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('not found')) {
    return 'NO_SUCH_ENDPOINT';
  }

  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('unreachable') ||
    lowerMessage.includes('unavailable')
  ) {
    return 'ENDPOINT_UNREACHABLE';
  }

  if (
    lowerMessage.includes('capability') ||
    lowerMessage.includes('not supported') ||
    lowerMessage.includes('unsupported')
  ) {
    return 'INVALID_DIRECTIVE';
  }

  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'INVALID_VALUE';
  }

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return 'RATE_LIMIT_EXCEEDED';
  }

  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden')
  ) {
    return 'INSUFFICIENT_PERMISSIONS';
  }

  // Default to internal error
  return 'INTERNAL_ERROR';
}

/**
 * Build generic Alexa response with custom context
 *
 * Use this for custom responses not covered by specific builders.
 * Allows full control over context properties while maintaining
 * proper Alexa response structure.
 *
 * @param directive Original Alexa directive
 * @param contextProperties Array of context properties
 * @param payload Optional response payload
 * @returns Alexa response with custom context
 */
export function buildResponseWithContext(
  directive: AlexaDirective,
  contextProperties: ContextProperty[],
  payload: unknown = {}
): AlexaResponse {
  const { header, endpoint } = directive.directive;

  return {
    context: {
      properties: contextProperties,
    },
    event: {
      header: {
        namespace: 'Alexa',
        name: 'Response',
        payloadVersion: '3',
        messageId: generateMessageId(),
        correlationToken: header.correlationToken,
      },
      endpoint: endpoint
        ? {
            endpointId: endpoint.endpointId,
          }
        : undefined,
      payload,
    },
  };
}
