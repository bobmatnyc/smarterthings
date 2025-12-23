# OAuth Express Routes Implementation

**Date**: 2025-12-23
**Task**: Add OAuth routes to Express HTTP transport
**Files Modified**: `src/transport/http.ts`

## Summary

Added OAuth routes to the Express HTTP transport (port 5182) to enable OAuth authentication flow without requiring proxy through Fastify server (port 3000).

## Changes Made

### 1. Added Dependencies

Added imports for OAuth functionality:
- `SmartThingsOAuthService` and `DEFAULT_SCOPES` from `../smartthings/oauth-service.js`
- `reinitializeSmartThingsAdapter` from `../server-alexa.js`
- `TokenStorage` from `../storage/token-storage.js`
- `TokenRefresher` from `../smartthings/token-refresher.js`
- `z` from `zod` for input validation

### 2. OAuth State Management

Implemented CSRF protection with in-memory state storage:
- `oauthStates` Map to track pending OAuth flows
- `cleanupExpiredStates()` function to remove expired states (24-hour TTL)
- Automatic cleanup every 60 seconds

### 3. Service Singletons

Created singleton instances for OAuth services:
- `getOAuthService()` - Lazy initialization of OAuth service
- `getOAuthTokenStorage()` - Lazy initialization of token storage
- `getTokenRefresher()` - Lazy initialization of token refresher with auto-start

### 4. Input Validation Schema

Added Zod schema for OAuth callback validation (CVE-2024-OAUTH-003 fix):
- `code`: Authorization code (alphanumeric, dash, underscore; 1-500 chars)
- `state`: CSRF state token (64 hex characters exactly)
- `error`: Optional error code (max 100 chars, no HTML)
- `error_description`: Optional error description (max 500 chars, no HTML)

### 5. OAuth Routes

#### GET `/auth/smartthings`
Initiates OAuth authorization flow:
1. Generates authorization URL with CSRF state token
2. Stores state token for validation
3. Redirects user to SmartThings authorization page

#### GET `/auth/smartthings/callback`
Handles OAuth callback after user authorization:
1. Validates callback parameters (CVE-2024-OAUTH-003 fix)
2. Validates CSRF state token
3. Exchanges authorization code for access/refresh tokens
4. Stores encrypted tokens in database
5. Starts background token refresh
6. Reinitializes SmartThings adapter
7. Redirects to frontend callback page

#### POST `/auth/smartthings/disconnect`
Disconnects SmartThings account:
1. Retrieves tokens from storage
2. Revokes tokens on SmartThings (best effort)
3. Deletes tokens from local database
4. Returns success response

**Security Note**: Token revocation is best-effort. If SmartThings API is unreachable, tokens are still deleted locally but may remain valid on SmartThings side until natural expiration (up to 24 hours).

#### GET `/auth/smartthings/status`
Checks OAuth connection status:
- Returns connection status (connected/disconnected)
- If connected, returns token expiration time and scopes
- Checks if token needs refresh (1-hour buffer)

## Technical Decisions

### Express vs Fastify Compatibility

The implementation mirrors the existing Fastify routes in `src/routes/oauth.ts` but uses Express-compatible patterns:
- `res.redirect(url)` instead of `reply.redirect(url)`
- `res.json({})` instead of returning objects
- `res.status(500).json({})` instead of `reply.code(500).send({})`
- Standard Express middleware patterns

### Synchronous Token Storage

All TokenStorage methods (`storeTokens`, `getTokens`, `deleteTokens`, `hasTokens`) are synchronous:
- Removed unnecessary `await` calls to fix linting errors
- Direct method calls without promises

### Security Features

1. **CSRF Protection**: State tokens validated on callback
2. **Input Validation**: Zod schemas prevent XSS and injection attacks
3. **Token Encryption**: Tokens encrypted at rest via TokenStorage
4. **Token Revocation**: Tokens revoked on SmartThings before local deletion

### Error Handling

All routes include comprehensive error handling:
- Validation errors redirect to frontend with error params
- Service errors return 500 with error details
- Token revocation errors logged but don't fail disconnect

## Environment Variables Required

The following environment variables must be set:
- `SMARTTHINGS_CLIENT_ID` - SmartThings OAuth client ID
- `SMARTTHINGS_CLIENT_SECRET` - SmartThings OAuth client secret
- `OAUTH_REDIRECT_URI` - OAuth callback URL (typically `http://localhost:5182/auth/smartthings/callback`)
- `OAUTH_STATE_SECRET` - Secret for generating CSRF state tokens
- `FRONTEND_URL` - Frontend URL for redirects (typically `http://localhost:5181`)

## Testing

To test the OAuth routes:

1. Start the server: `npm run dev`
2. Navigate to `http://localhost:5182/auth/smartthings`
3. Complete OAuth flow on SmartThings
4. Verify redirect to frontend callback page
5. Check `/auth/smartthings/status` for connection status

## Related Files

- `src/routes/oauth.ts` - Original Fastify implementation
- `src/smartthings/oauth-service.ts` - OAuth service logic
- `src/storage/token-storage.ts` - Token encryption and storage
- `src/smartthings/token-refresher.ts` - Background token refresh

## LOC Delta

```
LOC Delta:
- Added: ~310 lines (OAuth routes and supporting functions)
- Removed: 0 lines
- Net Change: +310 lines
- Phase: Enhancement
```

## Future Improvements

1. **Redis State Storage**: Replace in-memory state storage with Redis for multi-server deployments
2. **Rate Limiting**: Add rate limiting to prevent OAuth flow abuse
3. **Session Management**: Integrate with session store for better state management
4. **Metrics**: Add metrics tracking for OAuth flow success/failure rates
