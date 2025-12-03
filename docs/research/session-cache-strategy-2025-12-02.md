# Session-Based Caching Strategy for Device and Room Data

**Date**: 2025-12-02
**Type**: Architecture Research
**Status**: Implementation Guidance
**Priority**: Medium (Performance Optimization)

---

## Executive Summary

Analysis of the current device and room data loading patterns reveals **repeated API calls on every component mount** with no caching mechanism. This research provides a comprehensive implementation strategy for session-based caching with Time-To-Live (TTL) to reduce API load and improve user experience.

**Key Findings:**
- **Current State**: No caching - every page navigation triggers fresh API calls
- **Load Frequency**: DeviceListContainer and RoomsGrid each call loadDevices()/loadRooms() on mount
- **Impact**: Unnecessary API load, slower perceived performance on navigation
- **Recommendation**: Implement sessionStorage-based cache with 5-minute TTL

---

## 1. Current Loading Patterns

### 1.1 Device Loading

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/deviceStore.svelte.ts`

**Current Pattern**:
```typescript
export async function loadDevices(): Promise<void> {
  loading = true;
  error = null;

  try {
    const result = await apiClient.getDevices();
    // ... process and update deviceMap
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load devices';
  } finally {
    loading = false;
  }
}
```

**Called From**:
1. **DeviceListContainer.svelte** (line 37): On component mount via `$effect()`
2. **devices/+page.svelte**: Indirectly via DeviceListContainer
3. **Error retry buttons**: Manual user-triggered refresh

**Frequency**: **Every navigation to /devices** triggers fresh API call

### 1.2 Room Loading

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/roomStore.svelte.ts`

**Current Pattern**:
```typescript
export async function loadRooms(): Promise<void> {
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/rooms');
    const result: RoomsResponse = await response.json();
    // ... process and update roomMap
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load rooms';
  } finally {
    loading = false;
  }
}
```

**Called From**:
1. **RoomsGrid.svelte** (line 32): On component mount via `onMount()`
2. **+page.svelte**: Indirectly via RoomsGrid
3. **Error retry buttons**: Manual user-triggered refresh

**Frequency**: **Every navigation to / (root/rooms)** triggers fresh API call

### 1.3 Performance Characteristics

**API Response Times** (estimated based on smart home APIs):
- **Devices API**: 200-500ms (depends on device count)
- **Rooms API**: 100-200ms (simpler data structure)

**User Navigation Patterns**:
- Frequent switching between Rooms → Devices → Automations
- Each switch = 2-3 API calls (devices + rooms for context)
- **Problem**: User navigating Rooms → Devices → Rooms = 4 API calls for same data

**Current State Management**:
- **In-memory only**: Data persists during session but reloads on navigation
- **No TTL**: No concept of "fresh" vs "stale" data
- **No invalidation**: Only manual refresh or component remount

---

## 2. Store Architecture Analysis

### 2.1 Device Store (Svelte 5 Runes)

**State Management**:
```typescript
// Primary state
let deviceMap = $state<Map<DeviceId, UnifiedDevice>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived state (auto-computed)
let devices = $derived(Array.from(deviceMap.values()));
let filteredDevices = $derived.by(() => { /* filtering logic */ });
let availableRooms = $derived.by(() => { /* unique rooms */ });
```

**Strengths**:
- ✅ Fine-grained reactivity with Svelte 5 runes
- ✅ O(1) device lookups with Map structure
- ✅ Efficient filtering with $derived (memoized)
- ✅ SSE integration for real-time updates

**Gaps for Caching**:
- ❌ No cache metadata (timestamp, TTL)
- ❌ No persistence layer (sessionStorage integration)
- ❌ No "skip load if fresh" logic

### 2.2 Room Store (Svelte 5 Runes)

**State Management**:
```typescript
// Primary state
let roomMap = $state<Map<string, Room>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived state
let rooms = $derived(
  Array.from(roomMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);
```

**Strengths**:
- ✅ Simple, focused API
- ✅ Sorted room list with $derived
- ✅ Device count tracking

