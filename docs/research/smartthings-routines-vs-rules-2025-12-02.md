# SmartThings Routines vs Rules: API Research

**Research Date:** 2025-12-02
**Context:** User reports "many Automations on the app -- they're called Routines" are not visible via current Rules API implementation
**Objective:** Understand SmartThings terminology differences and identify correct API for fetching user-created Routines

---

## Executive Summary

**Critical Finding:** SmartThings uses confusing terminology where "Routines" in the mobile app actually refers to TWO different backend systems:

1. **"Manually run routines"** = Scenes API ✅ (API-accessible)
2. **"Automatic routines"** = Rules API ⚠️ (partially API-accessible)

**The Problem:** App-created "Automatic routines" (what users call "Routines") are **NOT accessible** via the Rules API. They are a "superset" of Rules API functionality and exist only in the app.

**The Solution:** Use the **Scenes API** to fetch user's "Manually run routines" (which appear as "Routines" in the app). Our current implementation already supports this via `client.scenes.list()`.

---

## Terminology Breakdown

### In the SmartThings Mobile App

Users see a single "Routines" tab containing:
- **Manually run routines** (tap to execute)
- **Automatic routines** (trigger-based automation)

### In the SmartThings API

These map to completely different endpoints:

| App Term | API Term | Endpoint | SDK Method | Accessible? |
|----------|----------|----------|------------|-------------|
| Manually run routine | **Scene** | `/v1/scenes` | `client.scenes.*` | ✅ YES |
| Automatic routine | **Rule** | `/v1/rules` | `client.rules.*` | ⚠️ PARTIAL |

---

## Deep Dive: What Are Scenes?

### Definition
> "Scenes simultaneously set a group of devices to a particular state and do not have triggers."
> — SmartThings Developer Documentation

### Key Characteristics
- **No triggers:** Activated manually (tap in app or API call)
- **Immediate execution:** All device commands execute at once
- **State snapshots:** Sets multiple devices to specific states
- **API-accessible:** Fully supported via Scenes API

### Example Use Case
"Turn on living room light, turn off bedroom light, set thermostat to 72°F"

### Mobile App Representation
Displayed as **"Manually run routines"** in the Routines tab

---

## Deep Dive: What Are Rules?

### Definition
> "Rules use the Rules API to automate control of devices and Connected Services, allowing you to define one or more actions that will occur when certain conditions are met."
> — SmartThings Developer Documentation

### Key Characteristics
- **Trigger-based:** If/then logic with conditions
- **Complex logic:** Supports `and`, `or`, `not`, time-based triggers
- **Automatic execution:** Runs when conditions are met
- **API-accessible:** YES, but with critical limitation ⚠️

### Critical Limitation
> "Automatic routines ('rules') created in the SmartThings app are a **superset** of what you can create with the Rules API, and routines created in the app **will not appear** when sending a GET request to the Rules API endpoint."
> — SmartThings Developer Documentation

This means:
- ✅ Rules created via API → visible via API
- ❌ Routines created via app → **NOT visible via API**
- ❌ Cannot fetch user's app-created "Automatic routines"

### Mobile App Representation
Displayed as **"Automatic routines"** in the Routines tab

---

## Current Implementation Analysis

### What We Currently Fetch

**File:** `/src/smartthings/client.ts`

```typescript
async listScenes(locationId?: LocationId): Promise<SceneInfo[]> {
  logger.debug('Fetching scene list', { locationId });

  const options = locationId ? { locationId: [locationId] } : undefined;

  const scenes = await retryWithBackoff(async () => {
    return await this.client.scenes.list(options);
  });

  const sceneInfos: SceneInfo[] = scenes.map((scene) => ({
    sceneId: scene.sceneId as SceneId,
    sceneName: scene.sceneName ?? 'Unnamed Scene',
    sceneIcon: scene.sceneIcon,
    sceneColor: scene.sceneColor,
    locationId: scene.locationId as LocationId | undefined,
    createdBy: scene.createdBy,
    createdDate: scene.createdDate,
    lastUpdatedDate: scene.lastUpdatedDate,
    lastExecutedDate: scene.lastExecutedDate,
    editable: scene.editable,
  }));

  logger.info('Scenes retrieved', { count: sceneInfos.length, locationFilter: !!locationId });
  return sceneInfos;
}
```

✅ **This is correct!** We're already fetching Scenes (app's "Manually run routines")

### What We Also Fetch

**File:** `/src/services/AutomationService.ts`

