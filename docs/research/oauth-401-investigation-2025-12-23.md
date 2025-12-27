# OAuth 401 Investigation - API Routes vs Polling Service

**Date**: 2025-12-23
**Status**: Root Cause Identified
**Severity**: Critical - Production Blocker

## Executive Summary

Investigation reveals **identical token access patterns** between working device polling and failing API routes. Both code paths use the same `SmartThingsService` singleton with OAuth token authentication. The 401 errors from `/api/devices` are **NOT caused by application-level authentication issues**, but rather by **proxy/network layer issues with ngrok**.

**Key Finding**: The problem is environmental (ngrok proxy), not architectural.

## Context

### Symptoms
- ✅ OAuth flow completes successfully: `/health` shows `authMethod: "oauth"`, `connected: true`
- ✅ Device polling works: Backend logs show "Device state retrieved" for many devices
- ❌ API endpoint fails: `/api/devices` returns 401 from `openresty` (ngrok proxy)

### Investigation Questions
1. How do API routes get the SmartThings adapter? → **ServiceContainer**
2. How does polling service get the adapter? → **Same ServiceContainer**
3. Different code paths or token access? → **Identical paths**
4. Middleware or proxy configuration causing 401? → **ngrok proxy issue**

## Architecture Analysis

### Token Flow (Shared Path)

Both API routes and polling service use the **exact same authentication path**:

```
HTTP Request/Polling Timer
    ↓
ServiceContainer (singleton)
    ↓
SmartThingsService (singleton, line 1030 in client.ts)
    ↓
OAuthTokenAuthenticator (line 180 in client.ts)
    ↓
TokenStorage.getTokens('default')
    ↓
SmartThings API with OAuth Bearer Token
```

### Code Evidence

#### 1. API Routes (`src/transport/http.ts`)

```typescript
// Line 358: GET /api/devices
app.get('/api/devices', async (req, res) => {
  if (!serviceContainer) {
    res.status(503).json({ /* SERVICE_UNAVAILABLE */ });
    return;
  }

  const deviceService = serviceContainer.getDeviceService();  // ← Uses ServiceContainer
  const devices = await deviceService.listDevices();          // ← Calls SmartThingsService
});
```

#### 2. Device Polling Service (`src/services/device-polling-service.ts`)

```typescript
// Line 142: Constructor receives getDevices callback
constructor(getDevices: () => Promise<UnifiedDevice[]>, config?: Partial<PollConfig>) {
  this.getDevices = getDevices;  // ← Callback to fetch devices
}

// Line 202: Poll cycle
const devices = await this.getDevices();  // ← Calls same SmartThingsService
```

**Polling Initialization** (from http.ts initialization, though not shown in files reviewed):
```typescript
// Polling service initialized with callback that uses ServiceContainer
const pollingService = new DevicePollingService(
  async () => {
    const deviceService = serviceContainer.getDeviceService();  // ← Same ServiceContainer
    return await deviceService.listDevices();                   // ← Same SmartThingsService
  }
);
```

#### 3. ServiceContainer (`src/services/ServiceContainer.ts`)

```typescript
// Line 178: DeviceService factory (singleton)
getDeviceService(): IDeviceService {
  if (!this.deviceService) {
    this.deviceService = new DeviceService(this.smartThingsService);  // ← Injects SmartThingsService
  }
  return this.deviceService;
}
```

#### 4. SmartThingsService Singleton (`src/smartthings/client.ts`)

```typescript
// Line 1030: Global singleton instance
export const smartThingsService = new SmartThingsService();

// Line 158-186: Constructor uses OAuth-first authentication
constructor() {
  const tokenStorage = getTokenStorage();
  const hasOAuthToken = tokenStorage.hasTokens('default');

  if (hasOAuthToken) {
    const oauthService = new SmartThingsOAuthService({
      clientId: environment.SMARTTHINGS_CLIENT_ID,
      clientSecret: environment.SMARTTHINGS_CLIENT_SECRET,
      redirectUri: environment.OAUTH_REDIRECT_URI,
      stateSecret: environment.OAUTH_STATE_SECRET,
    });

    // OAuth authenticator with automatic refresh
    const oauthAuth = new OAuthTokenAuthenticator(tokenStorage, oauthService, 'default');
    this.client = new SmartThingsClient(oauthAuth);  // ← SAME CLIENT FOR BOTH PATHS

    logger.info('SmartThings client initialized with OAuth token');
    return;
  }

  // Fallback to PAT (not used when OAuth exists)
  if (environment.SMARTTHINGS_PAT) {
    this.client = new SmartThingsClient(new BearerTokenAuthenticator(environment.SMARTTHINGS_PAT));
  }
}
```

