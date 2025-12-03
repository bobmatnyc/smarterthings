# InstalledApps Feature Analysis

**Research Date:** 2025-12-03
**Project:** MCP SmartThings Dashboard
**Status:** ✅ Complete
**Researcher:** Research Agent

---

## Executive Summary

This analysis evaluates the InstalledApps feature implementation requirements for the MCP SmartThings Dashboard. The research covers backend API capabilities, SmartThings InstalledApps conceptual model, UI/UX patterns, and provides specific implementation guidance.

**Key Findings:**
- ✅ **Backend API Support:** InstalledApps API already implemented in `SmartThingsService.listInstalledApps()` (lines 801-823)
- ✅ **SDK Support:** Full SmartThings Core SDK support via `client.installedApps.*` endpoints
- ⚠️ **Platform Status:** SmartApps are legacy/deprecated, SmartThings now favors Rules and Scenes
- ✅ **UI Pattern:** Should follow existing RuleCard/SceneCard/AutomationCard component pattern
- 💡 **Recommendation:** Implement as **read-only informational view** (InstalledApps cannot be executed like Scenes)

---

## 1. Backend API Analysis

### 1.1 Existing Implementation

**File:** `/Users/masa/Projects/mcp-smartthings/src/smartthings/client.ts` (lines 801-823)

```typescript
/**
 * List all installed SmartApps (legacy apps installed in the user's account).
 *
 * @param locationId Optional location ID to filter installed apps
 * @returns Array of installed app information
 * @throws Error if API request fails after retries
 */
async listInstalledApps(locationId?: LocationId): Promise<any[]> {
  logger.debug('Fetching installed apps list', { locationId });

  const installedApps = await retryWithBackoff(async () => {
    return await this.client.installedApps.list({
      locationId: locationId as string | undefined,
      installedAppStatus: 'AUTHORIZED',
    });
  });

  logger.info('Installed apps retrieved', { count: installedApps.length });

  return installedApps.map((app) => ({
    id: app.installedAppId,
    name: app.displayName ?? 'Unnamed App',
    type: app.installedAppType,
    status: app.installedAppStatus,
    classification: app.classifications?.[0] ?? 'AUTOMATION',
    locationId: app.locationId,
    createdDate: app.createdDate,
    lastUpdatedDate: app.lastUpdatedDate,
  }));
}
```

**Status:** ✅ **Already Implemented**

### 1.2 Available SmartThings SDK Endpoints

**Available via `@smartthings/core-sdk`:**

```typescript
class InstalledAppsEndpoint {
  // List installed app instances
  list(options?: InstalledAppListOptions): Promise<InstalledApp[]>

  // Get specific installed app
  get(id?: string): Promise<InstalledApp>

  // Create installed app instance
  create(data: ConfigurationRequest): Promise<InstalledAppResponse>

  // Update display name
  update(id: string, data: InstalledAppUpdateRequest): Promise<InstalledApp>

  // Delete installed app
  delete(id?: string): Promise<Status>

  // Configuration management
  listConfigurations(id: string, options?: ConfigurationListOptions): Promise<InstalledAppConfigItem[]>
  getConfiguration(id: string, configurationId: string): Promise<InstalledAppConfiguration>
  updateConfiguration(id: string, data: ConfigurationUpdateRequest): Promise<InstalledAppConfiguration>

  // Events and messaging
  createEvent(data: InstalledAppEvents, id?: string): Promise<Status>
  sendMessage(data: InstalledAppMessage, id?: string): Promise<Status>
}
```

### 1.3 Data Structure

**Installed App Response:**

```typescript
interface InstalledApp {
  installedAppId: string              // Unique ID for installed instance
  installedAppType: InstalledAppType  // LAMBDA_SMART_APP, WEBHOOK_SMART_APP, API_ONLY, BEHAVIOR
  installedAppStatus: InstalledAppStatus  // PENDING, AUTHORIZED, REVOKED, DISABLED
  displayName?: string                // User-defined name
  appId: string                       // Reference to App definition
  locationId?: string                 // Location where installed
  classifications?: InstalledAppClassification[]  // UI categorization
  createdDate: string
  lastUpdatedDate: string
  ui?: InstalledAppUi                 // Dashboard card settings
}

enum InstalledAppType {
  LAMBDA_SMART_APP = "LAMBDA_SMART_APP",      // AWS Lambda hosted
  WEBHOOK_SMART_APP = "WEBHOOK_SMART_APP",    // External webhook
  API_ONLY = "API_ONLY",                      // API-only access
  BEHAVIOR = "BEHAVIOR"                       // Platform automation
}

enum InstalledAppStatus {
  PENDING = "PENDING",           // Awaiting authorization
  AUTHORIZED = "AUTHORIZED",     // Active and authorized
  REVOKED = "REVOKED",          // Authorization revoked
  DISABLED = "DISABLED"         // Disabled by user
}

enum InstalledAppClassification {
  AUTOMATION = "AUTOMATION",           // Shows under "Automation" tab
  SERVICE = "SERVICE",                 // Background service
  DEVICE = "DEVICE",                   // Shows under "Device" tab
  CONNECTED_SERVICE = "CONNECTED_SERVICE" // Shows under "Connected Services"
}
```