**Gaps for Caching**:
- ❌ No cache metadata
- ❌ No persistence layer
- ❌ No staleness detection

---

## 3. Session Management Strategy

### 3.1 Cache Storage: sessionStorage

**Why sessionStorage over localStorage?**
- ✅ **Tab-scoped**: Different tabs get independent caches (prevents stale data across tabs)
- ✅ **Automatic cleanup**: Cleared on tab close (no manual cleanup needed)
- ✅ **Privacy**: Data doesn't persist across browser restarts
- ✅ **Size limit**: 5-10MB (more than enough for smart home data)

**Why NOT in-memory Map?**
- ❌ Lost on page refresh (worse UX)
- ❌ Lost on navigation if component unmounts

### 3.2 Cache Key Structure

**Format**: `smarthings:{dataType}:{version}`

**Keys**:
- `smarthings:devices:v1` - Device list cache
- `smarthings:rooms:v1` - Room list cache
- `smarthings:devices:meta:v1` - Device cache metadata
- `smarthings:rooms:meta:v1` - Room cache metadata

**Versioning Strategy**:
- Bump version (v1 → v2) on breaking schema changes
- Old cache automatically ignored (version mismatch)
- Enables safe schema migrations

### 3.3 Cache Metadata Structure

```typescript
interface CacheMetadata {
  timestamp: number;      // Unix timestamp (ms) when cached
  ttl: number;            // Time-to-live in milliseconds
  version: string;        // Cache schema version
  itemCount: number;      // Number of items cached
  checksum?: string;      // Optional integrity check
}
```

**Example**:
```json
{
  "timestamp": 1733184000000,
  "ttl": 300000,
  "version": "v1",
  "itemCount": 42
}
```

### 3.4 TTL Configuration

**Recommended TTL: 5 minutes (300,000ms)**

**Rationale**:
- **Smart home data changes infrequently**: Devices don't appear/disappear often
- **Real-time updates via SSE**: Device state changes handled by SSE, not polling
- **Balance freshness vs performance**: 5 min = good UX without stale data
- **Typical session duration**: Users navigate quickly within 5 min

**Alternative TTLs by Use Case**:
- **1 minute (60,000ms)**: High-churn environments (testing, development)
- **10 minutes (600,000ms)**: Stable production environments
- **30 minutes (1,800,000ms)**: Devices rarely added/removed

**Configurable via Environment**:
```typescript
const CACHE_TTL = import.meta.env.VITE_CACHE_TTL
  ? parseInt(import.meta.env.VITE_CACHE_TTL)
  : 300000; // Default 5 min
```

---

## 4. Cache Invalidation Scenarios

### 4.1 Time-based (TTL Expiration)

**Trigger**: Cache age exceeds TTL
**Action**: Fetch fresh data from API
**Implementation**:
```typescript
function isCacheValid(metadata: CacheMetadata): boolean {
  const now = Date.now();
  const age = now - metadata.timestamp;
  return age < metadata.ttl;
}
```

### 4.2 Manual Invalidation

**Trigger**: User clicks "Refresh" button
**Action**: Clear cache, force API fetch
**Implementation**:
```typescript
export function clearDeviceCache(): void {
  sessionStorage.removeItem('smarthings:devices:v1');
  sessionStorage.removeItem('smarthings:devices:meta:v1');
}
```

### 4.3 Mutation-based Invalidation

**Trigger**: User adds/removes device, changes room
**Action**: Invalidate affected cache
**Example**:
```typescript
// After device is turned on/off via SSE
// (State update via SSE, cache still valid)

// After device is ADDED/REMOVED
clearDeviceCache(); // Force refresh on next load
```

### 4.4 Version Mismatch

**Trigger**: Code deployed with new cache version
**Action**: Ignore old cache, fetch fresh data
**Implementation**:
```typescript
if (cachedMetadata.version !== CURRENT_VERSION) {
  // Old cache, ignore it
  return null;
}
```

### 4.5 Tab Lifecycle

