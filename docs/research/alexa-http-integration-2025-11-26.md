# Alexa Smart Home Skill & HTTP Transport Research

**Research Date:** 2025-11-26
**Project:** MCP SmartThings Server
**Objective:** Evaluate existing HTTP transport and design Alexa Smart Home Skill integration

---

## Executive Summary

This research analyzes the current HTTP transport implementation and provides comprehensive recommendations for integrating Alexa Smart Home Skill capabilities into the MCP SmartThings server. Key findings:

1. **Current HTTP Transport**: Functional SSE-based implementation using Express exists, but is designed for MCP protocol, not REST APIs
2. **Framework Recommendation**: **Fastify** over Express for 2-5x better performance
3. **Alexa Integration**: Requires dedicated `/alexa` endpoint with request verification, v3 Smart Home API compliance
4. **ngrok Strategy**: Static subdomain (smarty.ngrok-free.app) with HTTPS, custom domain possible with paid plan
5. **Security Critical**: Must implement signature verification and timestamp validation for Alexa requests

---

## 1. Current HTTP Transport Analysis

### 1.1 Existing Implementation

**File:** `/Users/masa/Projects/mcp-smarterthings/src/transport/http.ts`

**Current Architecture:**
- **Framework:** Express 4.19.2 (already in dependencies)
- **Transport:** Server-Sent Events (SSE) for MCP protocol
- **Port:** 3000 (configurable via `MCP_SERVER_PORT`)
- **Endpoints:**
  - `GET /health` - Health check endpoint
  - `GET /sse` - SSE connection for MCP clients
  - `POST /message` - Message endpoint for SSE transport

**Key Features:**
- ✅ Basic Express server setup
- ✅ JSON body parsing (`express.json()`)
- ✅ Health check endpoint
- ✅ Error handling middleware
- ✅ Graceful shutdown handling (SIGINT/SIGTERM)
- ✅ Logger integration (Winston)

**Limitations for Alexa Integration:**
- ❌ No REST API routes beyond MCP protocol
- ❌ No request verification middleware
- ❌ No CORS configuration
- ❌ No raw body parsing (required for signature verification)
- ❌ SSE transport not suitable for Alexa webhook model

### 1.2 HTTP vs STDIO Transport

**Configuration:** Environment variable `TRANSPORT_MODE` (enum: 'stdio' | 'http')

**Current Usage:**
- STDIO: Default for MCP client integration (Claude Desktop, CLI tools)
- HTTP: Available but underutilized (only SSE endpoints exist)

**Recommendation:** Maintain dual transport support, add REST endpoints alongside SSE

---

## 2. Framework Comparison: Express vs Fastify

### 2.1 Performance Benchmarks (2025)

| Metric | Express | Fastify | Performance Gain |
|--------|---------|---------|------------------|
| **Requests/sec** | 20,000-30,000 | 70,000-80,000 | **2.3-4x faster** |
| **Peak throughput** | 20,309 req/s | 114,195 req/s | **5.6x faster** |
| **Data throughput** | 290 kB/sec | 1,020 kB/sec | **3.5x faster** |
| **JSON serialization** | Standard | Schema-based | **2x faster** |

**Source:** Multiple benchmarks (Better Stack, MarkAICode, Michael Guay, Medium articles, 2025)

### 2.2 Technical Comparison

#### Express (Current)
**Pros:**
- ✅ Already installed and working
- ✅ Massive ecosystem (14,000+ middleware packages)
- ✅ Battle-tested (15+ years)
- ✅ Team familiarity
- ✅ Extensive community resources

**Cons:**
- ❌ 2-5x slower than Fastify
- ❌ No built-in schema validation
- ❌ No TypeScript optimization
- ❌ Slower JSON serialization

#### Fastify (Recommended)
**Pros:**
- ✅ **2-5x better performance** (critical for Alexa latency requirements)
- ✅ Built-in JSON schema validation
- ✅ First-class TypeScript support
- ✅ Plugin architecture with encapsulation
- ✅ Optimized routing engine (find-my-way)
- ✅ Native async/await support
- ✅ Growing ecosystem (6,000+ plugins)
- ✅ Modern API design

**Cons:**
- ❌ Requires migration effort (~2-4 hours for basic routes)
- ❌ Smaller ecosystem than Express
- ❌ Less mature (but actively developed)

### 2.3 Recommendation

**Choice:** **Fastify**

