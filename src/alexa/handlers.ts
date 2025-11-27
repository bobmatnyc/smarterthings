/**
 * Alexa directive handlers
 *
 * Design Decision: Directive routing and handler delegation
 * Rationale: Alexa sends directives (commands) that must be routed to appropriate
 * handlers based on namespace and name. This routing layer provides clean separation
 * between directive types and integrates with existing MCP tools.
 *
 * Architecture:
 * - handleAlexaDirective(): Main entry point, routes to specific handlers
 * - handleDiscovery(): Device discovery for Alexa app
 * - handlePowerController(): TurnOn/TurnOff commands
 * - Future: handleBrightnessController(), handleColorController(), etc.
 *
 * Integration Strategy:
 * - Reuses existing MCP tools (turn_on_device, turn_off_device, list_devices)
 * - Direct function calls (not network MCP protocol)
 * - Transforms MCP responses to Alexa format
 *
 * Error Handling:
 * - Unknown directives: INVALID_DIRECTIVE error
 * - Device not found: NO_SUCH_ENDPOINT error
 * - SmartThings API errors: ENDPOINT_UNREACHABLE error
 * - All errors logged with context for debugging
 *
 * Performance:
 * - Target: <500ms total response time
 * - Device list cached for discovery (future optimization)
 * - Direct tool integration (no network overhead)
 */

import type {
  AlexaDirective,
  AlexaResponse,
  DiscoveryPayload,
  PowerControllerPayload,
} from './types.js';
import {
  buildDiscoveryResponse,
  buildPowerControllerResponse,
  buildErrorResponse,
} from './response-builders.js';
import { smartThingsService } from '../smartthings/client.js';
import { handleTurnOnDevice, handleTurnOffDevice } from '../mcp/tools/device-control.js';
import logger from '../utils/logger.js';

/**
 * Main Alexa directive handler (entry point)
 *
 * Routes incoming Alexa directives to appropriate handlers based on
 * namespace and name. This is the primary integration point between
 * Alexa Smart Home API and SmartThings MCP tools.
 *
 * Supported Directives:
 * - Alexa.Discovery.Discover → handleDiscovery()
 * - Alexa.PowerController.TurnOn → handlePowerController()
 * - Alexa.PowerController.TurnOff → handlePowerController()
 *
 * @param directive Alexa directive from request
 * @returns Alexa response (success or error)
 */
export async function handleAlexaDirective(directive: AlexaDirective): Promise<AlexaResponse> {
  const { namespace, name } = directive.directive.header;

  logger.info('Processing Alexa directive', {
    namespace,
    name,
    endpointId: directive.directive.endpoint?.endpointId,
    messageId: directive.directive.header.messageId,
  });

  try {
    // Route to appropriate handler
    if (namespace === 'Alexa.Discovery' && name === 'Discover') {
      return await handleDiscovery(directive as AlexaDirective<DiscoveryPayload>);
    }

    if (namespace === 'Alexa.PowerController') {
      return await handlePowerController(directive as AlexaDirective<PowerControllerPayload>);
    }

    // Unknown directive
    logger.warn('Unsupported Alexa directive', { namespace, name });
    throw new Error(`Unsupported directive: ${namespace}.${name}`);
  } catch (error) {
    logger.error('Error handling Alexa directive', {
      namespace,
      name,
      error: error instanceof Error ? error.message : String(error),
    });

    // Build error response
    return buildErrorResponse(directive, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Handle Alexa.Discovery.Discover directive
 *
 * This handler is called when user adds the SmartThings skill in the Alexa app
 * and taps "Discover Devices". It returns all SmartThings devices with their
 * capabilities mapped to Alexa interfaces.
 *
 * Device Filtering:
 * - Only includes devices with supported capabilities (currently: switch)
 * - Future: Add switchLevel (brightness), colorControl (color), etc.
 *
 * Response Format:
 * - Array of endpoints (devices)
 * - Each endpoint includes: id, name, capabilities, display category
 * - Capabilities determine what Alexa can control (power, brightness, etc.)
 *
 * Performance Optimization (Future):
 * - Cache device list (TTL: 5-10 minutes)
 * - Invalidate cache on device changes
 * - Background refresh for proactive updates
 *
 * @param directive Discovery directive
 * @returns Discovery response with device list
 */
async function handleDiscovery(
  _directive: AlexaDirective<DiscoveryPayload>
): Promise<AlexaResponse> {
  logger.debug('Handling discovery directive');

  const startTime = Date.now();

  try {
    // Fetch all SmartThings devices
    const devices = await smartThingsService.listDevices();

    logger.info('Fetched SmartThings devices for discovery', {
      count: devices.length,
      duration: Date.now() - startTime,
    });

    // Build discovery response
    const response = buildDiscoveryResponse(devices);

    logger.info('Discovery completed', {
      totalDevices: devices.length,
      discoveredDevices: response.event.payload.endpoints.length,
      duration: Date.now() - startTime,
    });

    return response;
  } catch (error) {
    logger.error('Discovery failed', {
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Handle Alexa.PowerController directives (TurnOn, TurnOff)
 *
 * This handler processes power control commands from Alexa and calls the
 * appropriate MCP tool to control SmartThings devices.
 *
 * Supported Directives:
 * - TurnOn: Turn device on
 * - TurnOff: Turn device off
 *
 * Integration:
 * - Calls handleTurnOnDevice() or handleTurnOffDevice() from MCP tools
 * - Direct function call (not via network)
 * - Transforms MCP response to Alexa format
 *
 * Error Cases:
 * - Device not found: NO_SUCH_ENDPOINT (invalid deviceId)
 * - SmartThings API error: ENDPOINT_UNREACHABLE (device offline, API down)
 * - Capability not supported: INVALID_DIRECTIVE (device doesn't have switch)
 *
 * @param directive Power controller directive (TurnOn or TurnOff)
 * @returns Alexa response with power state context
 */
async function handlePowerController(
  directive: AlexaDirective<PowerControllerPayload>
): Promise<AlexaResponse> {
  const { name } = directive.directive.header;
  const deviceId = directive.directive.endpoint?.endpointId;

  if (!deviceId) {
    throw new Error('Missing endpointId in power controller directive');
  }

  logger.debug('Handling power controller directive', {
    directive: name,
    deviceId,
  });

  const startTime = Date.now();

  try {
    // Call appropriate MCP tool
    let mcpResult;
    if (name === 'TurnOn') {
      mcpResult = await handleTurnOnDevice({ deviceId });
    } else if (name === 'TurnOff') {
      mcpResult = await handleTurnOffDevice({ deviceId });
    } else {
      throw new Error(`Unsupported power controller directive: ${name}`);
    }

    // Check for MCP errors
    if ('isError' in mcpResult && mcpResult.isError) {
      const errorMessage =
        mcpResult.content?.[0] && 'text' in mcpResult.content[0]
          ? mcpResult.content[0].text
          : 'Unknown MCP error';
      throw new Error(errorMessage);
    }

    // Determine power state from directive
    const powerState = name === 'TurnOn' ? 'ON' : 'OFF';

    // Build Alexa response
    const response = buildPowerControllerResponse(directive, powerState);

    logger.info('Power controller command completed', {
      directive: name,
      deviceId,
      powerState,
      duration: Date.now() - startTime,
    });

    return response;
  } catch (error) {
    logger.error('Power controller command failed', {
      directive: name,
      deviceId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
