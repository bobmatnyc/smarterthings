# SmartApp OAuth2 Implementation Research
**Date:** 2025-11-30
**Purpose:** Replace 24-hour PAT tokens with OAuth2 authorization code flow

## Executive Summary

SmartThings changed their PAT token expiration policy in December 2024, reducing token lifetime from indefinite to **24 hours**. This makes PAT unsuitable for production use. SmartThings now recommends OAuth2 authorization code flow for continuous access.

## Current State vs. OAuth2

### Current Implementation (PAT)
- **Token Type:** Personal Access Token (PAT)
- **Lifetime:** 24 hours
- **Refresh:** Manual (user must generate new token daily)
- **Security:** Token stored in `.env.local`
- **User Experience:** Poor (daily manual refresh required)
- **Production Ready:** ❌ No

### Proposed Implementation (OAuth2)
- **Token Type:** OAuth2 Access Token + Refresh Token
- **Access Token Lifetime:** 24 hours
- **Refresh Token Lifetime:** Months/years (automatically renews)
- **Refresh:** Automatic (background process)
- **Security:** Tokens stored encrypted in database
- **User Experience:** Good (one-time authorization, auto-renewal)
- **Production Ready:** ✅ Yes

## OAuth2 Flow Details

### Endpoints

1. **Authorization Endpoint**
   ```
   GET https://api.smartthings.com/oauth/authorize
   ```
   **Parameters:**
   - `client_id`: SmartApp client ID (from CLI)
   - `response_type`: "code"
   - `redirect_uri`: Your callback URL (HTTPS required)
   - `scope`: Space-separated permissions (e.g., "r:devices:* x:devices:*")
   - `state`: CSRF protection token

2. **Token Endpoint**
   ```
   POST https://api.smartthings.com/oauth/token
   ```
   **Headers:**
   - `Authorization`: Basic Auth (Base64 of `client_id:client_secret`)
   - `Content-Type`: application/x-www-form-urlencoded

   **Body:**
   - `grant_type`: "authorization_code" (initial) or "refresh_token" (renewal)
   - `code`: Authorization code (initial only)
   - `redirect_uri`: Same as authorization request
   - `refresh_token`: Refresh token (renewal only)

### Authorization Code Flow

```
┌─────────┐                                           ┌─────────────┐
│  User   │                                           │ SmartThings │
└────┬────┘                                           └──────┬──────┘
     │                                                        │
     │  1. Click "Connect SmartThings"                      │
     │────────────────────────────────────────────────────> │
     │                                                        │
     │  2. Redirect to /oauth/authorize                     │
     │ <──────────────────────────────────────────────────  │
     │                                                        │
     │  3. User logs in & grants permissions                │
     │────────────────────────────────────────────────────> │
     │                                                        │
     │  4. Redirect to app with auth code                   │
     │ <──────────────────────────────────────────────────  │
     │   https://app.com/callback?code=ABC&state=XYZ        │
     │                                                        │
┌────┴────┐                                           ┌──────┴──────┐
│   App   │                                           │ SmartThings │
└────┬────┘                                           └──────┬──────┘
     │                                                        │
     │  5. POST /oauth/token (exchange code for tokens)     │
     │────────────────────────────────────────────────────> │
     │                                                        │
     │  6. Return access_token + refresh_token              │
     │ <──────────────────────────────────────────────────  │
     │   {                                                   │
     │     "access_token": "...",                            │
     │     "refresh_token": "...",                           │
     │     "expires_in": 86400,                              │
     │     "token_type": "bearer"                            │
     │   }                                                   │
     │                                                        │
     │  7. Store tokens (encrypted)                         │
     │  8. Use access_token for API calls                   │
     │                                                        │
     │  [24 hours later - access token expired]             │
     │                                                        │
     │  9. POST /oauth/token (refresh access token)         │
     │     grant_type=refresh_token                          │
     │────────────────────────────────────────────────────> │
     │                                                        │
     │  10. Return new access_token                          │
     │ <──────────────────────────────────────────────────  │
     │                                                        │
```