### 1.4 List Options

```typescript
interface InstalledAppListOptions {
  locationId?: string | string[]
  installedAppStatus?: InstalledAppStatus | InstalledAppStatus[]
  installedAppType?: InstalledAppType | InstalledAppType[]
  appId?: string | string[]
  modeId?: string | string[]
  deviceId?: string | string[]
  max?: number
  page?: number
}
```

---

## 2. SmartThings InstalledApps Concept

### 2.1 What Are InstalledApps?

**Definition:**
InstalledApps are instances of SmartApps (custom applications) that have been installed and authorized in a SmartThings location. They represent active integrations, automations, or services running in the user's SmartThings environment.

**Types:**
1. **SmartApps (Legacy):** Custom Groovy-based automations (deprecated)
2. **Cloud-Connected Apps:** External services integrated via OAuth (Alexa, Google Home, IFTTT)
3. **Behaviors:** Platform-native automations (Rules, Routines) exposed as InstalledApps
4. **Custom Integrations:** Third-party apps using SmartThings API

### 2.2 InstalledApps vs. Scenes vs. Rules vs. Automations

| Feature | InstalledApps | Scenes | Rules/Automations |
|---------|---------------|--------|-------------------|
| **Purpose** | Installed integrations/services | Manual device presets | IF/THEN automation logic |
| **Execution** | Background/event-driven | Manual trigger | Automatic (condition-based) |
| **User Control** | View, enable/disable, remove | Execute on demand | Enable/disable, execute |
| **Status** | Legacy (being phased out) | ✅ Active | ✅ Active (primary) |
| **Platform Status** | AUTHORIZED, PENDING, REVOKED, DISABLED | N/A (always enabled) | Enabled, Disabled |
| **Can Execute?** | ❌ No direct execution | ✅ Yes | ✅ Yes (manual trigger) |
| **Created By** | User installation or platform | User via SmartThings app | User via SmartThings app |

### 2.3 Operations Available

**Read Operations:**
- ✅ List all installed apps
- ✅ Get installed app details
- ✅ View configuration settings

**Write Operations:**
- ⚠️ Enable/disable installed app (limited - depends on app type)
- ⚠️ Remove installed app (delete operation - destructive)
- ❌ **Cannot execute installed apps directly** (unlike Scenes)

**Key Limitation:**
InstalledApps are **not directly executable** like Scenes. They run in the background based on their internal logic (events, schedules, webhooks).

### 2.4 User Interaction Model

**Primary Use Cases:**
1. **Visibility:** See which integrations are active (Alexa, Google Home, third-party apps)
2. **Status Monitoring:** Check authorization status (AUTHORIZED vs. REVOKED)
3. **Management:** Identify and remove unused or problematic apps
4. **Troubleshooting:** Diagnose integration issues by reviewing app status

**Not Suitable For:**
- Manual execution (use Scenes instead)
- Creating new automations (use Rules/Routines builder)
- Real-time device control (use Devices view)

---

## 3. UI/UX Pattern Analysis

### 3.1 Existing Card Components

**Location:** `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/`

**Component Pattern:**

| Component | File | Purpose | Key Features |
|-----------|------|---------|--------------|
| **RuleCard** | `rules/RuleCard.svelte` | Display automation rules | Enable/disable toggle, Execute button, Triggers, Actions count, Last executed |
| **SceneCard** | `scenes/SceneCard.svelte` | Display manual scenes | Execute button, Last executed, Simple layout (no toggle) |
| **AutomationCard** | `automations/AutomationCard.svelte` | Display legacy automations | Enable/disable toggle, Triggers, Last executed |

### 3.2 Component Structure Breakdown

**Common Elements Across All Cards:**

1. **Card Container:**
   - White background with rounded corners (1rem)
   - Subtle shadow with hover elevation
   - Border (1px solid gray-200)
   - Hover state: `transform: translateY(-2px)` + enhanced shadow

2. **Layout:**
   - Flexbox horizontal layout
   - Icon (left) → Info (center, flex: 1) → Action/Toggle (right)
   - Gap: 1.25rem between sections
   - Padding: 1.5rem