**Rationale:**
1. **Performance**: Alexa Smart Home Skills have strict latency requirements (<1s response time). Fastify's 2-5x performance advantage is significant.
2. **Schema Validation**: Built-in JSON schema validation aligns with Alexa's strict request/response format requirements.
3. **TypeScript**: Project already uses TypeScript; Fastify's native TS support is beneficial.
4. **Future-Proof**: Modern architecture, active development, growing ecosystem.

**Migration Strategy:**
- Phase 1: Add Fastify alongside Express (coexistence)
- Phase 2: Migrate `/alexa` endpoint to Fastify first (high-performance requirement)
- Phase 3: Optionally migrate other routes later (or keep Express for SSE)

---

## 3. Alexa Smart Home Skill API v3

### 3.1 API Version Status

**Critical Date:** Amazon will disable Version 2 of the Smart Home Skill API on **November 1, 2025**.

**Required Version:** API v3 (payloadVersion: "3")

### 3.2 Request Format

Alexa sends directives to your skill endpoint. Example `TurnOn` directive:

```json
{
  "directive": {
    "header": {
      "namespace": "Alexa.PowerController",
      "name": "TurnOn",
      "payloadVersion": "3",
      "messageId": "1bd5d003-31b9-476f-ad03-71d471922820",
      "correlationToken": "dFMb0z+PgpgdDmluhJ1LddFvSqZ/jCc8ptlAKulUj90jSqg=="
    },
    "endpoint": {
      "scope": {
        "type": "BearerToken",
        "token": "some-access-token"
      },
      "endpointId": "appliance-001",
      "cookie": {}
    },
    "payload": {}
  }
}
```

**Key Fields:**
- `header.namespace`: Controller interface (e.g., `Alexa.PowerController`)
- `header.name`: Directive name (e.g., `TurnOn`, `TurnOff`)
- `header.messageId`: Unique request identifier (UUID)
- `header.correlationToken`: Token for asynchronous responses
- `endpoint.endpointId`: Device identifier (maps to SmartThings deviceId)
- `endpoint.scope.token`: OAuth access token (user authentication)

### 3.3 Response Format

Responses must include both **context** (current device state) and **event** (confirmation):

```json
{
  "context": {
    "properties": [
      {
        "namespace": "Alexa.PowerController",
        "name": "powerState",
        "value": "ON",
        "timeOfSample": "2025-11-26T12:00:00Z",
        "uncertaintyInMilliseconds": 500
      }
    ]
  },
  "event": {
    "header": {
      "namespace": "Alexa",
      "name": "Response",
      "payloadVersion": "3",
      "messageId": "abc-123-def",
      "correlationToken": "dFMb0z+PgpgdDmluhJ1LddFvSqZ/jCc8ptlAKulUj90jSqg=="
    },
    "endpoint": {
      "endpointId": "appliance-001"
    },
    "payload": {}
  }
}
```

### 3.4 Required Alexa Directives

#### Core Directives (All Skills)

1. **Alexa.Discovery**
   - `Discover` - Return all available endpoints and their capabilities

2. **Alexa.Authorization**
   - `AcceptGrant` - OAuth authorization flow

#### Device Control Directives

| Namespace | Directives | SmartThings Capability |
|-----------|------------|------------------------|
| **Alexa.PowerController** | TurnOn, TurnOff | `switch` |
| **Alexa.BrightnessController** | SetBrightness, AdjustBrightness | `switchLevel` |
| **Alexa.ColorController** | SetColor | `colorControl` |
| **Alexa.ColorTemperatureController** | SetColorTemperature, IncreaseColorTemperature, DecreaseColorTemperature | `colorTemperature` |
| **Alexa.ThermostatController** | SetTargetTemperature, AdjustTargetTemperature, SetThermostatMode | `thermostat`, `thermostatMode`, `thermostatSetpoint` |
| **Alexa.LockController** | Lock, Unlock | `lock` |
| **Alexa.PercentageController** | SetPercentage, AdjustPercentage | Generic percentage control |
| **Alexa.SceneController** | Activate, Deactivate | SmartThings scenes |

### 3.5 Discovery Response Structure

When Alexa sends `Alexa.Discovery.Discover`, respond with all devices:

```json
{
  "event": {
    "header": {
      "namespace": "Alexa.Discovery",
      "name": "Discover.Response",
      "payloadVersion": "3",
      "messageId": "unique-id"
    },
    "payload": {
      "endpoints": [
        {
          "endpointId": "device-uuid-123",
          "manufacturerName": "SmartThings",
          "friendlyName": "Living Room Light",
          "description": "Smart light bulb",
          "displayCategories": ["LIGHT"],
          "capabilities": [
            {
              "type": "AlexaInterface",
              "interface": "Alexa.PowerController",
              "version": "3",
              "properties": {
                "supported": [{"name": "powerState"}],
                "proactivelyReported": false,
                "retrievable": true
              }
            },
            {
              "type": "AlexaInterface",
              "interface": "Alexa.BrightnessController",
              "version": "3",
              "properties": {
                "supported": [{"name": "brightness"}],
                "proactivelyReported": false,
                "retrievable": true
              }
            }
          ]
        }
      ]
    }
  }
}
```