### Token Response Structure

```json
{
  "access_token": "3898897d-9fcd-4c7e-9f80-c2edfcb411dc",
  "token_type": "bearer",
  "refresh_token": "1234567890abcdef1234567890abcdef",
  "expires_in": 86400,
  "scope": "r:devices:* x:devices:*"
}
```

## Required Scopes

Based on current application functionality:

- `r:devices:*` - Read device information
- `x:devices:*` - Execute device commands
- `r:locations:*` - Read location information
- `r:rooms:*` - Read room information
- `r:scenes:*` - Read scenes (future)
- `x:scenes:*` - Execute scenes (future)

## Implementation Architecture

### Components to Build

1. **SmartApp Registration (Manual Setup)**
   - Use SmartThings CLI to create SmartApp
   - Obtain `client_id` and `client_secret`
   - Configure redirect URIs

2. **OAuth Service Layer** (`src/smartthings/oauth-service.ts`)
   - Generate authorization URL
   - Exchange authorization code for tokens
   - Refresh access tokens automatically
   - Handle token expiration

3. **Token Storage Layer** (`src/storage/token-storage.ts`)
   - Encrypt tokens at rest
   - Store in SQLite database
   - Retrieve tokens for API calls
   - Update tokens after refresh

4. **API Routes** (in `src/server-alexa.ts`)
   - `GET /auth/smartthings` - Initiate OAuth flow
   - `GET /auth/smartthings/callback` - Handle OAuth callback
   - `POST /auth/smartthings/disconnect` - Revoke tokens
   - `GET /auth/smartthings/status` - Check connection status

5. **Web UI Integration** (SvelteKit)
   - OAuth connection button
   - Connection status indicator
   - Disconnect button
   - Token expiration warnings

6. **Background Token Refresh**
   - Cron job or interval timer
   - Check token expiration (proactive refresh at 23 hours)
   - Automatic refresh before expiration
   - Retry logic for failed refreshes

7. **Migration Path**
   - Support both PAT and OAuth concurrently
   - Graceful fallback to PAT if OAuth fails
   - Migration UI to prompt users to upgrade

## Security Considerations

### Token Encryption
```typescript
// Use crypto module for encryption
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const encryptionKey = crypto.scryptSync(
  process.env.TOKEN_ENCRYPTION_KEY!,
  'salt',
  32
);

function encryptToken(token: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptToken(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    algorithm,
    encryptionKey,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Database Schema
```sql
CREATE TABLE oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL, -- For multi-user support
  access_token_encrypted TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  access_token_auth_tag TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  refresh_token_auth_tag TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Unix timestamp
  scope TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(user_id)
);

CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_tokens(user_id);
```

### Environment Variables
```bash
# SmartApp OAuth Credentials (from CLI)
SMARTTHINGS_CLIENT_ID=your-client-id
SMARTTHINGS_CLIENT_SECRET=your-client-secret

# Token Encryption
TOKEN_ENCRYPTION_KEY=generate-secure-random-key-here

