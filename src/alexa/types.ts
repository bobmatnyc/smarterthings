/**
 * Alexa Smart Home API v3 Type Definitions
 *
 * Design Decision: Comprehensive type safety for Alexa integration
 * Rationale: Alexa Smart Home API v3 has strict request/response format requirements.
 * TypeScript types provide compile-time validation and IDE autocomplete for complex
 * nested structures, reducing runtime errors.
 *
 * Trade-offs:
 * - Complexity: Verbose type definitions vs. runtime validation errors
 * - Maintainability: Types must be updated when Amazon changes API
 * - Performance: Zero runtime cost (types erased at compile time)
 *
 * Extension Points: Add new directive types, capabilities, error types as needed
 */

/**
 * Alexa API version identifier
 */
export type PayloadVersion = '3';

/**
 * Common Alexa header structure
 */
export interface AlexaHeader {
  namespace: string;
  name: string;
  payloadVersion: PayloadVersion;
  messageId: string;
  correlationToken?: string;
}

/**
 * OAuth bearer token for user authentication
 */
export interface BearerTokenScope {
  type: 'BearerToken';
  token: string;
}

/**
 * Alexa endpoint (device) reference
 */
export interface AlexaEndpoint {
  endpointId: string;
  scope?: BearerTokenScope;
  cookie?: Record<string, unknown>;
}

/**
 * Alexa directive structure (incoming request from Alexa)
 */
export interface AlexaDirective<TPayload = unknown> {
  directive: {
    header: AlexaHeader;
    endpoint?: AlexaEndpoint;
    payload: TPayload;
  };
}

/**
 * Discovery directive payload (empty)
 */
export interface DiscoveryPayload {
  scope?: BearerTokenScope;
}

/**
 * Power controller directive payload (empty for TurnOn/TurnOff)
 */
export interface PowerControllerPayload {}

/**
 * Device capability property definition
 */
export interface CapabilityProperty {
  name: string;
}

/**
 * Capability properties configuration
 */
export interface CapabilityProperties {
  supported: CapabilityProperty[];
  proactivelyReported: boolean;
  retrievable: boolean;
}

/**
 * Alexa capability interface definition
 */
export interface AlexaCapability {
  type: 'AlexaInterface';
  interface: string;
  version: '3';
  properties?: CapabilityProperties;
}

/**
 * Display categories for device classification in Alexa app
 */
export type DisplayCategory =
  | 'LIGHT'
  | 'SWITCH'
  | 'SMARTPLUG'
  | 'THERMOSTAT'
  | 'SMARTLOCK'
  | 'CAMERA'
  | 'DOOR'
  | 'SCENE_TRIGGER'
  | 'TEMPERATURE_SENSOR'
  | 'MOTION_SENSOR'
  | 'CONTACT_SENSOR'
  | 'BLINDS'
  | 'FAN'
  | 'OTHER';

/**
 * Alexa discovery endpoint (device) definition
 */
export interface AlexaDiscoveryEndpoint {
  endpointId: string;
  manufacturerName: string;
  friendlyName: string;
  description?: string;
  displayCategories: DisplayCategory[];
  capabilities: AlexaCapability[];
  cookie?: Record<string, unknown>;
}

/**
 * Discovery response payload
 */
export interface DiscoveryResponsePayload {
  endpoints: AlexaDiscoveryEndpoint[];
}

/**
 * Context property (device state)
 */
export interface ContextProperty {
  namespace: string;
  name: string;
  value: string | number | boolean | object;
  timeOfSample: string; // ISO 8601 timestamp
  uncertaintyInMilliseconds: number;
}

/**
 * Response context (current device state)
 */
export interface AlexaContext {
  properties: ContextProperty[];
}

/**
 * Alexa event structure (outgoing response to Alexa)
 */
export interface AlexaEvent<TPayload = unknown> {
  header: AlexaHeader;
  endpoint?: AlexaEndpoint;
  payload: TPayload;
}

/**
 * Complete Alexa response structure
 */
export interface AlexaResponse<TPayload = unknown> {
  context?: AlexaContext;
  event: AlexaEvent<TPayload>;
}

/**
 * Alexa error types
 */
export type AlexaErrorType =
  | 'NO_SUCH_ENDPOINT'
  | 'ENDPOINT_UNREACHABLE'
  | 'INVALID_DIRECTIVE'
  | 'INVALID_VALUE'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'BRIDGE_UNREACHABLE'
  | 'FIRMWARE_OUT_OF_DATE'
  | 'HARDWARE_MALFUNCTION'
  | 'NOT_SUPPORTED_IN_CURRENT_MODE'
  | 'VALUE_OUT_OF_RANGE';

/**
 * Error response payload
 */
export interface ErrorResponsePayload {
  type: AlexaErrorType;
  message: string;
}