---

## 4. Request Verification & Security

### 4.1 Alexa Security Requirements

For skills **NOT** hosted on AWS Lambda, you **MUST** implement:

1. **Signature Verification**: Validate request came from Amazon
2. **Timestamp Verification**: Reject requests older than 150 seconds
3. **Certificate Validation**: Verify SSL certificate chain

### 4.2 NPM Packages for Verification

#### Option 1: alexa-verifier (Standalone)

**Package:** `alexa-verifier`
**Version:** Latest (~2.x)
**Use Case:** Framework-agnostic verification

**Installation:**
```bash
npm install --save alexa-verifier
```

**Features:**
- ✅ Signature verification
- ✅ Timestamp validation (<150s)
- ✅ Certificate chain validation
- ✅ Framework-agnostic (works with Express, Fastify, etc.)

**Usage Pattern:**
```typescript
import * as verifier from 'alexa-verifier';

// In middleware/route handler
const cert_url = req.headers['signaturecertchainurl'];
const signature = req.headers['signature'];
const rawBody = req.rawBody; // Must capture raw body

verifier(cert_url, signature, rawBody, (err) => {
  if (err) {
    // Request verification failed
    res.status(400).json({ error: 'Invalid signature' });
  } else {
    // Request is valid, proceed
  }
});
```

**Requirements:**
- Must capture **raw request body** (before JSON parsing)
- Must check timestamp separately (< 150 seconds)

#### Option 2: ask-sdk-express-adapter (Official SDK)

**Package:** `ask-sdk-express-adapter`
**Version:** Latest (~2.x)
**Use Case:** Express-specific integration with ASK SDK

**Installation:**
```bash
npm install --save ask-sdk-express-adapter ask-sdk-core ask-sdk-model
```

**Features:**
- ✅ Built-in signature verification (`SkillRequestSignatureVerifier`)
- ✅ Built-in timestamp verification (`TimestampVerifier`)
- ✅ Integrated with ASK SDK ecosystem
- ✅ Express middleware support

**Usage Pattern:**
```typescript
import * as expressAdapter from 'ask-sdk-express-adapter';

// Create verifiers
const signatureVerifier = new expressAdapter.SkillRequestSignatureVerifier();
const timestampVerifier = new expressAdapter.TimestampVerifier();

// In middleware
app.post('/alexa', async (req, res) => {
  const textBody = req.rawBody; // Raw body string

  // Verify signature
  await signatureVerifier.verify(textBody, req.headers);

  // Verify timestamp
  await timestampVerifier.verify(textBody);

  // Process request...
});
```

### 4.3 Recommendation

**Choice:** **alexa-verifier** (standalone)