**sessionStorage Behavior**:
- **New tab**: Fresh sessionStorage (new cache)
- **Page refresh**: sessionStorage persists (cache survives)
- **Tab close**: sessionStorage cleared automatically
- **Navigation**: sessionStorage persists within same tab

**No manual cleanup needed** - browser handles it

---

## 5. Implementation Strategy

### 5.1 Cache Utility Module

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/utils/cache.ts`

**Purpose**: Centralized cache logic for sessionStorage interaction

```typescript
/**
 * Session-based cache utility for smart home data
 *
 * Features:
 * - TTL-based expiration
 * - Version-aware caching
 * - Type-safe API
 * - Automatic cleanup on version mismatch
 */

const CACHE_VERSION = 'v1';
const DEFAULT_TTL = 300000; // 5 minutes

export interface CacheMetadata {
  timestamp: number;
  ttl: number;
  version: string;
  itemCount: number;
}

export interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

/**
 * Get cached data if valid, null otherwise
 *
 * @param key Cache key (e.g., 'smarthings:devices:v1')
 * @param ttl Time-to-live in milliseconds
 * @returns Cached data or null if invalid/expired
 */
export function getCache<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    const metaKey = `${key}:meta`;
    const metaCached = sessionStorage.getItem(metaKey);

    if (!cached || !metaCached) {
      return null;
    }

    const metadata: CacheMetadata = JSON.parse(metaCached);

    // Version check
    if (metadata.version !== CACHE_VERSION) {
      console.log(`[Cache] Version mismatch for ${key}, ignoring cache`);
      clearCache(key);
      return null;
    }

    // TTL check
    const now = Date.now();
    const age = now - metadata.timestamp;

    if (age > ttl) {
      console.log(`[Cache] Expired ${key} (age: ${age}ms, ttl: ${ttl}ms)`);
      clearCache(key);
      return null;
    }

    console.log(`[Cache] Hit ${key} (age: ${age}ms, ttl: ${ttl}ms)`);
    return JSON.parse(cached) as T;

  } catch (err) {
    console.error(`[Cache] Error reading ${key}:`, err);
    clearCache(key);
    return null;
  }
}

/**
 * Set cache with metadata
 *
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time-to-live in milliseconds
 */
export function setCache<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_TTL
): void {
  try {
    const metadata: CacheMetadata = {
      timestamp: Date.now(),
      ttl,
      version: CACHE_VERSION,
      itemCount: Array.isArray(data) ? data.length : 1
    };

    sessionStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem(`${key}:meta`, JSON.stringify(metadata));

    console.log(`[Cache] Set ${key} (items: ${metadata.itemCount}, ttl: ${ttl}ms)`);

  } catch (err) {
    console.error(`[Cache] Error writing ${key}:`, err);
    // Quota exceeded - clear old caches
    clearAllCaches();
  }
}

/**
 * Clear specific cache entry
 *
 * @param key Cache key
 */
export function clearCache(key: string): void {
  sessionStorage.removeItem(key);
  sessionStorage.removeItem(`${key}:meta`);
  console.log(`[Cache] Cleared ${key}`);
}

/**
 * Clear all smarthings caches
 */
export function clearAllCaches(): void {
  const keys = Object.keys(sessionStorage);
  const smartthingsKeys = keys.filter(k => k.startsWith('smarthings:'));

  smartthingsKeys.forEach(key => {
    sessionStorage.removeItem(key);
  });

  console.log(`[Cache] Cleared all caches (${smartthingsKeys.length} keys)`);
}

/**
 * Get cache statistics
 *
 * @returns Cache stats for debugging
 */