```typescript
async listRules(locationId: LocationId): Promise<Rule[]> {
  // Fetch from API
  logger.debug('Fetching rules from API', { locationId });
  const startTime = Date.now();

  const rules = await this.adapter.listRules(locationId as string);

  const elapsed = Date.now() - startTime;
  logger.info('Rules fetched from API', {
    locationId,
    ruleCount: rules.length,
    elapsedMs: elapsed,
  });

  return rules;
}
```

⚠️ **Partial coverage:** This fetches API-created Rules, but **NOT** app-created "Automatic routines"

---

## SmartThings Core SDK Analysis

### Version
`@smartthings/core-sdk`: `^8.0.0` (package.json line 79)

### Available Endpoints

#### Scenes Endpoint
**File:** `node_modules/@smartthings/core-sdk/dist/endpoint/scenes.d.ts`

```typescript
export interface SceneSummary {
  sceneId?: string;
  sceneName?: string;
  sceneIcon?: string;
  sceneColor?: string;
  locationId?: string;
  createdBy?: string;
  createdDate?: Date;
  lastUpdatedDate?: Date;
  lastExecutedDate?: Date;
  editable?: boolean;
  apiVersion?: string;
}

export interface SceneListOptions {
  locationId?: string[];
  max?: number;
  page?: number;
}

export class ScenesEndpoint extends Endpoint {
  // Returns list of scenes (app's "Manually run routines")
  list(options?: SceneListOptions): Promise<SceneSummary[]>;

  // Get specific scene details
  get(id: string): Promise<SceneSummary>;

  // Execute a scene
  execute(id: string): Promise<Status>;
}
```

#### Rules Endpoint
**File:** `node_modules/@smartthings/core-sdk/dist/endpoint/rules.d.ts`

```typescript
export interface Rule extends RuleRequest {
  id: string;
  name: string;
  actions: RuleAction[];
  ownerType: RuleOwnerType;
  ownerId: string;
  dateCreated: string;
  dateUpdated: string;
  status?: RuleStatus;
  executionLocation?: RuleExecutionLocation;
  creator?: RuleCreator;
}

export class RulesEndpoint extends Endpoint {
  // List rules (API-created only, NOT app-created "Automatic routines")
  list(locationId?: string): Promise<Rule[]>;

  // Get specific rule
  get(id: string, locationId?: string): Promise<Rule>;

  // Create rule
  create(data: RuleRequest, locationId?: string): Promise<Rule>;

  // Update rule
  update(id: string, data: RuleRequest, locationId?: string): Promise<Rule>;

  // Delete rule
  delete(id: string, locationId?: string): Promise<Rule>;

  // Execute rule
  execute(id: string, locationId?: string): Promise<RuleExecutionResponse>;
}
```

### Client Access

```typescript
import { SmartThingsClient } from '@smartthings/core-sdk';

const client = new SmartThingsClient(new BearerTokenAuthenticator(token));

// Fetch Scenes (app's "Manually run routines")
const scenes = await client.scenes.list();

// Fetch Rules (API-created automations only)
const rules = await client.rules.list(locationId);
```

---

## Authentication Requirements

### Personal Access Token Scopes

To access Scenes API:
- ✅ `Scenes > Read all scenes`
- ✅ `Scenes > Execute all scenes`

To access Rules API:
- ✅ `Rules > List all rules`
- ✅ `Rules > Execute all rules`
- ✅ `Rules > Create/update/delete rules` (for write operations)

**Verify Current Token:** Check token scopes at https://account.smartthings.com/tokens

---

## Data Structure Comparison

### Scene Response
```json
{
  "sceneId": "550e8400-e29b-41d4-a716-446655440000",
  "sceneName": "Movie Night",
  "sceneIcon": "movie",
  "sceneColor": "#FF5733",
  "locationId": "a5c5c6d2-...",
  "createdBy": "user-uuid",
  "createdDate": "2024-01-15T10:30:00Z",
  "lastUpdatedDate": "2024-02-20T14:22:00Z",
  "lastExecutedDate": "2024-11-30T19:45:00Z",
  "editable": true
}
```

