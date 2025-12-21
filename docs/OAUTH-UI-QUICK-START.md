# OAuth UI - Quick Start Guide

**For Developers**: Get the OAuth authentication UI running in 2 minutes.

## Prerequisites

- Backend server running on port 5182
- Frontend dev server running on port 5181
- SmartThings OAuth credentials configured (see `docs/SMARTAPP_SETUP.md`)

## Quick Start

### 1. Start Backend

```bash
# Terminal 1: Backend server
pnpm dev
```

**Expected**: Server running on `http://localhost:5182`

### 2. Start Frontend

```bash
# Terminal 2: Frontend dev server
pnpm dev:web
```

**Expected**: Dev server on `http://localhost:5181`

### 3. Test Unauthenticated State

```bash
# Clear any existing authentication
rm .env.local  # or comment out SMARTTHINGS_TOKEN

# Restart backend
pnpm dev
```

**Steps**:
1. Open `http://localhost:5181`
2. See "Connect to SmartThings" UI
3. Click "Connect SmartThings Account"
4. Follow OAuth flow

### 4. Test Authenticated State

**After completing OAuth**:
1. Homepage shows success banner
2. Rooms grid loads normally
3. Success banner auto-dismisses after 5 seconds

## Component Locations

**New Files**:
- `web/src/lib/components/auth/OAuthConnect.svelte` - OAuth connection UI
- `web/src/routes/auth/callback/+page.svelte` - OAuth callback page

**Modified Files**:
- `web/src/routes/+page.svelte` - Homepage with auth detection

## Testing Scenarios

### Scenario 1: First-Time User (No Auth)

```bash
# Ensure no auth token
rm .env.local
pnpm dev

# In browser
open http://localhost:5181
```

**Expected**:
- Brief loading spinner
- OAuthConnect component appears
- "Connect SmartThings Account" button visible

### Scenario 2: Existing User (Already Authed)

```bash
# Ensure auth token exists
# .env.local should have SMARTTHINGS_TOKEN
pnpm dev

# In browser
open http://localhost:5181
```

**Expected**:
- Brief loading spinner
- Rooms grid appears immediately
- No OAuth UI shown

### Scenario 3: Backend Offline

```bash
# Stop backend server
# Keep frontend running

# In browser
open http://localhost:5181
```

**Expected**:
- Loading spinner for ~2 seconds
- Error card appears
- "Connection Failed" message
- "Try Again" button

### Scenario 4: OAuth Success Flow

```bash
# Start both servers
pnpm dev          # Terminal 1
pnpm dev:web      # Terminal 2

# In browser (unauthenticated state)
1. Click "Connect SmartThings Account"
2. Authorize on SmartThings
3. Redirected to /auth/callback
4. Success message with countdown
5. Auto-redirect to homepage
6. Success banner appears at top
7. Rooms grid loads
```

## Environment Variables

### Frontend (.env in web/)

```bash
# Backend API URL (default: http://localhost:5182)
VITE_API_URL=http://localhost:5182
```

### Backend (.env.local in root)

```bash
# SmartThings OAuth (see docs/SMARTAPP_SETUP.md)
SMARTTHINGS_CLIENT_ID=your_client_id
SMARTTHINGS_CLIENT_SECRET=your_client_secret
SMARTTHINGS_REDIRECT_URI=http://localhost:5182/auth/smartthings/callback

# Personal Access Token (alternative to OAuth)
SMARTTHINGS_TOKEN=your_pat_token
```

## Common Issues

### Issue: Backend returns 404 on /health

**Cause**: Old backend code, health endpoint not implemented

**Fix**: Update backend to latest version with health endpoint

**Verify**:
```bash
curl http://localhost:5182/health
```

**Expected**:
```json
{
  "status": "healthy",
  "smartthings": {
    "initialized": true
  }
}
```

### Issue: OAuthConnect shows but auth is configured

**Cause**: Backend not detecting SmartThings token

**Fix**: Check `.env.local` for `SMARTTHINGS_TOKEN` or OAuth credentials

**Verify**:
```bash
grep SMARTTHINGS .env.local
```

### Issue: Infinite loading spinner

**Cause**: Frontend can't reach backend

**Fix**: Ensure backend is running on port 5182

**Verify**:
```bash
lsof -i :5182
curl http://localhost:5182/health
```

### Issue: OAuth redirects to wrong URL

**Cause**: `SMARTTHINGS_REDIRECT_URI` mismatch

**Fix**: Ensure redirect URI matches SmartThings SmartApp config

**Expected**:
```
http://localhost:5182/auth/smartthings/callback
```

## Development Tips

### Hot Reload

Both servers support hot reload:
- **Backend**: TypeScript changes reload automatically
- **Frontend**: Svelte changes update instantly

### Console Debugging

Open browser DevTools (F12):
```javascript
// Check auth state
console.log(authState)

// Manual auth check
checkAuth()

// Backend health
fetch('http://localhost:5182/health')
  .then(r => r.json())
  .then(console.log)
```

### Component Inspection

Use Svelte DevTools browser extension:
1. Install Svelte DevTools
2. Open DevTools → Svelte tab
3. Inspect component state

### Backend Logs

Check backend logs for OAuth flow:
```bash
# Follow logs
tail -f logs/combined.log

# Search for OAuth events
grep "OAuth" logs/combined.log
grep "SmartThings" logs/combined.log
```

## Testing Checklist

Quick checklist before committing changes:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Unauthenticated state shows OAuthConnect
- [ ] OAuth flow completes successfully
- [ ] Success banner appears and dismisses
- [ ] Authenticated state shows RoomsGrid
- [ ] Backend offline shows error card
- [ ] No console errors in browser
- [ ] Mobile responsive (test 375px width)
- [ ] Keyboard navigation works (Tab through elements)

## Next Steps

### Full Testing

See comprehensive testing guide:
```bash
open docs/qa/OAUTH-AUTHENTICATION-UI-TESTING.md
```

**15 detailed test cases** covering:
- All authentication states
- Error handling
- Mobile responsive
- Accessibility
- Browser compatibility

### Implementation Details

See full implementation documentation:
```bash
open docs/implementation/OAUTH-AUTHENTICATION-UI-IMPLEMENTATION.md
```

**Includes**:
- Architecture diagrams
- Design decisions
- Code walkthrough
- Performance metrics
- Future enhancements

## Support

**Questions?**
- Check existing documentation in `docs/`
- Review SmartThings API docs: https://developer.smartthings.com/docs/api/public
- Open GitHub issue with detailed description

---

**Made for developers, by developers** ❤️