3. **Icon Section:**
   - 3rem × 3rem rounded square (0.75rem radius)
   - Gradient background (color-coded by type)
   - SVG icon (1.5rem × 1.5rem)
   - Colors:
     - **Rules:** Purple gradient (`rgb(243, 232, 255)` → `rgb(233, 213, 255)`)
     - **Scenes:** Blue gradient (`rgb(219, 234, 254)` → `rgb(191, 219, 254)`)
     - **Automations:** Blue gradient (same as Scenes)

4. **Info Section:**
   - Header row: Name + Status badge
   - Metadata rows: Triggers, Actions, Last executed
   - Font sizes: 1.125rem (name), 0.875rem (metadata), 0.8125rem (timestamps)

5. **Action Section:**
   - **RuleCard:** Toggle switch (2.75rem × 1.5rem) + Execute button (3rem circle)
   - **SceneCard:** Execute button only (3rem circle)
   - **AutomationCard:** Toggle switch only (3rem × 1.75rem)

### 3.3 Recommended Pattern for InstalledAppsCard

**Based on Analysis:**

**Layout Decision:** Follow **AutomationCard** pattern (closest conceptual match)

**Rationale:**
- InstalledApps have enable/disable state (like Automations/Rules)
- InstalledApps **cannot be executed** (unlike Scenes/Rules)
- InstalledApps are informational + status management (not action-oriented)

**Proposed Component Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  [Icon]  │  Name                      [Status Badge]    │
│          │  Type: WEBHOOK_SMART_APP                     │
│          │  Classification: AUTOMATION                  │
│          │  Last Updated: 2 days ago                    │
│          │                                              │
└─────────────────────────────────────────────────────────┘
```

**Key Differences from Existing Cards:**
- ❌ **No Execute Button** (InstalledApps cannot be executed)
- ❌ **No Enable/Disable Toggle** (InstalledApps status is managed via SmartThings app)
- ✅ **Status Badge** showing AUTHORIZED/PENDING/REVOKED/DISABLED
- ✅ **Type Badge** showing LAMBDA_SMART_APP/WEBHOOK_SMART_APP/API_ONLY/BEHAVIOR
- ✅ **Classification Badge** showing AUTOMATION/SERVICE/DEVICE/CONNECTED_SERVICE
- ✅ **Last Updated** timestamp (no lastExecuted since they don't execute manually)

### 3.4 Card vs. List vs. Grid Layout

**Recommendation:** **Grid Layout** (following existing pattern)

**Existing Pattern:**
- **Rules:** Grid layout via `RulesGrid.svelte`
- **Scenes:** Inferred grid layout (no dedicated grid component found, but card-based)
- **Automations:** Grid layout via `AutomationsGrid.svelte`

**Grid Configuration:**
```css
.installedapps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}
```

**Mobile Responsiveness:**
```css
@media (max-width: 768px) {
  .installedapps-grid {
    grid-template-columns: 1fr; /* Single column on mobile */
    gap: 1rem;
  }
}
```

---

## 4. Implementation Scope

### 4.1 Component Structure Needed

**Minimal Viable Implementation:**

```
web/src/lib/components/installedapps/
├── InstalledAppCard.svelte          # Individual installed app card
└── InstalledAppsGrid.svelte         # Grid layout container
```

**Component Breakdown:**

#### 4.1.1 InstalledAppCard.svelte

**Props:**
```typescript
interface Props {
  installedApp: InstalledApp;
}
```

**Visual Elements:**
1. **Icon Section:**
   - Gradient background (amber/orange for distinction from Rules/Scenes)
   - SVG icon representing integrations/apps
   - Color coding by classification:
     - AUTOMATION: Purple
     - SERVICE: Blue
     - DEVICE: Green
     - CONNECTED_SERVICE: Amber

2. **Info Section:**
   - **Header:** App name + Status badge
   - **Type Badge:** Display `installedAppType` (formatted)
   - **Classification Badge:** Display primary classification
   - **Last Updated:** Formatted timestamp

3. **No Action Section** (read-only view)

**Status Badge Colors:**
- **AUTHORIZED:** Green (`rgb(220, 252, 231)`)
- **PENDING:** Amber (`rgb(254, 243, 199)`)
- **REVOKED:** Red (`rgb(254, 226, 226)`)
- **DISABLED:** Gray (`rgb(243, 244, 246)`)

#### 4.1.2 InstalledAppsGrid.svelte

**Props:**
```typescript
interface Props {
  installedApps: InstalledApp[];
  loading?: boolean;
  error?: string | null;
}
```

**Features:**
- Grid layout with responsive columns
- Loading skeleton states
- Error message display
- Empty state when no installed apps

### 4.2 Store Requirements

**File:** `web/src/lib/stores/installedAppsStore.svelte.ts`

**State:**
```typescript
interface InstalledApp {
  id: string;                    // installedAppId
  name: string;                  // displayName
  type: InstalledAppType;        // installedAppType
  status: InstalledAppStatus;    // installedAppStatus
  classification: string;        // classifications[0]
  locationId?: string;           // locationId
  createdDate: string;           // createdDate
  lastUpdatedDate: string;       // lastUpdatedDate
}