/**
 * Type guard for Alexa directive
 */
export function isAlexaDirective(obj: unknown): obj is AlexaDirective {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'directive' in obj &&
    typeof obj.directive === 'object' &&
    obj.directive !== null &&
    'header' in obj.directive &&
    'payload' in obj.directive
  );
}

/**
 * Type guard for discovery directive
 */
export function isDiscoveryDirective(directive: AlexaDirective): boolean {
  return (
    directive.directive.header.namespace === 'Alexa.Discovery' &&
    directive.directive.header.name === 'Discover'
  );
}

/**
 * Type guard for power controller directive
 */
export function isPowerControllerDirective(directive: AlexaDirective): boolean {
  return (
    directive.directive.header.namespace === 'Alexa.PowerController' &&
    (directive.directive.header.name === 'TurnOn' || directive.directive.header.name === 'TurnOff')
  );
}

/**
 * Alexa capability namespace constants
 */
export const AlexaCapabilities = {
  POWER_CONTROLLER: 'Alexa.PowerController',
  BRIGHTNESS_CONTROLLER: 'Alexa.BrightnessController',
  COLOR_CONTROLLER: 'Alexa.ColorController',
  COLOR_TEMPERATURE_CONTROLLER: 'Alexa.ColorTemperatureController',
  THERMOSTAT_CONTROLLER: 'Alexa.ThermostatController',
  LOCK_CONTROLLER: 'Alexa.LockController',
  SCENE_CONTROLLER: 'Alexa.SceneController',
  PERCENTAGE_CONTROLLER: 'Alexa.PercentageController',
} as const;

/**
 * Alexa directive name constants
 */
export const AlexaDirectives = {
  DISCOVER: 'Discover',
  TURN_ON: 'TurnOn',
  TURN_OFF: 'TurnOff',
  SET_BRIGHTNESS: 'SetBrightness',
  ADJUST_BRIGHTNESS: 'AdjustBrightness',
  SET_COLOR: 'SetColor',
  SET_COLOR_TEMPERATURE: 'SetColorTemperature',
  ACTIVATE: 'Activate',
  DEACTIVATE: 'Deactivate',
} as const;

// ============================================================================
// Custom Skill (Conversational Alexa) Types
// ============================================================================

/**
 * Custom Skill request types
 */
export type CustomSkillRequestType = 'LaunchRequest' | 'IntentRequest' | 'SessionEndedRequest';

/**
 * Custom Skill intent slot
 */
export interface IntentSlot {
  name: string;
  value?: string;
  confirmationStatus?: 'NONE' | 'CONFIRMED' | 'DENIED';
}

/**
 * Custom Skill intent
 */
export interface Intent {
  name: string;
  confirmationStatus?: 'NONE' | 'CONFIRMED' | 'DENIED';
  slots?: Record<string, IntentSlot>;
}

/**
 * Custom Skill session
 */
export interface Session {
  new: boolean;
  sessionId: string;
  attributes?: Record<string, unknown>;
  user?: {
    userId: string;
  };
}

/**
 * Custom Skill request
 */
export interface CustomSkillRequestBody {
  type: CustomSkillRequestType;
  requestId: string;
  timestamp: string;
  locale?: string;
  intent?: Intent;
  reason?: 'USER_INITIATED' | 'ERROR' | 'EXCEEDED_MAX_REPROMPTS';
}

/**
 * Custom Skill full request structure
 */
export interface CustomSkillRequest {
  version: string;
  session?: Session;
  request: CustomSkillRequestBody;
  context?: {
    System?: {
      application: {
        applicationId: string;
      };
      user: {
        userId: string;
      };
    };
  };
}

/**
 * Custom Skill output speech
 */
export interface OutputSpeech {
  type: 'PlainText' | 'SSML';
  text?: string;
  ssml?: string;
}

/**
 * Custom Skill reprompt
 */
export interface Reprompt {
  outputSpeech: OutputSpeech;
}

/**
 * Custom Skill response body
 */
export interface CustomSkillResponseBody {
  outputSpeech?: OutputSpeech;
  card?: {
    type: 'Simple';
    title?: string;
    content?: string;
  };
  reprompt?: Reprompt;
  shouldEndSession: boolean;
}

/**
 * Custom Skill full response structure
 */
export interface CustomSkillResponse {
  version: string;
  sessionAttributes?: Record<string, unknown>;
  response: CustomSkillResponseBody;
}

/**
 * Type guard for Custom Skill request
 */
export function isCustomSkillRequest(obj: unknown): obj is CustomSkillRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'version' in obj &&
    'request' in obj &&
    typeof (obj as any).request === 'object' &&
    (obj as any).request !== null &&
    'type' in (obj as any).request
  );
}
