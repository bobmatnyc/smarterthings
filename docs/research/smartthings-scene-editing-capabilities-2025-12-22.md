# SmartThings Scene Editing Capabilities Research

**Research Date:** 2025-12-22
**Researcher:** Research Agent
**Purpose:** Determine what's needed to implement scene editing in Smarter Things app

---

## Executive Summary

**CRITICAL FINDING:** SmartThings API **DOES NOT support creating, updating, or deleting scenes** via API. The API only provides:
- Read (`r:scenes:*`) - List scenes
- Execute (`x:scenes:*`) - Run scenes

**Conclusion:** Scene editing **CANNOT be implemented** in the Smarter Things app because SmartThings does not expose scene write/modification endpoints.

**Alternative:** Users must create and edit scenes using the official SmartThings mobile app.

---

## Current State Analysis

### What the App Currently Supports

**Backend Implementation:**
- ✅ `GET /api/scenes` - List all scenes
- ✅ `POST /api/scenes/:id/execute` - Execute a scene by ID
- ✅ Scene service: `src/services/SceneService.ts`
- ✅ MCP tools: `src/mcp/tools/scenes.ts`
  - `list_scenes` - List all scenes (with optional room filter)
  - `list_scenes_by_room` - List scenes for specific room
  - `execute_scene` - Execute scene by ID or name

**Frontend Implementation:**
- ✅ Scene card component: `web/src/lib/components/scenes/SceneCard.svelte`
- ✅ Scenes store: `web/src/lib/stores/scenesStore.svelte.ts`
- ✅ Scene execution with loading states and toast notifications
- ✅ "Last executed" timestamp display

**OAuth Scopes (Current):**
```typescript
const REQUIRED_SCOPES = [
  'r:devices:*',   // Read devices
  'x:devices:*',   // Execute device commands
  'r:locations:*', // Read locations/rooms
  'r:scenes:*',    // READ scenes ✅
  'x:scenes:*',    // EXECUTE scenes ✅
];
```

---

## SmartThings API Capabilities

### Available Scene Endpoints

According to official SmartThings documentation and SDK:

**1. List Scenes**
- **Endpoint:** `GET https://api.smartthings.com/v1/scenes`
- **Scope:** `r:scenes:*`
- **Purpose:** Retrieve list of all scenes
- **SDK Method:** `client.scenes.list(options)`

**2. Get Scene Details**
- **Endpoint:** `GET https://api.smartthings.com/v1/scenes/{sceneId}`
- **Scope:** `r:scenes:*`
- **Purpose:** Get specific scene details
- **SDK Method:** `client.scenes.get(sceneId)`

**3. Execute Scene**
- **Endpoint:** `POST https://api.smartthings.com/v1/scenes/{sceneId}/execute`
- **Scope:** `x:scenes:*`
- **Purpose:** Execute scene actions
- **SDK Method:** `client.scenes.execute(sceneId)`

### Missing Endpoints (NOT AVAILABLE)

**Scene Modification Operations:**
- ❌ `POST /v1/scenes` - Create scene (DOES NOT EXIST)
- ❌ `PUT /v1/scenes/{sceneId}` - Update scene (DOES NOT EXIST)
- ❌ `DELETE /v1/scenes/{sceneId}` - Delete scene (DOES NOT EXIST)
- ❌ `w:scenes:*` scope - Write/modify scenes (DOES NOT EXIST)

### Verification from Multiple Sources