let installedAppMap = $state<Map<string, InstalledApp>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);
```

**Derived State:**
```typescript
let installedApps = $derived(
  Array.from(installedAppMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

let stats = $derived({
  total: installedApps.length,
  authorized: installedApps.filter(app => app.status === 'AUTHORIZED').length,
  pending: installedApps.filter(app => app.status === 'PENDING').length,
  revoked: installedApps.filter(app => app.status === 'REVOKED').length,
  disabled: installedApps.filter(app => app.status === 'DISABLED').length,
});
```

**Actions:**
```typescript
async function loadInstalledApps(): Promise<void>
function getInstalledAppById(id: string): InstalledApp | undefined
function clearError(): void
```

**Store Factory:**
```typescript
export function getInstalledAppsStore() {
  return {
    get installedApps() { return installedApps; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },
    loadInstalledApps,
    getInstalledAppById,
    clearError,
  };
}
```

### 4.3 API Integration Approach

**Backend Endpoint:** Already exists in `SmartThingsService.listInstalledApps()`

**Frontend API Route:** Create new endpoint

**Option 1: Extend Existing API Client**

**File:** `web/src/lib/api/client.ts`

```typescript
/**
 * List all installed apps
 *
 * @param locationId Optional location filter
 * @returns DirectResult with installed app list
 */
async getInstalledApps(locationId?: string): Promise<DirectResult<InstalledApp[]>> {
  const params = new URLSearchParams();
  if (locationId) params.append('locationId', locationId);

  const url = params.toString()
    ? `${this.baseUrl}/installedapps?${params.toString()}`
    : `${this.baseUrl}/installedapps`;

  const response = await fetch(url);
  return response.json();
}

/**
 * Get specific installed app details
 *
 * @param installedAppId Installed app ID
 * @returns DirectResult with installed app details
 */
async getInstalledApp(installedAppId: string): Promise<DirectResult<InstalledApp>> {
  const response = await fetch(`${this.baseUrl}/installedapps/${installedAppId}`);
  return response.json();
}
```

**Option 2: Direct Fetch in Store (Following scenesStore pattern)**

**File:** `web/src/lib/stores/installedAppsStore.svelte.ts`

```typescript
export async function loadInstalledApps(): Promise<void> {
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/installedapps');

    if (!response.ok) {
      throw new Error(`Failed to fetch installed apps: ${response.statusText}`);
    }

    const result: InstalledAppsResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load installed apps');
    }

    const newMap = new Map<string, InstalledApp>();
    result.data.installedApps.forEach((app) => {
      newMap.set(app.id, app);
    });

    installedAppMap = newMap;
  } catch (err) {
    console.error('Failed to load installed apps:', err);
    error = err instanceof Error ? err.message : 'Failed to load installed apps';
    toast.error('Failed to load installed apps', { description: error });
    installedAppMap = new Map();
  } finally {
    loading = false;
  }
}
```

**Recommendation:** Use **Option 2** (direct fetch in store) to match existing `scenesStore` pattern.

### 4.4 Backend API Route (Required)

**Create:** New API route handler

**File:** `web/src/routes/api/installedapps/+server.ts` (SvelteKit convention)

**Implementation:**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { smartThingsService } from '$lib/server/smartthings'; // Adjust import path

export const GET: RequestHandler = async ({ url }) => {
  const locationId = url.searchParams.get('locationId') || undefined;

  try {
    const installedApps = await smartThingsService.listInstalledApps(locationId);

    return json({
      success: true,
      data: {
        count: installedApps.length,
        installedApps,
      },
    });
  } catch (error) {
    console.error('Failed to fetch installed apps:', error);
    return json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch installed apps',
        },
      },
      { status: 500 }
    );
  }
};
```

**Route:** `GET /api/installedapps`

**Query Parameters:**
- `locationId` (optional): Filter by location