export function getCacheStats(): Record<string, any> {
  const keys = Object.keys(sessionStorage);
  const smartthingsKeys = keys.filter(k => k.startsWith('smarthings:') && !k.endsWith(':meta'));

  const stats: Record<string, any> = {};

  smartthingsKeys.forEach(key => {
    try {
      const metaKey = `${key}:meta`;
      const metaCached = sessionStorage.getItem(metaKey);

      if (metaCached) {
        const metadata: CacheMetadata = JSON.parse(metaCached);
        const age = Date.now() - metadata.timestamp;
        const remaining = metadata.ttl - age;

        stats[key] = {
          itemCount: metadata.itemCount,
          age: Math.floor(age / 1000), // seconds
          ttl: Math.floor(metadata.ttl / 1000), // seconds
          remaining: Math.floor(remaining / 1000), // seconds
          valid: remaining > 0,
          version: metadata.version
        };
      }
    } catch (err) {
      stats[key] = { error: 'Failed to read metadata' };
    }
  });

  return stats;
}
```

### 5.2 Enhanced Device Store

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/deviceStore.svelte.ts`

**Changes**:

```typescript
import { getCache, setCache, clearCache } from '$lib/utils/cache';

const CACHE_KEY = 'smarthings:devices:v1';
const CACHE_TTL = 300000; // 5 minutes

/**
 * Load devices from API with session caching
 *
 * Flow:
 * 1. Check sessionStorage cache
 * 2. If valid (not expired), use cached data
 * 3. Otherwise, fetch from API and cache
 */
export async function loadDevices(forceRefresh: boolean = false): Promise<void> {
  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    const cachedDevices = getCache<UnifiedDevice[]>(CACHE_KEY, CACHE_TTL);

    if (cachedDevices) {
      console.log('[DeviceStore] Using cached devices:', cachedDevices.length);

      // Update store from cache
      const newDeviceMap = new Map<DeviceId, UnifiedDevice>();
      cachedDevices.forEach((device) => {
        const normalizedDevice = {
          ...device,
          id: device.deviceId || device.id,
          room: device.roomName || device.room
        };
        newDeviceMap.set(normalizedDevice.id, normalizedDevice);
      });

      deviceMap = newDeviceMap;
      loading = false;
      return; // Early return with cached data
    }
  }

  // Cache miss or forced refresh - fetch from API
  loading = true;
  error = null;

  try {
    const result = await apiClient.getDevices();

    if (result.success) {
      const devices = result.data.devices || result.data;

      // Update store
      const newDeviceMap = new Map<DeviceId, UnifiedDevice>();
      devices.forEach((device) => {
        const normalizedDevice = {
          ...device,
          id: device.deviceId || device.id,
          room: device.roomName || device.room
        };
        newDeviceMap.set(normalizedDevice.id, normalizedDevice);
      });

      deviceMap = newDeviceMap;

      // Cache the fresh data
      setCache(CACHE_KEY, devices, CACHE_TTL);

    } else {
      error = result.error.message;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load devices';
  } finally {
    loading = false;
  }
}

/**
 * Clear device cache and force refresh
 *
 * Use cases:
 * - User clicks "Refresh" button
 * - Device added/removed (mutation)
 */
export function refreshDevices(): Promise<void> {
  clearCache(CACHE_KEY);
  return loadDevices(true);
}
```

**Key Changes**:
1. **Added `forceRefresh` parameter** to skip cache
2. **Check cache first** before API call
3. **Cache successful API responses** with TTL
4. **New `refreshDevices()` function** for manual refresh

### 5.3 Enhanced Room Store

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/roomStore.svelte.ts`

**Changes**:

```typescript
import { getCache, setCache, clearCache } from '$lib/utils/cache';

const CACHE_KEY = 'smarthings:rooms:v1';
const CACHE_TTL = 300000; // 5 minutes

/**
 * Load rooms from API with session caching
 */
export async function loadRooms(forceRefresh: boolean = false): Promise<void> {
  // Check cache first
  if (!forceRefresh) {
    const cachedRooms = getCache<Room[]>(CACHE_KEY, CACHE_TTL);

    if (cachedRooms) {
      console.log('[RoomStore] Using cached rooms:', cachedRooms.length);

      const newRoomMap = new Map<string, Room>();
      cachedRooms.forEach((room) => {
        newRoomMap.set(room.roomId, room);
      });

      roomMap = newRoomMap;
      loading = false;
      return;
    }
  }

  // Cache miss or forced refresh
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/rooms');
    const result: RoomsResponse = await response.json();

    if (result.success) {
      const newRoomMap = new Map<string, Room>();
      result.data.rooms.forEach((room) => {
        newRoomMap.set(room.roomId, room);
      });

      roomMap = newRoomMap;

      // Cache the fresh data
      setCache(CACHE_KEY, result.data.rooms, CACHE_TTL);

    } else {
      error = result.error?.message ?? 'Failed to load rooms';
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load rooms';
  } finally {
    loading = false;
  }
}