### Rule Response
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440000",
  "name": "Motion-activated lights",
  "status": "Enabled",
  "ownerType": "User",
  "ownerId": "user-uuid",
  "dateCreated": "2024-01-10T09:00:00Z",
  "dateUpdated": "2024-03-15T11:30:00Z",
  "executionLocation": "Cloud",
  "actions": [
    {
      "command": {
        "devices": ["device-uuid"],
        "commands": [
          {
            "component": "main",
            "capability": "switch",
            "command": "on"
          }
        ]
      }
    }
  ]
}
```

---

## Answering the Research Questions

### 1. Are "Routines" the same as "Scenes" in the SmartThings API?

**Partially YES:**
- ✅ **"Manually run routines"** in the app = **Scenes** in the API
- ❌ **"Automatic routines"** in the app ≠ Rules API (app routines are a superset)

### 2. What SDK methods are available for Routines/Scenes?

**Scenes (Manually run routines):**
```typescript
client.scenes.list(options?: SceneListOptions): Promise<SceneSummary[]>
client.scenes.get(id: string): Promise<SceneSummary>
client.scenes.execute(id: string): Promise<Status>
```

**Rules (Automatic routines - API-created only):**
```typescript
client.rules.list(locationId?: string): Promise<Rule[]>
client.rules.get(id: string, locationId?: string): Promise<Rule>
client.rules.create(data: RuleRequest, locationId?: string): Promise<Rule>
client.rules.update(id: string, data: RuleRequest, locationId?: string): Promise<Rule>
client.rules.delete(id: string, locationId?: string): Promise<Rule>
client.rules.execute(id: string, locationId?: string): Promise<RuleExecutionResponse>
```

### 3. How do we list all Routines for a location?

**To get user's "Manually run routines":**
```typescript
const scenes = await client.scenes.list({ locationId: [locationId] });
```

**To get API-created "Automatic routines":**
```typescript
const rules = await client.rules.list(locationId);
```

⚠️ **Note:** App-created "Automatic routines" are **NOT accessible** via any API

### 4. Can Routines be enabled/disabled like Rules?

**Scenes:** No enable/disable state (they're manually triggered)

**Rules:** Yes, via `status` field:
```typescript
export type RuleStatus = 'Enabled' | 'Disabled';
```

### 5. What data structure do Routines return?

See [Data Structure Comparison](#data-structure-comparison) section above.

---

## Recommended Implementation Approach

### For User's "Manually Run Routines" (Scenes)

**Status:** ✅ Already implemented in `src/smartthings/client.ts`

**Current Usage:**
```typescript
// List all scenes
const scenes = await smartThingsService.listScenes();

// List scenes for specific location
const scenes = await smartThingsService.listScenes(locationId);

// Execute a scene
await smartThingsService.executeScene(sceneId);

// Find scene by name
const scene = await smartThingsService.findSceneByName('Movie Night');
```

**Recommendation:** No changes needed. Our current implementation correctly fetches Scenes.

### For API-Created "Automatic Routines" (Rules)

**Status:** ✅ Already implemented in `src/services/AutomationService.ts`

**Current Usage:**
```typescript
// List rules
const rules = await automationService.listRules(locationId);

// Create rule
const rule = await automationService.createRule(locationId, ruleConfig);

// Update rule
const rule = await automationService.updateRule(ruleId, locationId, updates);

// Delete rule
await automationService.deleteRule(ruleId, locationId);

// Execute rule
await automationService.executeRule(ruleId, locationId);
```

**Recommendation:** Keep current implementation. Document limitation that app-created "Automatic routines" won't appear.

### For App-Created "Automatic Routines"

**Status:** ❌ Not accessible via any API

**Recommendation:**
1. Document this limitation clearly in user-facing interfaces
2. Suggest users use "Manually run routines" (Scenes) for automations they want API access to
3. Consider filing feature request with SmartThings for app-routine API access

---

## Code Examples from Existing Implementation

### Test File: Scenes API
**File:** `/test-scenes-api.ts`

```typescript
import { SmartThingsClient, BearerTokenAuthenticator } from '@smartthings/core-sdk';

async function testScenesAPI() {
  const token = process.env.SMARTTHINGS_TOKEN;
  const client = new SmartThingsClient(new BearerTokenAuthenticator(token));

  console.log('Fetching all scenes...');
  const scenes = await client.scenes.list();

  console.log(`\nFound ${scenes.length} scenes\n`);

  for (const scene of scenes) {
    console.log(`Scene: ${scene.sceneName} (ID: ${scene.sceneId})`);
    console.log(`  Location: ${scene.locationId}`);

    // Get scene details
    const details = await client.scenes.get(scene.sceneId);

    // Check if scene controls specific device
    const detailsStr = JSON.stringify(details, null, 2);
    if (detailsStr.includes(DEVICE_ID)) {
      console.log(`  🎯 THIS SCENE CONTROLS DEVICE!`);
    }
  }
}
```

### Service Implementation: SmartThingsService
**File:** `/src/smartthings/client.ts` (lines 403-450)

```typescript
/**
 * List all scenes accessible with the current token.
 *
 * @param locationId Optional location ID to filter scenes
 * @returns Array of scene information
 * @throws Error if API request fails after retries
 */