**Response Format:**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "installedApps": [
      {
        "id": "abc123...",
        "name": "Alexa Integration",
        "type": "WEBHOOK_SMART_APP",
        "status": "AUTHORIZED",
        "classification": "CONNECTED_SERVICE",
        "locationId": "loc456...",
        "createdDate": "2024-01-15T10:30:00Z",
        "lastUpdatedDate": "2024-11-20T14:22:00Z"
      }
    ]
  }
}
```

### 4.5 Minimal Viable Implementation

**Phase 1: Core Components (Day 1-2)**

1. **Create InstalledAppCard.svelte**
   - Read-only card (no actions)
   - Status badge with color coding
   - Type and classification badges
   - Last updated timestamp
   - Icon with classification-based gradient

2. **Create InstalledAppsGrid.svelte**
   - Grid layout container
   - Loading states
   - Error handling
   - Empty state

3. **Create installedAppsStore.svelte.ts**
   - State management with Svelte 5 runes
   - `loadInstalledApps()` action
   - Derived statistics
   - Store factory pattern

**Phase 2: API Integration (Day 2-3)**

1. **Create backend API route**
   - `/web/src/routes/api/installedapps/+server.ts`
   - GET handler with location filter
   - Error handling and response formatting

2. **Wire up store to API**
   - Fetch from `/api/installedapps`
   - Transform backend response to frontend format
   - Error handling with toast notifications

**Phase 3: UI Integration (Day 3-4)**

1. **Create InstalledApps page**
   - `/web/src/routes/installedapps/+page.svelte`
   - Header with stats
   - Grid of InstalledAppCard components
   - Loading and error states

2. **Add navigation link**
   - Update main navigation/sidebar
   - Add "Installed Apps" menu item
   - Icon selection (app grid icon)

**Phase 4: Polish & Testing (Day 4-5)**

1. **Responsive design testing**
   - Mobile layout verification
   - Tablet breakpoint adjustments
   - Desktop grid optimization

2. **Error scenarios**
   - Network failures
   - Empty states
   - API errors

3. **Documentation**
   - Component usage docs
   - API endpoint documentation
   - User guide (if needed)

**Total Effort:** 5 days (1 developer)

---

## 5. Specific File Paths

### 5.1 Backend Files

**Existing:**
- ✅ `/Users/masa/Projects/mcp-smartthings/src/smartthings/client.ts`
  - Lines 801-823: `listInstalledApps()` method

**New Files (Not Required):**
- Backend implementation already complete

### 5.2 Frontend Files

**New Files to Create:**

1. **Components:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/installedapps/InstalledAppCard.svelte`
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/installedapps/InstalledAppsGrid.svelte`

2. **Store:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/installedAppsStore.svelte.ts`

3. **API Route:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/routes/api/installedapps/+server.ts`

4. **Page:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/routes/installedapps/+page.svelte`

**Existing Files to Reference:**

1. **Pattern Templates:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/rules/RuleCard.svelte`
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/scenes/SceneCard.svelte`
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationCard.svelte`
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/rules/RulesGrid.svelte`
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationsGrid.svelte`

2. **Store Pattern:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.svelte.ts` (recommended template)
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/rulesStore.svelte.ts`
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/automationStore.svelte.ts`

3. **API Client:**
   - `/Users/masa/Projects/mcp-smartthings/web/src/lib/api/client.ts`

### 5.3 Type Definitions

**Existing:**
- `/Users/masa/Projects/mcp-smartthings/src/types/smartthings.ts`

**Additions Needed:**

```typescript
// Add to smartthings.ts
export type InstalledAppId = string & { readonly __brand: 'InstalledAppId' };

export function createInstalledAppId(id: string): InstalledAppId {
  return id as InstalledAppId;
}

export interface InstalledAppInfo {
  installedAppId: InstalledAppId;
  displayName: string;
  installedAppType: string;
  installedAppStatus: string;
  classification?: string;
  locationId?: LocationId;
  createdDate: Date;
  lastUpdatedDate: Date;
}
```

---

## 6. API Endpoints Summary

### 6.1 SmartThings SDK Endpoints Used

```typescript
// From @smartthings/core-sdk
client.installedApps.list({
  locationId?: string,
  installedAppStatus?: 'AUTHORIZED' | 'PENDING' | 'REVOKED' | 'DISABLED',
  installedAppType?: 'LAMBDA_SMART_APP' | 'WEBHOOK_SMART_APP' | 'API_ONLY' | 'BEHAVIOR',
  max?: number,
  page?: number,
}): Promise<InstalledApp[]>

client.installedApps.get(id: string): Promise<InstalledApp>
```

### 6.2 Backend API (SmartThingsService)

**Method:** `listInstalledApps(locationId?: LocationId): Promise<any[]>`

**Location:** `/Users/masa/Projects/mcp-smartthings/src/smartthings/client.ts:801-823`

**Status:** ✅ Already Implemented