# OAuth Configuration
OAUTH_REDIRECT_URI=https://your-app.com/auth/smartthings/callback
OAUTH_STATE_SECRET=generate-state-secret-here
```

## Implementation Phases

### Phase 1: Core OAuth Service (Days 1-2)
- [ ] Create OAuth service with authorization URL generation
- [ ] Implement token exchange endpoint
- [ ] Implement token refresh logic
- [ ] Add error handling and retry logic

### Phase 2: Token Storage (Day 2)
- [ ] Design database schema
- [ ] Implement encryption/decryption
- [ ] Create token storage service
- [ ] Add database migrations

### Phase 3: API Routes (Days 2-3)
- [ ] Add OAuth initiation route
- [ ] Add OAuth callback route
- [ ] Add disconnect route
- [ ] Add status check route

### Phase 4: Background Refresh (Day 3)
- [ ] Implement token expiration check
- [ ] Create automatic refresh scheduler
- [ ] Add retry logic for failed refreshes
- [ ] Implement expiration notifications

### Phase 5: Web UI Integration (Days 3-4)
- [ ] Create OAuth connection button
- [ ] Add connection status display
- [ ] Implement disconnect functionality
- [ ] Add token expiration warnings

### Phase 6: Testing (Day 4)
- [ ] End-to-end OAuth flow testing
- [ ] Token refresh testing
- [ ] Error scenario testing
- [ ] Security audit

### Phase 7: Documentation (Day 5)
- [ ] User setup guide
- [ ] Developer documentation
- [ ] Migration guide from PAT
- [ ] Troubleshooting guide

## Code Structure

```
src/
├── smartthings/
│   ├── oauth-service.ts          # OAuth flow implementation
│   ├── token-refresher.ts        # Background token refresh
│   └── client.ts                 # Modified to use OAuth tokens
├── storage/
│   ├── token-storage.ts          # Encrypted token storage
│   ├── database.ts               # SQLite setup
│   └── migrations/
│       └── 001_oauth_tokens.sql  # Token table schema
├── server-alexa.ts               # Add OAuth routes
└── config/
    └── environment.ts            # Add OAuth config vars

web/
└── src/
    ├── lib/
    │   ├── api/
    │   │   └── oauth.ts          # OAuth API client
    │   └── stores/
    │       └── authStore.svelte.ts # Auth state management
    └── routes/
        └── settings/
            └── +page.svelte      # OAuth connection UI
```

## Success Criteria

✅ **Functional Requirements:**
- User can authorize app via OAuth flow
- Tokens automatically refresh before expiration
- No daily manual token updates required
- Graceful error handling for failed authorization
- Support for multiple users (future)

✅ **Non-Functional Requirements:**
- Tokens encrypted at rest
- No plaintext tokens in logs
- HTTPS required for all OAuth operations
- CSRF protection with state parameter
- Token refresh happens proactively (23 hours, not at expiration)

✅ **User Experience:**
- One-time authorization (no daily interaction)
- Clear connection status indicators
- Easy disconnect/reconnect flow
- Helpful error messages

## Risks and Mitigations

### Risk 1: Token Refresh Failure
**Impact:** Users lose access until manual re-authorization
**Mitigation:**
- Implement retry logic (3 attempts with exponential backoff)
- Proactive refresh at 23 hours (not 24)
- User notifications when refresh fails
- Fallback to manual re-authorization

### Risk 2: Token Storage Compromise
**Impact:** Unauthorized access to user's SmartThings
**Mitigation:**
- AES-256-GCM encryption for all tokens
- Secure key management (env vars, not code)
- Rotate encryption keys periodically
- Audit log for token access

### Risk 3: Redirect URI Misconfiguration
**Impact:** OAuth flow breaks, users can't authorize
**Mitigation:**
- Clear documentation for setup
- Validation of redirect URI format
- Development mode with localhost support
- Production mode with HTTPS enforcement

### Risk 4: Scope Creep
**Impact:** Requesting too many permissions scares users
**Mitigation:**
- Start with minimal scopes (devices only)
- Add scopes incrementally as features added
- Clear explanation of why each scope needed
- Allow partial authorization (graceful degradation)

## Next Steps

1. **Manual Setup:** Register SmartApp with SmartThings CLI
2. **Implementation:** Follow phase plan (5 days)
3. **Testing:** Comprehensive OAuth flow testing
4. **Documentation:** User and developer guides
5. **Deployment:** Gradual rollout with PAT fallback

## References

- [SmartThings OAuth Integration Docs](https://developer.smartthings.com/docs/connected-services/oauth-integrations)
- [Authorization and Permissions](https://developer.smartthings.com/docs/getting-started/authorization-and-permissions)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [SmartThings CLI Tool](https://github.com/SmartThingsCommunity/smartthings-cli)

---

**Estimated Implementation Time:** 5 days
**Priority:** High (PAT tokens expire daily)
**Complexity:** Medium (standard OAuth 2.0 flow)