**Rationale:**
1. **Framework Agnostic**: Works with both Express and Fastify
2. **Lightweight**: Smaller dependency footprint than full ASK SDK
3. **Simplicity**: Single-purpose verification library
4. **Independence**: Not tied to ASK SDK ecosystem (we're using MCP, not standard Alexa intents)

**Alternative:** If we later add custom Alexa Skills (not Smart Home), consider `ask-sdk-express-adapter` for full SDK integration.

---

## 5. ngrok Configuration

### 5.1 Custom Domain Options

#### Free Tier (ngrok-free)
- **Domains:** `*.ngrok-free.app` or `*.ngrok-free.dev`
- **Static Subdomain:** Yes (e.g., `smarty.ngrok-free.app`)
- **HTTPS:** Automatic (Let's Encrypt)
- **Limitations:**
  - HSTS preload list (HTTP blocked for `.app` and `.dev` domains)
  - Must use HTTPS only
  - ngrok branding in browser warning

#### Paid Tier (Pay-as-you-go)
- **Domains:** Bring your own domain (e.g., `smarty.yourdomain.com`)
- **Static Domain:** Yes (reserved domains)
- **HTTPS:** Automatic with custom certificates
- **Custom CNAME:** Point your DNS to ngrok

### 5.2 Configuration File

**Location:** `~/.config/ngrok/ngrok.yml` (or `ngrok config edit`)

**Example Configuration:**
```yaml
version: "2"
authtoken: YOUR_NGROK_AUTH_TOKEN

tunnels:
  smartthings-alexa:
    proto: http
    addr: 3000
    subdomain: smarty  # Results in smarty.ngrok-free.app
    inspect: true
    bind_tls: true  # HTTPS only
```

**Start Tunnel:**
```bash
ngrok start smartthings-alexa
```

### 5.3 Port Mapping Strategy

**Option 1: Direct Port Mapping (Recommended)**
- ngrok → `http://localhost:3000` → MCP server
- **Pros:** Simple, single process
- **Cons:** MCP server handles all traffic (REST + SSE)

**Option 2: Reverse Proxy**
- ngrok → nginx/Caddy → routes to different backends
- **Pros:** Separate HTTP services, better isolation
- **Cons:** Additional complexity

**Recommendation:** Option 1 for initial implementation (single Express/Fastify server handles both MCP SSE and Alexa REST)

### 5.4 HTTPS Certificate Handling

**ngrok Behavior:**
- ngrok terminates HTTPS at its edge servers
- Forwards HTTP to your local service
- Your local service sees HTTP traffic (no cert management needed)

**Benefit:** No need to manage SSL certificates locally; ngrok handles it.

### 5.5 Best Practices for Alexa + ngrok

1. **Use Static Subdomain**: Avoids re-configuring Alexa skill endpoint on every restart
2. **Enable Request Inspection**: `inspect: true` for debugging Alexa requests
3. **HTTPS Only**: Set `bind_tls: true` to enforce HTTPS (required by Alexa)
4. **Health Monitoring**: ngrok dashboard shows connection status
5. **Reserve Domain**: For production, use reserved domain (paid plan) to prevent conflicts
6. **Rate Limiting**: Be aware of ngrok's rate limits on free tier

---

## 6. SmartThings to Alexa Capability Mapping

### 6.1 Current SmartThings Capabilities (from MCP tools)

**Available Tools:**
- `turn_on_device` - Switch capability
- `turn_off_device` - Switch capability
- `get_device_status` - Query all capabilities
- `list_devices` - Discovery
- `get_device_capabilities` - Capability introspection

**SmartThings Capabilities (from codebase):**
- `switch` - Basic on/off control

### 6.2 Comprehensive Capability Mapping

| SmartThings Capability | Alexa Interface | Directives | Notes |
|------------------------|-----------------|------------|-------|
| **switch** | Alexa.PowerController | TurnOn, TurnOff | ✅ Implemented |
| **switchLevel** | Alexa.BrightnessController | SetBrightness, AdjustBrightness | Lights with dimming |
| **colorControl** | Alexa.ColorController | SetColor | RGB lights |
| **colorTemperature** | Alexa.ColorTemperatureController | SetColorTemperature, Increase/DecreaseColorTemperature | Tunable white lights |
| **thermostat** | Alexa.ThermostatController | SetTargetTemperature, AdjustTargetTemperature, SetThermostatMode | HVAC control |
| **thermostatMode** | Alexa.ThermostatController.Mode | SetThermostatMode | Heat/Cool/Auto |
| **thermostatCoolingSetpoint** | Alexa.ThermostatController.CoolingSetpoint | SetTargetTemperature (cool) | Cooling target |
| **thermostatHeatingSetpoint** | Alexa.ThermostatController.HeatingSetpoint | SetTargetTemperature (heat) | Heating target |
| **lock** | Alexa.LockController | Lock, Unlock | Smart locks |
| **contactSensor** | Alexa.ContactSensor | N/A (state reporting only) | Door/window sensors |
| **motionSensor** | Alexa.MotionSensor | N/A (state reporting only) | Motion detection |
| **temperatureMeasurement** | Alexa.TemperatureSensor | N/A (state reporting only) | Temperature sensors |
| **relativeHumidityMeasurement** | Alexa.HumiditySensor | N/A (state reporting only) | Humidity sensors |
| **valve** | Alexa.PowerController | TurnOn, TurnOff | Water valves, gas valves |
| **doorControl** | Alexa.ModeController | SetMode | Garage doors |
| **windowShade** | Alexa.RangeController | SetRangeValue, AdjustRangeValue | Blinds, shades |

### 6.3 Device Categories (displayCategories)

Alexa requires a `displayCategories` array in discovery responses:

| SmartThings Type | Alexa Category | Examples |
|------------------|----------------|----------|
| Light | `LIGHT` | Bulbs, strips, fixtures |
| Switch | `SWITCH` | Wall switches, outlet switches |
| Plug | `SMARTPLUG` | Smart outlets |
| Thermostat | `THERMOSTAT` | HVAC controllers |
| Lock | `SMARTLOCK` | Door locks |
| Camera | `CAMERA` | Security cameras |
| Door | `DOOR` | Garage doors |
| Scene | `SCENE_TRIGGER` | SmartThings scenes |
| Sensor | `TEMPERATURE_SENSOR`, `MOTION_SENSOR`, `CONTACT_SENSOR` | Various sensors |
| Blind | `BLINDS` | Window coverings |
| Fan | `FAN` | Ceiling fans, standalone fans |

---

## 7. Architecture Recommendations

### 7.1 Endpoint Structure

**Base URL:** `https://smarty.ngrok-free.app`

**Endpoints:**

| Path | Method | Purpose | Auth |
|------|--------|---------|------|
| `/alexa` | POST | Alexa Smart Home directive handler | Signature verification |
| `/health` | GET | Health check (existing) | None |
| `/sse` | GET | MCP SSE transport (existing) | None |
| `/message` | POST | MCP message endpoint (existing) | None |

### 7.2 Request Flow Diagram

```
Alexa Service
    ↓ (HTTPS POST)
ngrok Edge (smarty.ngrok-free.app)
    ↓ (HTTP POST)
Local Server (localhost:3000)
    ↓
/alexa Endpoint
    ↓
Request Verification Middleware
    ├─ Signature Verification (alexa-verifier)
    ├─ Timestamp Validation (<150s)
    └─ Certificate Validation
    ↓
Directive Router
    ├─ Alexa.Discovery → Device Discovery
    ├─ Alexa.PowerController → turn_on_device / turn_off_device
    ├─ Alexa.BrightnessController → set_level (future)
    └─ [Other controllers...]
    ↓
MCP Client (internal)
    ├─ Call MCP tools (turn_on_device, etc.)
    └─ Get device status
    ↓
SmartThings API
    ↓
Response Builder
    ├─ Build Alexa v3 response
    ├─ Include context (current state)
    └─ Include event (confirmation)
    ↓
Alexa Service
```

### 7.3 Intent Mapping Architecture

**Pattern:** Alexa Directive → MCP Tool Handler

**Implementation Strategy:**

1. **Directive Router**: Map Alexa namespace+name to handler functions
   ```typescript
   const directiveHandlers = {
     'Alexa.Discovery': {
       'Discover': handleDiscovery,
     },
     'Alexa.PowerController': {
       'TurnOn': handleTurnOn,
       'TurnOff': handleTurnOff,
     },
     // ...
   };
   ```

2. **Handler Functions**: Call MCP tools internally
   ```typescript
   async function handleTurnOn(directive) {
     const deviceId = directive.endpoint.endpointId;

     // Call MCP tool handler directly (not via network)
     const result = await handleTurnOnDevice({ deviceId });

     // Build Alexa response
     return buildAlexaResponse(result, directive);
   }
   ```

3. **Response Builder**: Transform MCP responses to Alexa format
   ```typescript
   function buildAlexaResponse(mcpResult, directive) {
     return {
       context: buildContext(mcpResult),
       event: buildEvent(directive),
     };
   }
   ```

### 7.4 Error Handling

**Alexa Error Response Format:**

```json
{
  "event": {
    "header": {
      "namespace": "Alexa",
      "name": "ErrorResponse",
      "messageId": "unique-id",
      "payloadVersion": "3"
    },
    "endpoint": {
      "endpointId": "device-id"
    },
    "payload": {
      "type": "ENDPOINT_UNREACHABLE",
      "message": "Unable to reach device"
    }
  }
}
```

**Error Type Mapping:**

| MCP Error | Alexa Error Type |
|-----------|------------------|
| Device not found | `NO_SUCH_ENDPOINT` |
| SmartThings API error | `ENDPOINT_UNREACHABLE` |
| Capability not supported | `INVALID_DIRECTIVE` |
| Validation error | `INVALID_VALUE` |
| Authentication error | `INSUFFICIENT_PERMISSIONS` |
| Rate limit | `RATE_LIMIT_EXCEEDED` |
| Timeout | `INTERNAL_ERROR` |

### 7.5 Security Considerations

1. **Request Verification**: ALWAYS verify signature and timestamp
2. **OAuth Tokens**: Store and validate user tokens (for multi-user support)
3. **Device Access Control**: Validate user owns the device before control
4. **Rate Limiting**: Implement rate limiting per user/IP
5. **Logging**: Log all Alexa requests for debugging (sanitize tokens)
6. **Error Messages**: Don't leak internal system details in error responses

---

## 8. Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Setup Fastify server with basic Alexa endpoint

**Tasks:**
1. ✅ Research completed
2. Install dependencies:
   ```bash
   npm install --save fastify @fastify/cors @fastify/helmet alexa-verifier
   npm install --save-dev @types/alexa-verifier
   ```
3. Create `src/transport/fastify.ts` (parallel to existing `http.ts`)
4. Implement basic `/alexa` POST endpoint
5. Integrate `alexa-verifier` middleware
6. Setup ngrok with static subdomain (`smarty.ngrok-free.app`)
7. Test basic request verification

**Deliverables:**
- Working Fastify server on port 3000
- `/alexa` endpoint accepts and verifies requests
- ngrok tunnel configured

### Phase 2: Discovery (Week 1-2)

**Goal:** Implement device discovery for Alexa

**Tasks:**
1. Implement `handleAlexaDiscovery()` handler
2. Map SmartThings devices to Alexa endpoints
3. Map SmartThings capabilities to Alexa interfaces
4. Implement `displayCategories` logic
5. Build discovery response format
6. Test discovery with Alexa app

**Deliverables:**
- Alexa can discover SmartThings devices
- Devices appear in Alexa app with correct names/types
- Basic capability mapping (at least PowerController)

### Phase 3: Device Control (Week 2-3)

**Goal:** Implement core device control directives

**Tasks:**
1. Implement `Alexa.PowerController` (TurnOn/TurnOff)
2. Integrate with existing MCP tools (`turn_on_device`, `turn_off_device`)
3. Implement state reporting in responses (context)
4. Test voice commands: "Alexa, turn on living room light"
5. Error handling for unreachable devices

**Deliverables:**
- Working on/off control via Alexa
- Voice commands function correctly
- Error responses handled gracefully

### Phase 4: Additional Capabilities (Week 3-4)

**Goal:** Add brightness, color, thermostat support

**Tasks:**
1. Implement `Alexa.BrightnessController`
2. Implement `Alexa.ColorController` (if applicable)
3. Implement `Alexa.ThermostatController` (if applicable)
4. Extend MCP tools to support new capabilities
5. Update discovery to include new interfaces
6. Test with compatible devices

**Deliverables:**
- Brightness control: "Alexa, set bedroom light to 50%"
- Color control: "Alexa, set light to blue" (if RGB devices exist)
- Thermostat control: "Alexa, set temperature to 72 degrees"

### Phase 5: Scenes & Advanced Features (Week 4-5)

**Goal:** Scene activation and optimization

**Tasks:**
1. Implement `Alexa.SceneController` for SmartThings scenes
2. Integrate with existing `execute_scene` MCP tool
3. Performance optimization (caching, response time)
4. Comprehensive error handling
5. Monitoring and logging improvements
6. Documentation

**Deliverables:**
- Scene activation: "Alexa, turn on movie time"
- Sub-300ms response times
- Production-ready error handling
- Complete API documentation

### Phase 6: OAuth & Multi-User (Optional, Week 5-6)

**Goal:** Support multiple SmartThings accounts

**Tasks:**
1. Implement OAuth 2.0 authorization flow
2. Store user tokens securely
3. Map Alexa user to SmartThings account
4. Update device discovery per user
5. Test with multiple accounts

**Deliverables:**
- Multiple users can link their SmartThings accounts
- Proper account isolation
- Secure token storage

---

## 9. Code Examples

### 9.1 Fastify Server Setup

```typescript
// src/transport/fastify.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { environment } from '../config/environment.js';
import { alexaRoutes } from '../alexa/routes.js';
import logger from '../utils/logger.js';

export async function startFastifyTransport(server: Server): Promise<void> {
  const fastify = Fastify({
    logger: false, // Use our Winston logger instead
    bodyLimit: 1048576, // 1MB limit
  });

  // Security
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: true, // Configure for production
  });

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      service: environment.MCP_SERVER_NAME,
      version: environment.MCP_SERVER_VERSION,
    };
  });

  // Alexa routes
  await fastify.register(alexaRoutes, { prefix: '/alexa' });

  // MCP SSE routes (if needed)
  // ... (migrate from Express or keep Express for SSE)

  // Start server
  await fastify.listen({
    port: environment.MCP_SERVER_PORT,
    host: '0.0.0.0',
  });

  logger.info('Fastify server started', {
    port: environment.MCP_SERVER_PORT,
    url: `http://localhost:${environment.MCP_SERVER_PORT}`,
  });
}
```

### 9.2 Alexa Request Verification Middleware

```typescript
// src/alexa/middleware/verification.ts
import * as verifier from 'alexa-verifier';
import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';