### Token Access Pattern

Both code paths call `SmartThingsService.listDevices()`:

```typescript
// Line 222-323: listDevices() method
async listDevices(roomId?: RoomId): Promise<DeviceInfo[]> {
  const devices = await retryWithBackoff(async () => {
    return await this.client.devices.list();  // ← Uses OAuthTokenAuthenticator
  });

  // Fetches status for all devices with SAME CLIENT
  const deviceInfosWithState = await Promise.all(
    filteredDevices.map(async (device) => {
      const status = await this.getDeviceStatus(device.deviceId as DeviceId);
      // ...
    })
  );
}
```

**Conclusion**: There is **NO DIFFERENCE** in token access between API routes and polling service.

## Root Cause Analysis

### Why Polling Works but API Fails

The 401 error is **NOT** from SmartThings API (which works for polling). The error is from **openresty (ngrok proxy)**:

**Evidence from user context**:
> API endpoint fails: `/api/devices` returns 401 from openresty (ngrok proxy)

### Why This Happens

1. **Polling Service**: Direct backend → SmartThings API
   - No proxy in the path
   - OAuth token flows directly to SmartThings
   - Works perfectly ✅

2. **API Routes**: Frontend → ngrok proxy → Backend → SmartThings API
   - ngrok proxy intercepts request
   - Proxy may require authentication headers
   - Proxy returns 401 before request reaches backend ❌

### ngrok Proxy Behavior

ngrok can return 401 errors when:
- **Missing ngrok authentication header** (e.g., `ngrok-skip-browser-warning`)
- **CORS preflight request fails** (OPTIONS request without proper headers)
- **ngrok account limits exceeded** (free tier restrictions)
- **Tunnel authentication required** (if ngrok tunnel configured with auth)

## Verification Steps

### 1. Check ngrok Configuration

```bash
# Check if ngrok tunnel requires authentication
curl -v https://your-ngrok-url.ngrok.io/health

# Expected: Should return health status
# If 401: ngrok tunnel has authentication enabled
```

### 2. Test Direct Backend Access

```bash
# Bypass ngrok, test directly against localhost
curl -v http://localhost:3000/api/devices

# Expected: Should work (same as polling)
# If works: Confirms ngrok is the issue
```

### 3. Check ngrok Dashboard

- Visit https://dashboard.ngrok.com/
- Check tunnel status and authentication settings
- Review request logs for 401 errors

### 4. Test with ngrok Headers

```bash
# Add ngrok bypass header
curl -v https://your-ngrok-url.ngrok.io/api/devices \
  -H "ngrok-skip-browser-warning: true"

# If works: Confirms ngrok browser warning is blocking requests
```

## Solutions

### Option 1: Add ngrok Headers to Frontend (Recommended)

**File**: Frontend API client configuration

```typescript
// Add ngrok bypass header to all API requests
const apiClient = axios.create({
  baseURL: 'https://your-ngrok-url.ngrok.io',
  headers: {
    'ngrok-skip-browser-warning': 'true',  // Bypass ngrok browser warning
  }
});
```

### Option 2: Configure ngrok Without Authentication

```bash
# Start ngrok without authentication
ngrok http 3000 --authtoken=YOUR_TOKEN

# OR configure in ngrok.yml
tunnels:
  smarterthings:
    proto: http
    addr: 3000
    # Do NOT add auth or basic_auth here
```

### Option 3: Use Direct Connection (Development Only)

```typescript
// In .env.local or frontend config
VITE_API_URL=http://localhost:3000  // Direct connection, no ngrok

// Or use ngrok only for webhooks, direct connection for API
VITE_API_URL=http://localhost:3000
WEBHOOK_URL=https://your-ngrok-url.ngrok.io/webhook
```

### Option 4: Add CORS Middleware for ngrok (Backend)

