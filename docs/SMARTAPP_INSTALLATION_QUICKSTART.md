# SmartApp Installation Quick Start

**Goal**: Get device events flowing from SmartThings to your webhook.

**Status**: SmartApp registered ✅, OAuth working ✅, Missing: User installation + subscriptions ❌

---

## TL;DR - What You Need to Do

1. **User installs SmartApp via mobile app** (cannot be automated)
2. **Add INSTALL lifecycle handler** to receive installedAppId
3. **Create subscriptions** for device events (motion, contact, switch, etc.)

---

## Current State

### ✅ What's Working
- SmartApp registered: `appId: 282fe848-d5c0-4ab5-8240-2cbb732005f9`
- Webhook URL: `https://smarty.ngrok.app/webhook/smartthings`
- OAuth2 tokens working
- Event processing pipeline ready (webhook → queue → store → SSE)

### ❌ What's Missing
- **No INSTALL lifecycle handler** in webhook
- **No user installation** of SmartApp
- **No subscriptions** created for device events

**Result**: Webhook infrastructure exists, but SmartThings doesn't know where to send events yet.

---

## Why You Can't Programmatically Install

**SmartThings Security Model**:
- Installation is a **user-initiated action** via mobile app
- User must **grant device permissions** manually
- Cannot be bypassed with PAT or API calls (by design)

**How installedAppId is Obtained**:
- SmartThings generates `installedAppId` when user installs
- Sent to your webhook during **INSTALL lifecycle event**
- Format: `d692699d-e7a6-400d-a0b7-d5be96e7a564` (UUID)

**One App → Many Installations**:
- Your registered SmartApp = **blueprint**
- Each user installation = **instance** with unique `installedAppId`
- Subscriptions are tied to `installedAppId`, not `appId`

---

## Option 1: Quick Fix (Manual Setup)

**Get events working in 5 minutes:**

### Step 1: Retrieve Existing InstalledApp (if any)

```bash
# Run this command to check for existing installations
curl -X GET "https://api.smartthings.com/v1/installedapps?locationId=YOUR_LOCATION_ID" \
  -H "Authorization: Bearer YOUR_PAT"
```

**Or use existing code:**
```typescript
import { smartThingsService } from './src/smartthings/client.js';

const locations = await smartThingsService.listLocations();
const installedApps = await smartThingsService.listInstalledApps(locations[0].locationId);

console.log('Installed Apps:', installedApps);
```

### Step 2: Store InstalledAppId

If you find an existing installation:

```bash
# Add to .env.local
SMARTTHINGS_INSTALLED_APP_ID=uuid-from-step-1
```

### Step 3: Create Subscriptions Manually

```typescript
// scripts/create-subscriptions.ts
import { smartThingsService } from './src/smartthings/client.js';
import { getSubscriptionService } from './src/smartthings/subscription-service.js';

const installedAppId = process.env.SMARTTHINGS_INSTALLED_APP_ID!;
const locationId = 'your-location-id';

const client = smartThingsService.getClient();
const subService = getSubscriptionService();

subService.setContext(installedAppId, locationId);
const results = await subService.subscribeToDefaults();

console.log('Subscriptions created:', results);
```

Run the script:
```bash
node --loader ts-node/esm scripts/create-subscriptions.ts
```

### Step 4: Test Events

1. Trigger a motion sensor or toggle a switch
2. Check webhook logs for incoming EVENT lifecycle
3. Verify SSE broadcast to frontend

**Done! Events should now flow.**

---

## Option 2: Proper Implementation (Production Ready)

**Add missing lifecycle handlers:**

### Step 1: Update Webhook Lifecycle Enum

**File**: `src/routes/webhook.ts`

```typescript
const SmartThingsLifecycle = z.enum([
  'PING',
  'CONFIRMATION',
  'EVENT',
  'UNINSTALL',
  'INSTALL',       // ADD THIS
  'CONFIGURATION', // ADD THIS (optional)
]);
```

### Step 2: Add INSTALL Handler

**File**: `src/routes/webhook.ts` (in the switch statement around line 210)

```typescript
case 'INSTALL': {
  const installData = webhookData.installData;
  if (!installData) {
    logger.error('[Webhook] INSTALL lifecycle missing installData');
    return reply.code(400).send({ error: 'Missing installData' });
  }

  const { installedAppId, locationId } = installData.installedApp;

  logger.info('[Webhook] INSTALL received', {
    installedAppId,
    locationId,
  });

  // Store installedAppId persistently
  await storeInstallation({
    installedAppId,
    locationId,
    timestamp: new Date().toISOString(),
  });

  // Initialize subscription service
  const subService = getSubscriptionService();
  subService.setContext(installedAppId, locationId);

  // Create default subscriptions
  try {
    const results = await subService.subscribeToDefaults();
    logger.info('[Webhook] Subscriptions created', results);
  } catch (error) {
    logger.error('[Webhook] Failed to create subscriptions', { error });
  }

  return reply.code(200).send({ statusCode: 200 });
}
```

### Step 3: Add Persistent Storage

**File**: `src/storage/installation-storage.ts` (new file)

```typescript
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

const STORAGE_DIR = '.smartthings';
const INSTALLATION_FILE = path.join(STORAGE_DIR, 'installation.json');

export interface Installation {
  installedAppId: string;
  locationId: string;
  timestamp: string;
}

export async function storeInstallation(data: Installation): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.writeFile(INSTALLATION_FILE, JSON.stringify(data, null, 2));
    logger.info('Installation stored', { installedAppId: data.installedAppId });
  } catch (error) {
    logger.error('Failed to store installation', { error });
    throw error;
  }
}

export async function loadInstallation(): Promise<Installation | null> {
  try {
    const data = await fs.readFile(INSTALLATION_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null; // File doesn't exist yet
    }
    logger.error('Failed to load installation', { error });
    return null;
  }
}
```