export async function verifyAlexaRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const cert_url = request.headers['signaturecertchainurl'] as string;
  const signature = request.headers['signature'] as string;
  const rawBody = JSON.stringify(request.body);

  return new Promise((resolve, reject) => {
    verifier(cert_url, signature, rawBody, (err) => {
      if (err) {
        logger.error('Alexa request verification failed', { error: err.message });
        reply.code(400).send({ error: 'Invalid request signature' });
        reject(err);
      } else {
        // Verify timestamp
        const timestamp = (request.body as any)?.directive?.header?.timestamp ||
                          (request.body as any)?.request?.timestamp;

        if (!timestamp) {
          reply.code(400).send({ error: 'Missing timestamp' });
          reject(new Error('Missing timestamp'));
          return;
        }

        const requestTime = new Date(timestamp).getTime();
        const currentTime = Date.now();
        const timeDiff = Math.abs(currentTime - requestTime);

        // Alexa requires < 150 seconds
        if (timeDiff > 150000) {
          logger.error('Alexa request timestamp too old', {
            timeDiff: `${timeDiff / 1000}s`
          });
          reply.code(400).send({ error: 'Request timestamp too old' });
          reject(new Error('Timestamp too old'));
          return;
        }

        resolve();
      }
    });
  });
}
```

### 9.3 Alexa Routes

```typescript
// src/alexa/routes.ts
import { FastifyInstance } from 'fastify';
import { verifyAlexaRequest } from './middleware/verification.js';
import { handleAlexaDirective } from './handlers/directive.js';
import logger from '../utils/logger.js';