/**
 * Clear room cache and force refresh
 */
export function refreshRooms(): Promise<void> {
  clearCache(CACHE_KEY);
  return loadRooms(true);
}
```

### 5.4 Component Integration

**DeviceListContainer.svelte** (no changes needed):
```svelte
<script>
  import { getDeviceStore } from '$lib/stores/deviceStore.svelte';

  const store = getDeviceStore();

  $effect(() => {
    // Will use cache if available
    store.loadDevices();

    const cleanup = connectDeviceSSE(store);
    return cleanup;
  });
</script>
```

**RoomsGrid.svelte** (no changes needed):
```svelte
<script>
  import { getRoomStore } from '$lib/stores/roomStore.svelte';

  const roomStore = getRoomStore();

  onMount(async () => {
    // Will use cache if available
    await roomStore.loadRooms();
  });
</script>
```

**Refresh Buttons** (update to use new API):
```svelte
<!-- Before -->
<button onclick={() => store.loadDevices()}>Refresh</button>

<!-- After -->
<button onclick={() => store.refreshDevices()}>Refresh</button>
```

### 5.5 Cache Statistics Component (Optional)

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/debug/CacheStats.svelte`

**Purpose**: Debug component to inspect cache state

```svelte
<script lang="ts">
  import { getCacheStats, clearAllCaches } from '$lib/utils/cache';

  let stats = $state(getCacheStats());

  function refresh() {
    stats = getCacheStats();
  }

  function clearAll() {
    clearAllCaches();
    stats = getCacheStats();
  }
</script>

<div class="cache-stats">
  <h3>Cache Statistics</h3>

  <button onclick={refresh}>Refresh Stats</button>
  <button onclick={clearAll}>Clear All Caches</button>

  <pre>{JSON.stringify(stats, null, 2)}</pre>
</div>
```

**Usage**: Add `?debug=cache` to URL to show stats

---

## 6. Fallback Behavior

### 6.1 sessionStorage Unavailable

**Scenario**: Browser has cookies/storage disabled

**Handling**:
```typescript
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// In cache.ts
export function getCache<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  if (!isStorageAvailable()) {
    console.warn('[Cache] sessionStorage not available, skipping cache');
    return null; // Always fetch from API
  }

  // ... rest of cache logic
}
```

### 6.2 Quota Exceeded

**Scenario**: sessionStorage full (5-10MB limit exceeded)

**Handling**:
```typescript
export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  try {
    // ... cache write logic
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      console.warn('[Cache] Quota exceeded, clearing old caches');
      clearAllCaches(); // Clear everything

      try {
        // Retry write after cleanup
        sessionStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem(`${key}:meta`, JSON.stringify(metadata));
      } catch (retryErr) {
        console.error('[Cache] Failed to write even after cleanup');
      }
    }
  }
}
```

### 6.3 Corrupted Cache Data

**Scenario**: JSON.parse() fails on cached data

**Handling**:
```typescript
export function getCache<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    // ... JSON.parse(cached)
  } catch (err) {
    console.error(`[Cache] Corrupted data for ${key}, clearing:`, err);
    clearCache(key);
    return null; // Fetch fresh data from API
  }
}
```

---

## 7. Performance Impact Analysis

### 7.1 Expected Performance Gains

**Metrics**:

| Scenario | Without Cache | With Cache (Hit) | Improvement |
|----------|---------------|------------------|-------------|
| Navigate to /devices | 300ms (API) | ~5ms (sessionStorage) | **60x faster** |
| Navigate to / (rooms) | 150ms (API) | ~3ms (sessionStorage) | **50x faster** |
| Refresh page | 300ms + 150ms | ~8ms | **56x faster** |
| Back/Forward navigation | 300ms | ~5ms | **60x faster** |