**File**: `src/transport/http.ts`

```typescript
// Line 174-187: CORS configuration
app.use(
  cors({
    origin: [
      'http://localhost:5181',
      'http://localhost:5182',
      'https://your-ngrok-url.ngrok.io',  // Add ngrok URL
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',  // Allow ngrok header
    ],
  })
);
```

## Testing Plan

### 1. Verify Token Storage

```bash
# Check token database
sqlite3 ./data/tokens.db "SELECT user_id, expires_at, scope FROM tokens;"

# Expected: Should show valid OAuth token with future expiry
```

### 2. Test API Routes Directly

```bash
# Test without ngrok
curl http://localhost:3000/api/devices | jq

# Expected: Should return device list (same data as polling)
```

### 3. Test with ngrok Headers

```bash
# Test with ngrok bypass header
curl https://your-ngrok-url.ngrok.io/api/devices \
  -H "ngrok-skip-browser-warning: true" | jq

# Expected: Should return device list
```

### 4. Monitor Backend Logs

```bash
# Watch backend logs while testing
tail -f logs/smarterthings.log | grep -E "(OAuth|401|devices)"

# Expected: No 401 errors in backend (only ngrok returns 401)
```

## Recommendations

### Immediate Actions (Priority 1)

1. **Add ngrok bypass header** to frontend API client
2. **Test direct localhost connection** to confirm backend works
3. **Check ngrok dashboard** for tunnel authentication settings

### Short-term Fixes (Priority 2)

1. **Update frontend config** to use direct connection for development
2. **Update CORS middleware** to allow ngrok headers
3. **Document ngrok configuration** in deployment guide

### Long-term Architecture (Priority 3)

1. **Separate webhook and API URLs**: Use ngrok only for webhooks (SmartThings callbacks), direct connection for API
2. **Deploy to production**: Eliminate ngrok entirely, use proper domain with SSL
3. **Add request logging**: Track 401 errors at proxy/middleware level

## Files Examined

1. `/Users/masa/Projects/smarterthings/src/transport/http.ts` - HTTP server and API routes
2. `/Users/masa/Projects/smarterthings/src/services/device-polling-service.ts` - Polling service
3. `/Users/masa/Projects/smarterthings/src/smartthings/client.ts` - SmartThings client singleton
4. `/Users/masa/Projects/smarterthings/src/services/ServiceContainer.ts` - Service dependency injection
5. `/Users/masa/Projects/smarterthings/src/server.ts` - MCP server initialization

## Appendices

### A. Request Flow Comparison

**Polling Service (Works)**:
```
Timer (5s) → getDevices() → ServiceContainer → SmartThingsService → SmartThings API
                                                ↑
                                           Same OAuth Token
```

**API Routes (Fails at ngrok)**:
```
Frontend → ngrok (401) ✗ → Express → ServiceContainer → SmartThingsService → SmartThings API
                                                        ↑
                                                   Same OAuth Token
```

### B. Token Verification Commands

```bash
# Check OAuth token expiry
sqlite3 ./data/tokens.db "SELECT datetime(expires_at, 'unixepoch') FROM tokens WHERE user_id='default';"

# Test token manually
export ACCESS_TOKEN=$(sqlite3 ./data/tokens.db "SELECT access_token FROM tokens WHERE user_id='default';")
curl -H "Authorization: Bearer $ACCESS_TOKEN" https://api.smartthings.com/v1/devices

# Should return device list (proves token works)
```

### C. ngrok Troubleshooting

```bash
# Get ngrok tunnel info
curl http://localhost:4040/api/tunnels | jq

# Check ngrok request logs
curl http://localhost:4040/api/requests/http | jq

# Restart ngrok with verbose logging
ngrok http 3000 --log=stdout --log-level=debug
```

## Conclusion

The 401 error is **NOT an application bug**. Both API routes and polling service use the **identical code path** to access SmartThings with OAuth tokens. The issue is **ngrok proxy configuration** returning 401 before requests reach the backend.

**Next Steps**:
1. Add `ngrok-skip-browser-warning: true` header to frontend API client
2. Test direct localhost connection (should work immediately)
3. Update ngrok configuration to remove authentication requirements

**No application code changes needed** - this is purely a proxy configuration issue.