export async function alexaRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook('preHandler', verifyAlexaRequest);

  fastify.post('/', async (request, reply) => {
    try {
      logger.info('Received Alexa directive', {
        namespace: (request.body as any)?.directive?.header?.namespace,
        name: (request.body as any)?.directive?.header?.name,
      });

      const response = await handleAlexaDirective(request.body as any);
      return response;
    } catch (error) {
      logger.error('Error handling Alexa directive', { error });
      return buildErrorResponse(error);
    }
  });
}
```

### 9.4 Directive Handler

```typescript
// src/alexa/handlers/directive.ts
import { AlexaDirective, AlexaResponse } from '../types.js';
import { handleDiscovery } from './discovery.js';
import { handlePowerController } from './power.js';
import logger from '../../utils/logger.js';

export async function handleAlexaDirective(
  directive: AlexaDirective
): Promise<AlexaResponse> {
  const namespace = directive.directive.header.namespace;
  const name = directive.directive.header.name;

  logger.debug('Routing directive', { namespace, name });

  // Route to appropriate handler
  if (namespace === 'Alexa.Discovery' && name === 'Discover') {
    return handleDiscovery(directive);
  }

  if (namespace === 'Alexa.PowerController') {
    return handlePowerController(directive);
  }

  // Add more handlers...

  // Unknown directive
  throw new Error(`Unsupported directive: ${namespace}.${name}`);
}
```

### 9.5 Discovery Handler

```typescript
// src/alexa/handlers/discovery.ts
import { smartThingsService } from '../../smartthings/client.js';
import { AlexaDirective, AlexaResponse } from '../types.js';
import { mapDeviceToEndpoint } from '../mappers/device.js';

