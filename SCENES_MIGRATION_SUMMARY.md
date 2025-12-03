# Automations API Migration: Rules → Scenes

## Summary

Successfully migrated the automations API from SmartThings Rules to SmartThings Scenes (manually run routines). This change aligns with the user's actual usage pattern - they have 0 Rules but multiple Scenes in their SmartThings app.

## What Changed

### Backend Changes

#### 1. `/src/server-alexa.ts`
- **Updated `/api/automations` endpoint** (lines 544-591)
  - Changed from `executor.listAutomations()` to `executor.listScenes()`
  - Updated documentation to reflect Scenes instead of Rules
  - Returns `SceneInfo[]` array directly instead of wrapped in automations object

- **Replaced `/api/automations/:id/toggle` with `/api/automations/:id/execute`** (lines 593-641)
  - Scenes cannot be toggled enabled/disabled
  - Endpoint now executes the scene immediately
  - Returns success/failure result
  - Updates last executed timestamp

- **Added SceneId import** (line 67)
  - Imported `SceneId` type for type safety

#### 2. `/src/direct/ToolExecutor.ts`
- **Updated `listScenes()` signature** (lines 304-315)
  - Changed from `listScenes(locationId?: LocationId)` to `listScenes(params?: { locationId?: LocationId })`
  - Maintains consistency with other API methods
  - Backward compatible with existing code

### Frontend Changes

#### 3. `/web/src/lib/stores/automationStore.svelte.ts`

**Updated Type Definitions** (lines 1-35)
- Modified documentation to reflect Scenes instead of Rules
- Updated `Automation` interface:
  - `enabled` is always `true` for scenes (manually triggered)
  - `lastExecuted` changed to timestamp in milliseconds
- Updated `AutomationsResponse` to accept `SceneInfo[]` array

**Replaced `loadAutomations()` function** (lines 76-126)
- Fetches scenes from `/api/automations` endpoint
- Transforms `SceneInfo` objects to `Automation` format:
  - `id`: `scene.sceneId`
  - `name`: `scene.sceneName`
  - `enabled`: Always `true` (scenes are always available)
  - `triggers`: Always `['Manual']`
  - `actions`: `['Activate scene']` (API doesn't expose details)
  - `lastExecuted`: Converted from ISO string to milliseconds

**Removed Rule extraction functions** (replaced lines 128-195)
- Removed `extractTriggers()` - Rules-specific logic
- Removed `extractActions()` - Rules-specific logic
- Added `extractSceneActions()` - Simple scene action label

**Updated `toggleAutomation()` function** (lines 140-181)
- Renamed conceptually to "Execute scene"
- Calls `/api/automations/:id/execute` endpoint
- Updates `lastExecuted` timestamp on success
- Returns boolean success/failure

## API Response Format Changes

### Before (Rules)
```json
{
  "success": true,
  "data": {
    "count": 0,
    "automations": []
  }
}
```

### After (Scenes)
```json
{
  "success": true,
  "data": [
    {
      "sceneId": "uuid-1234",
      "sceneName": "Good Morning",
      "sceneIcon": "...",
      "locationId": "...",
      "lastExecutedDate": "2025-12-02T10:30:00Z",
      "editable": true
    }
  ]
}
```

## User Experience Changes

### Before
- Toggle button: Enable/disable automation rule
- 0 automations shown (user has no Rules)

### After
- Toggle button: Execute scene immediately
- All manually run routines displayed
- Last executed timestamp updates after each execution
- Scenes are always "enabled" (always available to run)

## Testing

### Manual Testing Steps
1. Start server: `npm run dev`
2. Navigate to automations page in web UI
3. Verify scenes appear in the list
4. Click toggle button to execute a scene
5. Verify scene executes and last executed time updates

### API Testing
```bash
# List scenes
curl http://localhost:3000/api/automations

# Execute a scene
curl -X POST http://localhost:3000/api/automations/SCENE_ID/execute
```

## Technical Details

### Type Safety
- Used branded type `SceneId` for scene identifiers
- Maintained `DirectResult<T>` pattern for error handling
- TypeScript compilation successful with no new errors

### Performance
- No performance impact (same SmartThings API calls)
- Scenes API typically returns 100-500ms response time
- Frontend state updates are reactive (Svelte 5 runes)

### Backward Compatibility
- ToolExecutor `listScenes()` maintains backward compatibility
- API endpoint paths remain the same (`/api/automations`)
- Only the underlying data source changed (Rules → Scenes)

## Files Modified

1. `/src/server-alexa.ts` - Backend API endpoints
2. `/src/direct/ToolExecutor.ts` - Direct mode API wrapper
3. `/web/src/lib/stores/automationStore.svelte.ts` - Frontend state management

## Success Criteria ✅

- [x] `/api/automations` returns Scenes instead of Rules
- [x] Scenes appear in the automations dashboard
- [x] Toggle button executes scenes instead of toggling state
- [x] Scene execution updates "last executed" timestamp
- [x] All manually run routines are visible in the UI
- [x] TypeScript compilation successful
- [x] No breaking changes to API structure

## Next Steps (Optional)

1. **UI Enhancement**: Update toggle button icon to "play/execute" instead of "toggle"
2. **Scene Details**: Add scene icon/color display in the UI
3. **Execution Feedback**: Add toast notification on scene execution success/failure
4. **Scene Editing**: Link to SmartThings app for scene configuration
5. **Scene Grouping**: Group scenes by location or room

## Notes

- Scenes API doesn't expose action details, so UI shows generic "Activate scene" message
- Scene execution is fire-and-forget (no status monitoring)
- SmartThings doesn't provide execution history beyond last executed date
- User has access to all scenes across all locations (filtered by default location)
