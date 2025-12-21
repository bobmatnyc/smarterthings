# Scene Execution Testing Guide

## ✅ Implementation Status

Scene execution is **fully implemented** and ready for testing!

## Architecture Overview

```
User clicks toggle
    ↓
Frontend: toggleAutomation(sceneId)
    ↓
POST /api/automations/{sceneId}/execute
    ↓
ToolExecutor.executeScene(sceneId)
    ↓
SmartThingsService.executeScene(sceneId)
    ↓
SmartThings API: scenes.execute(sceneId)
    ↓
Scene runs on SmartThings devices
```

## Manual Testing

### 1. Start the Server

```bash
pnpm run dev:server
```

Server should start on `http://localhost:3000` (or configured port)

### 2. List Available Scenes

```bash
curl http://localhost:3000/api/automations
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "sceneId": "abc-123-def-456",
      "sceneName": "Good Night",
      "sceneIcon": "...",
      "lastExecutedDate": "2025-12-02T..."
    },
    ...
  ]
}
```

### 3. Execute a Scene

Replace `SCENE_ID` with an actual sceneId from step 2:

```bash
curl -X POST http://localhost:3000/api/automations/SCENE_ID/execute
```

**Expected Response (Success):**
```json
{
  "success": true,
  "data": null
}
```

**Expected Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "SCENE_EXECUTE_ERROR",
    "message": "Scene not found"
  }
}
```

### 4. Verify in SmartThings App

After executing a scene via API:
1. Open SmartThings mobile app
2. Go to **Automations** tab
3. Check **Routines** → **Manually run**
4. Verify the scene's "Last executed" timestamp updated

### 5. Test from Dashboard

1. Navigate to `http://localhost:5173` (Vite dev server)
2. Click **Automations** tab
3. Find a scene/routine in the list
4. Click the **toggle button**
5. Observe:
   - Toggle button shows loading state (briefly)
   - "Last executed" timestamp updates
   - Scene executes on SmartThings devices

## Expected Behavior

### Success Case
- ✅ HTTP 200 response
- ✅ `{ "success": true, "data": null }`
- ✅ Scene executes in SmartThings
- ✅ Frontend updates "Last executed" timestamp
- ✅ No errors in console/logs

### Error Cases

**Scene Not Found:**
```json
{
  "success": false,
  "error": {
    "code": "SCENE_EXECUTE_ERROR",
    "message": "Scene abc-123 not found"
  }
}
```

**SmartThings API Error:**
```json
{
  "success": false,
  "error": {
    "code": "SCENE_EXECUTE_ERROR",
    "message": "SmartThings API error: [details]"
  }
}
```

## Logging

Watch server logs for execution flow:

```bash
# Server logs should show:
[INFO] Executing scene { sceneId: 'abc-123' }
[DEBUG] Executing scene { sceneId: 'abc-123' }  # SmartThingsService
[INFO] Scene executed successfully { sceneId: 'abc-123' }
[INFO] Scene executed successfully { sceneId: 'abc-123', duration: 250 }
```

## Known Limitations

1. **Scenes cannot be enabled/disabled** - they're always manually triggered
   - SmartThings API doesn't support toggling scene state
   - The "enabled" field in frontend is always `true`

2. **Action details not exposed** - SmartThings API doesn't provide action details
   - Frontend shows generic "Activate scene" for actions
   - Full action details only visible in SmartThings app

3. **No execution history** - only last executed timestamp
   - SmartThings API provides `lastExecutedDate` field
   - No detailed execution history available

## Troubleshooting

### Scene execution fails immediately

**Check:**
- Is the sceneId valid? (Run step 2 to list scenes)
- Is `SMARTTHINGS_PAT` environment variable set correctly?
- Does the PAT have `x:devices:*` and `r:scenes:*` scopes?

### Scene executes but devices don't respond

**Check:**
- Scene configuration in SmartThings app
- Device online status
- SmartThings hub connectivity
- Device battery levels (if battery-powered)

### "Scene not found" error

**Check:**
- Scene exists in SmartThings app
- Scene is in the default location
- PAT has access to the scene's location

## Files Changed

### Backend
- ✅ `src/direct/ToolExecutor.ts` - executeScene() method (lines 299-302)
- ✅ `src/server-alexa.ts` - POST /api/automations/:id/execute (lines 601-641)
- ✅ `src/smartthings/client.ts` - SmartThingsService.executeScene() (lines 442-450)

### Frontend
- ✅ `web/src/lib/stores/automationStore.svelte.ts` - toggleAutomation() (lines 153-188)

## API Documentation

### POST /api/automations/:id/execute

Execute a scene (manually run routine).

**Parameters:**
- `id` (path) - Scene UUID (sceneId)

**Request:**
```http
POST /api/automations/abc-123-def-456/execute
Content-Type: application/json
```

**Response (Success):**
```json
{
  "success": true,
  "data": null
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "SCENE_EXECUTE_ERROR",
    "message": "Error details"
  }
}
```

**Status Codes:**
- `200` - Scene executed successfully
- `500` - Execution failed (see error.message)

## Performance

**Expected latency:**
- API call: 100-500ms
- SmartThings scene execution: 500-2000ms (depends on scene complexity)
- Total end-to-end: 600-2500ms

**Retry logic:**
- Automatic retry on network errors (exponential backoff)
- No retry on invalid sceneId (immediate failure)

## Next Steps

After testing scene execution:

1. ✅ Verify all 19 scenes execute correctly
2. ✅ Test error handling (invalid sceneId)
3. ✅ Verify "Last executed" timestamp updates
4. ✅ Test from both API and dashboard UI
5. ✅ Monitor SmartThings app for execution confirmation

## Success Criteria

- [x] Backend implementation complete
- [x] Frontend integration complete
- [x] Error handling implemented
- [x] Logging comprehensive
- [ ] Manual testing passed
- [ ] Scenes execute in SmartThings
- [ ] Dashboard UI updates correctly
- [ ] No errors in production logs