async listScenes(locationId?: LocationId): Promise<SceneInfo[]> {
  logger.debug('Fetching scene list', { locationId });

  const options = locationId ? { locationId: [locationId] } : undefined;

  const scenes = await retryWithBackoff(async () => {
    return await this.client.scenes.list(options);
  });

  const sceneInfos: SceneInfo[] = scenes.map((scene) => ({
    sceneId: scene.sceneId as SceneId,
    sceneName: scene.sceneName ?? 'Unnamed Scene',
    sceneIcon: scene.sceneIcon,
    sceneColor: scene.sceneColor,
    locationId: scene.locationId as LocationId | undefined,
    createdBy: scene.createdBy,
    createdDate: scene.createdDate,
    lastUpdatedDate: scene.lastUpdatedDate,
    lastExecutedDate: scene.lastExecutedDate,
    editable: scene.editable,
  }));

  logger.info('Scenes retrieved', { count: sceneInfos.length, locationFilter: !!locationId });
  return sceneInfos;
}

/**
 * Execute a scene by ID.
 *
 * @param sceneId Scene UUID
 * @throws Error if scene not found or execution fails
 */
async executeScene(sceneId: SceneId): Promise<void> {
  logger.debug('Executing scene', { sceneId });

  await retryWithBackoff(async () => {
    await this.client.scenes.execute(sceneId);
  });

  logger.info('Scene executed successfully', { sceneId });
}
```

---

## Conclusion

### What User Sees in App
When the user opens SmartThings app → Routines tab, they see:
- **Manually run routines** (tap to execute)
- **Automatic routines** (trigger-based)

### What We Can Fetch via API

| User's View | API Term | Our Method | Coverage |
|-------------|----------|------------|----------|
| Manually run routines | Scenes | `listScenes()` | ✅ 100% |
| Automatic routines (app-created) | N/A | N/A | ❌ 0% (not accessible) |
| Automatic routines (API-created) | Rules | `listRules()` | ✅ 100% |

### Final Answer to User's Question

**Q:** "User has 'many Automations on the app -- they're called Routines'. Our current implementation fetches SmartThings Rules, but those are different from Routines."

**A:**
1. User's "Routines" likely refers to **"Manually run routines"** = **Scenes**
2. ✅ We already fetch these via `client.scenes.list()` in `SmartThingsService`
3. ✅ Current implementation is correct
4. ⚠️ If user means "Automatic routines" created in the app, those are **NOT accessible via any API**
5. ✅ We can fetch API-created "Automatic routines" via `client.rules.list()` in `AutomationService`

**Recommendation:** Verify with user which type of "Routines" they're referring to:
- If manually triggered → We already support via Scenes API ✅
- If automatic (app-created) → Not accessible via API ❌
- If automatic (API-created) → We already support via Rules API ✅

---

## References

### Documentation
- [SmartThings Scenes Documentation](https://developer.smartthings.com/docs/automations/scenes)
- [SmartThings Automations Getting Started](https://developer.smartthings.com/docs/automations/getting-started-with-automations)
- [SmartThings API Reference](https://developer.smartthings.com/docs/api/public)

### Community Discussions
- [FAQ: Routine vs Scene (SmartThings Classic)](https://community.smartthings.com/t/faq-what-is-the-difference-between-a-routine-and-a-scene-smartthings-classic/109798)
- [Missing Features: Scenes vs Routines](https://community.smartthings.com/t/missing-features-scenes-vs-routines/271119)

### SDK Resources
- [@smartthings/core-sdk v8.0.0](https://www.npmjs.com/package/@smartthings/core-sdk)
- [Sample Rules API Repository](https://github.com/SmartThingsDevelopers/Sample-RulesAPI)
- [SmartThings CLI](https://github.com/SmartThingsCommunity/smartthings-cli)

---

## Files Analyzed

### Source Code
- `/src/smartthings/client.ts` (800 lines) - SmartThings API client wrapper
- `/src/services/AutomationService.ts` (579 lines) - Rules API service
- `/src/types/automation.ts` (336 lines) - Automation type definitions
- `/src/platforms/smartthings/SmartThingsAdapter.ts` (150 lines analyzed) - Platform adapter

### Test Files
- `/test-scenes-api.ts` (44 lines) - Scenes API test script

### SDK Type Definitions
- `node_modules/@smartthings/core-sdk/dist/endpoint/scenes.d.ts` (72 lines)
- `node_modules/@smartthings/core-sdk/dist/endpoint/rules.d.ts` (349 lines)

### Configuration
- `/package.json` - Dependency: `@smartthings/core-sdk: ^8.0.0`

---

**Research completed:** 2025-12-02
**Total files analyzed:** 8
**Total lines reviewed:** ~2,300 lines
**Memory usage:** Strategic sampling (no full file loading >20KB)