### Step 4: Update Server Initialization

**File**: `src/server-alexa.ts`

Replace `initializeSubscriptionContext()` with:

```typescript
async function initializeSubscriptionContext(): Promise<void> {
  try {
    // Try loading stored installation first
    const stored = await loadInstallation();

    if (stored) {
      const subService = getSubscriptionService();
      subService.setContext(stored.installedAppId, stored.locationId);
      logger.info('Subscription context loaded from storage', stored);
      return;
    }

    // Fallback: Try fetching from API
    const locations = await smartThingsService.listLocations();
    if (locations.length === 0) {
      logger.warn('No locations found');
      return;
    }

    const installedApps = await smartThingsService.listInstalledApps(
      locations[0].locationId
    );

    if (installedApps.length === 0) {
      logger.warn('No installed apps found - waiting for user installation');
      return;
    }

    const firstApp = installedApps[0];
    const subService = getSubscriptionService();
    subService.setContext(firstApp.id, locations[0].locationId);

    // Store for future use
    await storeInstallation({
      installedAppId: firstApp.id,
      locationId: locations[0].locationId,
      timestamp: new Date().toISOString(),
    });

    logger.info('Subscription context initialized from API', {
      installedAppId: firstApp.id,
    });
  } catch (error) {
    logger.warn('Failed to initialize subscription context', { error });
  }
}
```

### Step 5: User Installation Instructions

**Add to `docs/SMARTAPP_SETUP.md`:**

```markdown
## Step 8: Install SmartApp via Mobile App

**After registering the SmartApp, users must install it:**

1. Open **SmartThings mobile app**
2. Go to **Automations** → **SmartApps**
3. Tap **"+ Add SmartApp"**
4. Find **"MCP SmartThings"** in the list
5. Tap **"Install"**
6. Grant **device permissions** when prompted
7. Confirm installation

**What happens:**
- SmartThings generates a unique `installedAppId`
- Sends **INSTALL lifecycle event** to your webhook
- Your server automatically creates **device subscriptions**
- Events start flowing to your webhook!

**Verify installation:**
```bash
# Check logs for INSTALL event
tail -f logs/combined.log | grep INSTALL

# Check subscription creation
tail -f logs/combined.log | grep "Subscriptions created"
```

---

## Troubleshooting

### "No events received after installation"

**Check:**
1. INSTALL lifecycle handler implemented?
2. Subscriptions created successfully? (check logs)
3. Webhook URL accessible from internet? (use ngrok)
4. HMAC signature verification passing? (check CLIENT_SECRET)

**Debug:**
```bash
# List subscriptions via API
curl -X GET "https://api.smartthings.com/v1/installedapps/{installedAppId}/subscriptions" \
  -H "Authorization: Bearer YOUR_PAT"
```

### "installedAppId not found"

**Likely causes:**
1. User hasn't installed SmartApp via mobile app yet
2. Installation failed silently
3. INSTALL webhook not processed correctly

**Solution:**
- Confirm user completed installation in mobile app
- Check webhook logs for INSTALL event
- Verify ngrok tunnel is active

### "Subscriptions fail to create"

**Check:**
1. Location ID correct?
2. InstalledAppId valid?
3. SmartApp has required scopes?

**Required scopes:**
```
r:devices:*
x:devices:*
r:locations:*
```

---

## Architecture Summary

```
User Mobile App              SmartThings Cloud           Your Server
───────────────              ─────────────────           ───────────

User installs app     →      Generate installedAppId

                             POST /webhook/smartthings   → INSTALL handler
                             ├─ lifecycle: INSTALL         ├─ Store installedAppId
                             ├─ installData:               ├─ setContext()
                             │  └─ installedApp:           └─ subscribeToDefaults()
                             │     ├─ installedAppId                ↓
                             │     └─ locationId          Create subscriptions:
                             └─ authToken                  - motionSensor
                                                           - contactSensor
                                                           - switch
                             ← 200 OK                      - switchLevel
                                                           - lock
Trigger motion sensor →      Device event                  - temperature

                             POST /webhook/smartthings   → EVENT handler
                             ├─ lifecycle: EVENT            ├─ Enqueue event
                             └─ eventData:                  ├─ Store in DB
                                └─ events: [...]            └─ Broadcast via SSE
                                                                     ↓
                             ← 200 OK                      Frontend receives
                                                           real-time update!
```

---

## Next Steps

**Choose your path:**

1. **Quick Test** (5 min):
   - Use Option 1 (Manual Setup)
   - Retrieve existing installedAppId
   - Create subscriptions manually
   - Test event flow

2. **Production Implementation** (30 min):
   - Use Option 2 (Proper Implementation)
   - Add INSTALL lifecycle handler
   - Add persistent storage
   - Document user installation process

**After events are working:**
- Monitor webhook logs for incoming events
- Test different device types (motion, contact, switch, etc.)
- Verify SSE broadcast to frontend
- Build UI features on top of real-time events

---

## Resources

- **Detailed Research**: `docs/research/smartapp-installation-research-2025-12-22.md`
- **SmartApp OAuth Setup**: `docs/SMARTAPP_SETUP.md`
- **SmartThings Lifecycles**: https://developer.smartthings.com/docs/connected-services/lifecycles
- **Subscriptions API**: https://developer.smartthings.com/docs/api/public#tag/Subscriptions

---

**Last Updated**: 2025-12-22
**Status**: Ready for implementation