**1. SmartThings Developer Documentation**
> "Currently the SmartThings Scenes endpoint does not support creating or updating Scenes."
> Source: [SmartThings Scenes API](https://developer.smartthings.com/docs/automations/scenes)

**2. SmartThings SDK Wiki**
> SDK provides three scene operations: list, get, execute
> No mention of create, update, or delete functionality
> Source: [SmartThings Core SDK - Scenes](https://github.com/SmartThingsCommunity/smartthings-core-sdk/wiki/Scenes)

**3. Available OAuth Scopes**
Personal access tokens for scenes only support:
- `r:scenes:*` - Read all scenes
- `x:scenes:*` - Execute all scenes

**NO `w:scenes:*` scope exists** for writing/modifying scenes.

**4. SDK Type Definitions**
Checked SmartThings SDK source code - no methods found for:
- `scenes.create()`
- `scenes.update()`
- `scenes.delete()`
- `scenes.modify()`

---

## Scene Data Structure

### What a Scene Contains

Based on existing code inspection:

```typescript
interface SceneInfo {
  sceneId: string;           // UUID
  sceneName: string;         // Display name
  sceneIcon?: string;        // Icon identifier
  sceneColor?: string;       // Color hex code
  locationId?: string;       // Parent location UUID
  lastExecutedDate?: string; // ISO timestamp
}
```

### What Scene Actions Could Include (Theoretical)

If scene editing were available, actions would likely include:
- Device state changes (switch on/off, brightness, color)
- Multiple devices simultaneously
- Device capability commands

However, this is **speculation** since the API doesn't expose scene modification.

---

## Alternative Approaches Considered

### 1. Reverse Engineering SmartApp API ❌
**Approach:** Analyze SmartThings mobile app API calls
**Result:** Not feasible
**Reason:** Would require:
- Man-in-the-middle interception of encrypted traffic
- Proprietary authentication tokens
- Violates SmartThings Terms of Service
- Unreliable (subject to breaking changes)

### 2. SmartApp Configuration ❌
**Approach:** Use SmartApp CONFIGURATION lifecycle events
**Result:** Not applicable
**Reason:** Configuration events are for app settings, not scene creation

### 3. Webhook-Based Scene Creation ❌
**Approach:** Trigger scene creation via webhook
**Result:** No public API endpoint exists
**Reason:** SmartThings doesn't expose scene creation webhooks

### 4. Rule-Based Workaround ❌
**Approach:** Create rules that simulate scenes
**Result:** Not equivalent to scenes
**Reason:**
- Rules have triggers (scenes don't)
- Different data model
- Rules API also has limited write capabilities

### 5. Batch Operations API ❌
**Approach:** Use batch API for scene management
**Result:** Not available for scenes
**Reason:** Batch API only supports Rules and Scenes execution, not creation

---

## Implementation Requirements (If API Existed)

**This section documents what WOULD be needed if SmartThings added scene editing support in the future.**

### Required OAuth Scopes (Hypothetical)
```typescript
const SCENE_WRITE_SCOPES = [
  'w:scenes:*', // Write/create/update/delete scenes (DOES NOT EXIST)
];
```

### Backend API Endpoints (Not Implementable)
```typescript
// These endpoints CANNOT be implemented because SmartThings API doesn't support them

POST   /api/scenes              // Create new scene
PUT    /api/scenes/:id          // Update scene
DELETE /api/scenes/:id          // Delete scene
GET    /api/scenes/:id/actions  // Get scene action details
PUT    /api/scenes/:id/actions  // Update scene actions
```

### Frontend Components (Not Implementable)
- Scene creation form
- Scene action editor
- Device selection for scene
- Scene deletion confirmation
- Scene duplication

### Data Validation (Theoretical)
- Scene name uniqueness
- Valid device IDs
- Valid capability commands
- Action state validation

---

## User Workflow (Current Limitation)

**Current User Experience:**

```
User wants to create/edit a scene:
  ├─ Option 1: Use SmartThings mobile app ✅ (ONLY OPTION)
  │   └─ Automations → Scenes → Create/Edit
  │
  └─ Option 2: Use Smarter Things app ❌ (NOT POSSIBLE)
      └─ Blocked: API doesn't support scene modification
```

**Recommended User Workflow:**

1. **Create/Edit Scenes:** Use SmartThings mobile app
2. **Execute Scenes:** Use Smarter Things app (supported)
3. **View Scenes:** Use Smarter Things app (supported)

---

## Complexity Estimate

### If Scene Editing Were Available (Hypothetical)

**Backend Complexity:** Medium (3-5 days)
- API route implementation (create/update/delete)
- Scene action validation
- Error handling for invalid devices/capabilities
- Transaction safety (atomic updates)

**Frontend Complexity:** High (7-10 days)
- Scene creation form with device picker
- Action editor with capability selection
- Real-time validation
- UX polish (drag-drop, reordering)
- Responsive design
- Accessibility compliance

**Testing Complexity:** Medium (3-4 days)
- Unit tests for scene validation
- Integration tests for API endpoints
- E2E tests for scene editing workflow
- Edge case testing

**Total Estimate:** 13-19 days of development

**ACTUAL COMPLEXITY:** ∞ (Impossible - API doesn't exist)

---

## Recommendations

### Immediate Actions

**1. Document Limitation ✅**
- Add note to README about scene editing limitation
- Update user documentation
- Add FAQ entry: "Why can't I create scenes in the app?"

**2. Improve Scene Discovery 🟡**
- Enhance scene search/filtering
- Add scene categories/tags (if available in API)
- Improve scene execution UX

**3. Add Scene Details View 🟢**
- Show scene actions (devices affected)
- Display last execution history
- Show scene metadata (icon, color, location)

### Future Monitoring

**1. Track SmartThings API Changes**
- Monitor SmartThings developer changelogs
- Watch for `w:scenes:*` scope introduction
- Subscribe to SmartThings API release notes

**2. Community Engagement**
- Request feature via SmartThings developer forums
- Gauge interest from other developers
- Document use cases for scene editing API

### Alternative Features to Build

Since scene editing is blocked, consider these enhancements:

**1. Scene Templates 🟢**
- Pre-configured scene suggestions
- "Quick execute" for common scenes
- Scene execution scheduling (via rules)

**2. Scene Analytics 📊**
- Track scene usage frequency
- Identify most-used scenes
- Optimize scene execution times

**3. Multi-Scene Execution 🔄**
- Execute multiple scenes sequentially
- Create scene "playlists"
- Conditional scene execution

**4. Scene Favorites ⭐**
- Pin frequently-used scenes
- Custom scene grouping
- Quick access shortcuts

---

## Verification Checklist

- [x] Checked SmartThings API documentation
- [x] Verified SmartThings SDK methods
- [x] Searched for `w:scenes:*` scope
- [x] Inspected existing codebase
- [x] Reviewed OAuth scope requirements
- [x] Confirmed with multiple authoritative sources
- [x] Explored alternative approaches
- [x] Documented current implementation
- [x] Provided recommendations

---

## References

**Official Documentation:**
- [SmartThings Scenes API](https://developer.smartthings.com/docs/automations/scenes)
- [SmartThings Public API](https://developer.smartthings.com/docs/api/public)
- [SmartThings Core SDK](https://github.com/SmartThingsCommunity/smartthings-core-sdk)
- [SmartThings SDK - Scenes Wiki](https://github.com/SmartThingsCommunity/smartthings-core-sdk/wiki/Scenes)

**Related Tickets:**
- 1M-546: Automations list view (implemented)
- 1M-547: Automation detail view (implemented)
- 1M-538: Rules management (implemented)

**Code References:**
- `src/services/SceneService.ts` - Scene service implementation
- `src/mcp/tools/scenes.ts` - MCP scene tools
- `src/smartthings/client.ts` - SmartThings API client
- `web/src/lib/components/scenes/SceneCard.svelte` - Scene UI component
- `src/smartthings/oauth-service.ts` - OAuth scope definitions (lines 325-338)

---

## Conclusion

**Scene editing CANNOT be implemented** in the Smarter Things app due to SmartThings API limitations.

**Current Capabilities:**
- ✅ List scenes
- ✅ Execute scenes
- ✅ View scene details (name, icon, last executed)

**Not Possible:**
- ❌ Create scenes
- ❌ Edit scene actions
- ❌ Delete scenes
- ❌ Duplicate scenes
- ❌ Modify scene settings

**Recommended Path Forward:**
1. Accept limitation and document clearly
2. Focus on enhancing scene discovery and execution UX
3. Build complementary features (favorites, analytics)
4. Monitor SmartThings API for future scene write support

**Alternative for Users:**
Users must continue using the SmartThings mobile app for scene creation and editing. This is a platform limitation, not an app design choice.

---

**Research Status:** Complete ✅
**API Limitation:** Confirmed ✅
**Action Required:** Document limitation and focus on supported features ✅