**Features:**
- Filters by `installedAppStatus: 'AUTHORIZED'` (only show active apps)
- Transforms SDK response to simplified format
- Includes retry logic via `retryWithBackoff`
- Logging for debugging

### 6.3 Frontend API Endpoints (To Be Created)

**Endpoint:** `GET /api/installedapps`

**Query Parameters:**
- `locationId` (optional): Filter by location UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "installedApps": [...]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Failed to fetch installed apps: Network error"
  }
}
```

---

## 7. Type Definitions

### 7.1 Backend Types (SmartThings SDK)

**From @smartthings/core-sdk:**

```typescript
interface InstalledApp {
  installedAppId: string
  installedAppType: 'LAMBDA_SMART_APP' | 'WEBHOOK_SMART_APP' | 'API_ONLY' | 'BEHAVIOR'
  installedAppStatus: 'PENDING' | 'AUTHORIZED' | 'REVOKED' | 'DISABLED'
  displayName?: string
  appId: string
  locationId?: string
  classifications?: ('AUTOMATION' | 'SERVICE' | 'DEVICE' | 'CONNECTED_SERVICE')[]
  createdDate: string
  lastUpdatedDate: string
  ui?: InstalledAppUi
}
```

### 7.2 Frontend Types (To Be Created)

**File:** `web/src/lib/stores/installedAppsStore.svelte.ts`

```typescript
export interface InstalledApp {
  id: string;                    // installedAppId
  name: string;                  // displayName
  type: InstalledAppType;        // installedAppType (formatted)
  status: InstalledAppStatus;    // installedAppStatus
  classification: string;        // classifications[0]
  locationId?: string;           // locationId
  createdDate: string;           // ISO 8601
  lastUpdatedDate: string;       // ISO 8601
}

type InstalledAppType =
  | 'LAMBDA_SMART_APP'
  | 'WEBHOOK_SMART_APP'
  | 'API_ONLY'
  | 'BEHAVIOR';

type InstalledAppStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'REVOKED'
  | 'DISABLED';