**Cache Hit Rate** (estimated):
- First load: 0% (no cache)
- Same session navigation: **80-90%** hit rate
- After TTL expiration: 0% (fresh fetch)

### 7.2 Memory Overhead

**sessionStorage Size**:
- 50 devices × 2KB each = **100KB**
- 10 rooms × 500B each = **5KB**
- Total: ~105KB (well within 5MB limit)

**Browser Memory**:
- Negligible (sessionStorage stored separately)
- No impact on JavaScript heap

### 7.3 Network Savings

**API Calls Saved** (5-minute window):
- User navigates 10 times: **9 API calls saved** (90% reduction)
- Multiple users: 90% reduction in /api/devices load
- Server cost savings: Proportional to API call reduction

---

## 8. Testing Strategy

### 8.1 Unit Tests

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/utils/cache.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getCache, setCache, clearCache, clearAllCaches } from './cache';

describe('Cache Utility', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should store and retrieve data', () => {
    const data = { id: '123', name: 'Test Device' };
    setCache('test-key', data, 60000);

    const retrieved = getCache('test-key', 60000);
    expect(retrieved).toEqual(data);
  });

  it('should return null for expired cache', async () => {
    const data = { id: '123' };
    setCache('test-key', data, 100); // 100ms TTL

    await new Promise(resolve => setTimeout(resolve, 150)); // Wait 150ms

    const retrieved = getCache('test-key', 100);
    expect(retrieved).toBeNull();
  });

  it('should ignore version mismatch', () => {
    // Manually set old version
    sessionStorage.setItem('test-key', JSON.stringify({ id: '123' }));
    sessionStorage.setItem('test-key:meta', JSON.stringify({
      timestamp: Date.now(),
      ttl: 60000,
      version: 'v0', // Old version
      itemCount: 1
    }));

    const retrieved = getCache('test-key', 60000);
    expect(retrieved).toBeNull();
  });

  it('should clear specific cache', () => {
    setCache('key1', { data: 1 }, 60000);
    setCache('key2', { data: 2 }, 60000);

    clearCache('key1');

    expect(getCache('key1', 60000)).toBeNull();
    expect(getCache('key2', 60000)).not.toBeNull();
  });

  it('should clear all smarthings caches', () => {
    setCache('smarthings:devices:v1', [], 60000);
    setCache('smarthings:rooms:v1', [], 60000);
    setCache('other:cache', [], 60000);

    clearAllCaches();

    expect(getCache('smarthings:devices:v1', 60000)).toBeNull();
    expect(getCache('smarthings:rooms:v1', 60000)).toBeNull();
    expect(getCache('other:cache', 60000)).not.toBeNull(); // Other caches untouched
  });
});
```

### 8.2 Integration Tests

**Scenario 1**: Navigate Rooms → Devices → Rooms
```typescript
test('should use cache on back navigation', async () => {
  // 1. Load rooms (API call)
  await roomStore.loadRooms();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // 2. Navigate to devices
  // 3. Navigate back to rooms (should use cache)
  await roomStore.loadRooms();
  expect(fetchMock).toHaveBeenCalledTimes(1); // No additional API call
});
```

**Scenario 2**: Refresh button clears cache
```typescript
test('refresh button should clear cache and fetch fresh data', async () => {
  // 1. Load devices (API call + cache)
  await deviceStore.loadDevices();

  // 2. Load again (cache hit)
  await deviceStore.loadDevices();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // 3. Refresh (force fresh fetch)
  await deviceStore.refreshDevices();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
```

### 8.3 Manual Testing Checklist

- [ ] Navigate Rooms → Devices → Rooms (verify cache hit in console)
- [ ] Wait 6 minutes, navigate again (verify cache miss, fresh API call)
- [ ] Click "Refresh" button (verify forced API call)
- [ ] Open DevTools → Application → Session Storage (verify cache keys)
- [ ] Refresh page (verify cache persists)
- [ ] Close tab, reopen (verify new cache, old one cleared)
- [ ] Disable sessionStorage (verify graceful degradation)

---

## 9. Migration Path

### Phase 1: Add Cache Utility (Week 1)
1. Create `/web/src/lib/utils/cache.ts`
2. Add unit tests
3. No user-facing changes yet

### Phase 2: Integrate with Device Store (Week 2)
1. Update `deviceStore.svelte.ts` with cache logic
2. Add `refreshDevices()` function
3. Update "Refresh" buttons in DeviceListContainer

### Phase 3: Integrate with Room Store (Week 2)
1. Update `roomStore.svelte.ts` with cache logic
2. Add `refreshRooms()` function
3. Update "Refresh" buttons in RoomsGrid

### Phase 4: Testing & Monitoring (Week 3)
1. Integration testing
2. Monitor cache hit rates (console logs)
3. Adjust TTL based on real usage patterns

### Phase 5: Optional Enhancements (Future)
1. Add cache statistics component
2. Add user preference for cache TTL
3. Add cache preloading on app init
4. Add cache warming (background refresh before expiry)

---

## 10. Risks & Mitigation

### Risk 1: Stale Data After Device Changes

**Problem**: User adds device in SmartThings app, but web UI shows old cached data

**Mitigation**:
- ✅ **SSE updates handle state changes** (on/off, brightness) - cache still valid
- ✅ **Mutation operations clear cache** (if we implement add/remove device)
- ✅ **Manual refresh button** always available
- ✅ **5-minute TTL** ensures max staleness bounded

### Risk 2: sessionStorage Quota Exceeded

**Problem**: Large device list (>1000 devices) exceeds 5MB sessionStorage limit

**Mitigation**:
- ✅ **Automatic cleanup on QuotaExceededError**
- ✅ **Smart home device lists rarely exceed 100-200 devices**
- ✅ **Graceful degradation** (fall back to API-only mode)

### Risk 3: Multiple Tabs Inconsistency

**Problem**: User has 2 tabs open, changes device in Tab 1, Tab 2 shows stale cache

**Mitigation**:
- ✅ **sessionStorage is tab-scoped** (each tab has independent cache)
- ✅ **User expects different tabs to be independent**
- ✅ **Refresh button** available in each tab

---

## 11. Implementation Files Summary

**New Files**:
1. `/web/src/lib/utils/cache.ts` - Cache utility module
2. `/web/src/lib/utils/cache.test.ts` - Unit tests
3. `/web/src/lib/components/debug/CacheStats.svelte` - (Optional) Debug component

**Modified Files**:
1. `/web/src/lib/stores/deviceStore.svelte.ts` - Add cache integration
2. `/web/src/lib/stores/roomStore.svelte.ts` - Add cache integration
3. `/web/src/lib/components/devices/DeviceListContainer.svelte` - Update refresh button
4. `/web/src/lib/components/rooms/RoomsGrid.svelte` - Update refresh button

**No Changes Required**:
- Component mount logic (`$effect`, `onMount`) - works automatically
- SSE integration - independent of cache
- API client - no changes needed

---

## 12. Conclusion

### Summary

**Current State**: No caching, every navigation triggers fresh API calls

**Proposed Solution**: sessionStorage-based cache with 5-minute TTL

**Expected Impact**:
- ✅ **60x faster** page navigation (300ms → 5ms)
- ✅ **90% reduction** in API calls for typical session
- ✅ **Better UX** - instant navigation
- ✅ **Lower server load** - fewer API requests
- ✅ **Minimal complexity** - ~200 lines of code

**Risks**: Low (graceful degradation, bounded staleness)

**Effort**: 2-3 weeks (design, implement, test)

### Recommended Next Steps

1. **Review & Approve**: Discuss TTL duration with team
2. **Implement Cache Utility**: Create core caching module
3. **Integrate with Stores**: Add cache checks to loadDevices/loadRooms
4. **Test Thoroughly**: Unit tests + integration tests
5. **Monitor Performance**: Track cache hit rates in production
6. **Iterate**: Adjust TTL based on real usage patterns

---

**End of Research**