export async function handleDiscovery(
  directive: AlexaDirective
): Promise<AlexaResponse> {
  // Get all SmartThings devices
  const devices = await smartThingsService.listDevices();

  // Map to Alexa endpoints
  const endpoints = devices.map(mapDeviceToEndpoint);

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
```

### 9.6 Power Controller Handler

```typescript
// src/alexa/handlers/power.ts
import { handleTurnOnDevice, handleTurnOffDevice } from '../../mcp/tools/device-control.js';
import { AlexaDirective, AlexaResponse } from '../types.js';
import { buildResponseWithContext } from '../builders/response.js';

export async function handlePowerController(
  directive: AlexaDirective
): Promise<AlexaResponse> {
  const name = directive.directive.header.name;
  const deviceId = directive.directive.endpoint.endpointId;

  let result;
  if (name === 'TurnOn') {
    result = await handleTurnOnDevice({ deviceId });
  } else if (name === 'TurnOff') {
    result = await handleTurnOffDevice({ deviceId });
  } else {
    throw new Error(`Unsupported power directive: ${name}`);
  }

  // Check for MCP errors
  if ('isError' in result && result.isError) {
    throw new Error(result.content[0].text);
  }

  // Build Alexa response with current state
  return buildResponseWithContext(directive, 'powerState',
    name === 'TurnOn' ? 'ON' : 'OFF');
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
- Alexa request verification (signature, timestamp)
- Directive routing logic
- Device-to-endpoint mapping
- Response builders

### 10.2 Integration Tests
- Full Alexa request flow (verification → handler → response)
- MCP tool integration
- SmartThings API calls
- Error scenarios

### 10.3 Manual Testing
- Alexa app device discovery
- Voice commands via Alexa device/app
- ngrok tunnel stability
- Latency measurement (<1s requirement)

### 10.4 Tools
- **Alexa Skill Testing Tool**: Test directives without voice
- **ngrok Inspector**: Debug HTTP requests
- **Postman**: Manual directive testing
- **Vitest**: Unit/integration tests

---

## 11. Dependencies to Install

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "alexa-verifier": "^2.1.0"
  },
  "devDependencies": {
    "@types/alexa-verifier": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

**Installation Command:**
```bash
pnpm add fastify @fastify/cors @fastify/helmet alexa-verifier
pnpm add -D @types/alexa-verifier
```

---

## 12. Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **HTTP Framework** | Fastify | 2-5x faster than Express, built-in schema validation, modern TypeScript support |
| **Verification Library** | alexa-verifier | Framework-agnostic, lightweight, single-purpose |
| **Transport Strategy** | Dual (Fastify + Express SSE) | Add Fastify for REST APIs, keep Express for existing SSE transport |
| **ngrok Domain** | Static subdomain (smarty.ngrok-free.app) | Avoids reconfiguring Alexa endpoint on restart |
| **Port** | 3000 | Consistent with current setup, single server handles all traffic |
| **Alexa API Version** | v3 | Required (v2 deprecated Nov 2025) |
| **Device ID** | SmartThings UUID | Direct mapping (endpointId = deviceId) |
| **Authentication** | Signature verification (Phase 1), OAuth (Phase 6) | Security first, multi-user support later |

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Alexa latency requirement (<1s)** | High | Use Fastify (2-5x faster), optimize response builders, cache device list |
| **ngrok free tier limitations** | Medium | Monitor rate limits, upgrade to paid if needed, document limits |
| **Request verification complexity** | Medium | Use battle-tested `alexa-verifier` library, comprehensive tests |
| **SmartThings API rate limits** | Medium | Implement caching, batch requests, exponential backoff |
| **Multi-user support complexity** | Low (Phase 6) | Defer to later phase, implement OAuth properly |
| **Capability mapping gaps** | Low | Start with core capabilities (power, brightness), expand iteratively |

---

## 14. Success Metrics

1. **Discovery Success Rate**: >95% of SmartThings devices discoverable by Alexa
2. **Response Latency**: <500ms for 95% of requests (Alexa requires <1s)
3. **Command Success Rate**: >98% of valid commands execute successfully
4. **Uptime**: >99% ngrok tunnel uptime
5. **Error Rate**: <2% of requests result in Alexa errors
6. **User Satisfaction**: Voice commands work naturally ("Alexa, turn on living room light")

---

## 15. Next Steps

1. **Review this research document** with team
2. **Approve Phase 1 implementation** (Fastify + basic /alexa endpoint)
3. **Setup ngrok account** and reserve static subdomain
4. **Install dependencies** (Fastify, alexa-verifier)
5. **Begin Phase 1 implementation** (Foundation)

---

## 16. References

### Official Documentation
- [Alexa Smart Home Skills API v3](https://developer.amazon.com/en-US/docs/alexa/smarthome/understand-the-smart-home-skill-api.html)
- [Alexa Discovery Interface](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html)
- [Alexa PowerController Interface](https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-powercontroller.html)
- [ngrok Documentation](https://ngrok.com/docs/)
- [Fastify Official Site](https://fastify.dev/)

### NPM Packages
- [alexa-verifier](https://www.npmjs.com/package/alexa-verifier)
- [ask-sdk-express-adapter](https://www.npmjs.com/package/ask-sdk-express-adapter)
- [fastify](https://www.npmjs.com/package/fastify)

### Benchmarks & Articles
- [Express vs Fastify Performance Comparison (2025)](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/)
- [Fastify vs Express Benchmarks](https://fastify.dev/benchmarks/)

### Community Resources
- [Alexa Smart Home Samples (GitHub)](https://github.com/alexa-samples/alexa-smarthome)
- [Fastify Plugins Ecosystem](https://www.fastify.io/ecosystem/)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-26
**Author:** Research Agent (Claude)
**Status:** ✅ Complete - Ready for Implementation