interface InstalledAppsResponse {
  success: boolean;
  data: {
    count: number;
    installedApps: InstalledApp[];
  };
  error?: {
    message: string;
  };
}
```

---

## 8. Implementation Guidance

### 8.1 Component Implementation Template

**InstalledAppCard.svelte:**

```svelte
<script lang="ts">
  import type { InstalledApp } from '$lib/stores/installedAppsStore.svelte';

  interface Props {
    installedApp: InstalledApp;
  }

  let { installedApp }: Props = $props();

  // Format last updated time
  const lastUpdatedText = $derived(() => {
    const date = new Date(installedApp.lastUpdatedDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  });

  // Status badge color
  const statusColor = $derived(() => {
    switch (installedApp.status) {
      case 'AUTHORIZED': return 'green';
      case 'PENDING': return 'amber';
      case 'REVOKED': return 'red';
      case 'DISABLED': return 'gray';
      default: return 'gray';
    }
  });

  // Classification-based icon gradient
  const iconGradient = $derived(() => {
    switch (installedApp.classification) {
      case 'AUTOMATION': return 'purple'; // Like Rules
      case 'SERVICE': return 'blue';      // Like Scenes
      case 'DEVICE': return 'green';
      case 'CONNECTED_SERVICE': return 'amber';
      default: return 'blue';
    }
  });
</script>

<article class="installedapp-card">
  <div class="card-content">
    <!-- Icon -->
    <div class="app-icon" data-classification={installedApp.classification}>
      <svg><!-- App/integration icon --></svg>
    </div>

    <!-- Info -->
    <div class="app-info">
      <div class="header-row">
        <h3 class="app-name">{installedApp.name}</h3>
        <div class="status-badge" data-status={installedApp.status}>
          <span class="status-dot"></span>
          <span class="status-text">{installedApp.status}</span>
        </div>
      </div>

      <!-- Type Badge -->
      <div class="type-badge">
        <span>{installedApp.type.replace('_', ' ')}</span>
      </div>

      <!-- Classification -->
      {#if installedApp.classification}
        <div class="classification">
          <svg><!-- Icon --></svg>
          <span>{installedApp.classification}</span>
        </div>
      {/if}

      <!-- Last Updated -->
      <div class="last-updated">
        <svg><!-- Clock icon --></svg>
        <span>Updated: {lastUpdatedText()}</span>
      </div>
    </div>
  </div>
</article>

<style>
  /* Follow RuleCard/SceneCard pattern */
  /* See existing components for full styles */
</style>
```

### 8.2 Store Implementation Template

**installedAppsStore.svelte.ts:**

```typescript
import { toast } from 'svelte-sonner';

export interface InstalledApp {
  // ... type definition
}

// State
let installedAppMap = $state<Map<string, InstalledApp>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived
let installedApps = $derived(
  Array.from(installedAppMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

let stats = $derived({
  total: installedApps.length,
  authorized: installedApps.filter(app => app.status === 'AUTHORIZED').length,
  // ... other stats
});

// Actions
export async function loadInstalledApps(): Promise<void> {
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/installedapps');
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load');
    }

    const newMap = new Map<string, InstalledApp>();
    result.data.installedApps.forEach((app) => {
      newMap.set(app.id, app);
    });

    installedAppMap = newMap;
  } catch (err) {
    console.error('Failed to load installed apps:', err);
    error = err instanceof Error ? err.message : 'Unknown error';
    toast.error('Failed to load installed apps', { description: error });
    installedAppMap = new Map();
  } finally {
    loading = false;
  }
}

export function getInstalledAppsStore() {
  return {
    get installedApps() { return installedApps; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },
    loadInstalledApps,
  };
}
```

### 8.3 Backend API Route Template

**+server.ts:**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { smartThingsService } from '$lib/server/smartthings';

export const GET: RequestHandler = async ({ url }) => {
  const locationId = url.searchParams.get('locationId') || undefined;

  try {
    const installedApps = await smartThingsService.listInstalledApps(locationId);

    return json({
      success: true,
      data: {
        count: installedApps.length,
        installedApps,
      },
    });
  } catch (error) {
    console.error('Failed to fetch installed apps:', error);
    return json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
};
```

---

## 9. Final Recommendations

### 9.1 Implementation Priority

**Priority Level:** **Medium**

**Rationale:**
- InstalledApps are **informational only** (cannot be executed)
- Platform is deprecating SmartApps in favor of Rules/Scenes
- Backend API already exists (no backend work needed)
- Primary value: visibility into active integrations

**Implementation Order:**

1. **High Priority:** Complete Rules and Scenes features (execution, enable/disable)
2. **Medium Priority:** InstalledApps (read-only view)
3. **Low Priority:** Advanced InstalledApps features (configuration view, removal)

### 9.2 Scope Recommendation

**Recommended Scope:** **Read-Only View (Phase 1 Only)**

**Include:**
- ✅ List all authorized installed apps
- ✅ Display app name, type, status, classification
- ✅ Status badge with color coding
- ✅ Last updated timestamp
- ✅ Grid layout with responsive design
- ✅ Loading and error states

**Exclude (Defer to Future):**
- ❌ Enable/disable functionality (limited value, complex implementation)
- ❌ Remove/delete functionality (destructive, needs confirmation UI)
- ❌ Configuration view (complex, low user demand)
- ❌ Filtering/search (add when >20 installed apps become common)

### 9.3 Card vs. List Recommendation

**Recommendation:** **Card-based Grid Layout**

**Reasons:**
1. **Consistency:** Matches existing Rules/Scenes/Automations UI
2. **Visual Clarity:** Cards provide better visual separation for status badges
3. **Extensibility:** Easier to add features (icons, badges) later
4. **User Familiarity:** Users expect card-based UI from existing views

### 9.4 Information Display Priority

**Must Show:**
1. App name (displayName)
2. Status badge (AUTHORIZED/PENDING/REVOKED/DISABLED)
3. Type badge (LAMBDA_SMART_APP/WEBHOOK_SMART_APP/etc.)

**Should Show:**
4. Classification (AUTOMATION/SERVICE/DEVICE/CONNECTED_SERVICE)
5. Last updated timestamp

**Nice to Have:**
6. App icon (if available from `ui.dashboardCardsEnabled`)
7. Location name (if multiple locations exist)

---

## 10. Technical Considerations

### 10.1 Performance

**Expected Data Volume:**
- Typical user: 5-15 installed apps
- Power user: 20-50 installed apps
- Maximum realistic: 100 installed apps

**Performance Targets:**
- Initial load: <2s (API fetch + render)
- Grid render: <100ms (50 cards)
- Filtering/sorting: <50ms

**Optimizations:**
- Use `Map` for O(1) lookups by ID
- Lazy load app configurations (if details view added later)
- Implement virtual scrolling if >100 apps become common

### 10.2 Error Handling

**API Errors:**
- Network failures: Show error state with retry button
- Authorization errors: Clear message about SmartThings token
- Empty results: Show empty state with helpful message

**Edge Cases:**
- No installed apps: "No installed apps found. Integrations like Alexa and Google Home will appear here."
- All apps revoked: Warning message about re-authorization
- Pending apps: Explain that user needs to complete authorization

### 10.3 Accessibility

**WCAG 2.1 AA Compliance:**
- Semantic HTML (`<article>`, `<h3>`, etc.)
- ARIA labels for status badges
- Keyboard navigation support
- Screen reader friendly status announcements
- Color contrast ratios: 4.5:1 minimum

**Color Blind Considerations:**
- Use icons + text for status (not color alone)
- Status badges include both dot color AND text label

---

## 11. Migration from Research Document

This analysis references the comprehensive research document:
**File:** `/Users/masa/Projects/mcp-smartthings/docs/research/integration-requests-smartapps-lutron-2025-12-02.md`

**Key Takeaways from Research:**
- SmartApps are deprecated platform feature
- InstalledApps API is fully functional via SDK
- Focus on read-only informational view
- Rules and Scenes are higher priority for user value

---

## Appendix A: Code Snippets

### A.1 Icon Gradient CSS

```css
/* Classification-based gradients */
.app-icon[data-classification="AUTOMATION"] {
  background: linear-gradient(135deg, rgb(243, 232, 255) 0%, rgb(233, 213, 255) 100%);
  color: rgb(147, 51, 234);
}

.app-icon[data-classification="SERVICE"] {
  background: linear-gradient(135deg, rgb(219, 234, 254) 0%, rgb(191, 219, 254) 100%);
  color: rgb(59, 130, 246);
}

.app-icon[data-classification="DEVICE"] {
  background: linear-gradient(135deg, rgb(220, 252, 231) 0%, rgb(187, 247, 208) 100%);
  color: rgb(22, 163, 74);
}

.app-icon[data-classification="CONNECTED_SERVICE"] {
  background: linear-gradient(135deg, rgb(254, 243, 199) 0%, rgb(253, 230, 138) 100%);
  color: rgb(217, 119, 6);
}
```

### A.2 Status Badge CSS

```css
.status-badge[data-status="AUTHORIZED"] {
  background: rgb(220, 252, 231);
  color: rgb(21, 128, 61);
}

.status-badge[data-status="AUTHORIZED"] .status-dot {
  background: rgb(34, 197, 94);
}

.status-badge[data-status="PENDING"] {
  background: rgb(254, 243, 199);
  color: rgb(146, 64, 14);
}

.status-badge[data-status="PENDING"] .status-dot {
  background: rgb(245, 158, 11);
}

.status-badge[data-status="REVOKED"] {
  background: rgb(254, 226, 226);
  color: rgb(153, 27, 27);
}

.status-badge[data-status="REVOKED"] .status-dot {
  background: rgb(239, 68, 68);
}

.status-badge[data-status="DISABLED"] {
  background: rgb(243, 244, 246);
  color: rgb(107, 114, 128);
}

.status-badge[data-status="DISABLED"] .status-dot {
  background: rgb(156, 163, 175);
}
```

---

## Appendix B: Component Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  Installed Apps                                   (Header)   │
│  ───────────────────────────────────────────────────────     │
│  Total: 12 | Authorized: 10 | Pending: 1 | Revoked: 1       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────┬─────────
│  [🔗]  │  Alexa Integration│  [🔗]  │  Google Home   │  [🔗]  │
│       │  [AUTHORIZED]    │       │  [AUTHORIZED]    │       │
│       │  Webhook SmartApp│       │  Webhook SmartApp│       │
│       │  Connected Service│      │  Connected Service│      │
│       │  Updated 2 days ago│    │  Updated 5 days ago│    │
└──────────────────────────┴──────────────────────────┴─────────

┌──────────────────────────┬──────────────────────────┬─────────
│  [⚙️]  │  IFTTT           │  [⚡]  │  Smart Lighting │  [📱]  │
│       │  [PENDING]       │       │  [DISABLED]      │       │
│       │  Lambda SmartApp │       │  Behavior        │       │
│       │  Automation      │       │  Automation      │       │
│       │  Updated 1 hour ago│   │  Updated 30 days ago│   │
└──────────────────────────┴──────────────────────────┴─────────
```

---

## Conclusion

**Summary:**
- Backend API for InstalledApps is **already implemented** ✅
- Frontend implementation requires **5 days** for minimal viable version
- Follow existing **RuleCard/SceneCard/AutomationCard pattern** for UI consistency
- Implement as **read-only informational view** (no execution or management)
- **Medium priority** (after Rules/Scenes features are complete)

**Next Steps:**
1. Review recommendations with stakeholders
2. Create implementation ticket if approved
3. Prioritize against Rules/Scenes work
4. Begin Phase 1 implementation (components + store)
5. Add backend API route
6. Test and deploy

**Contact:** Research Agent - MCP SmartThings Project
**Date:** 2025-12-03
