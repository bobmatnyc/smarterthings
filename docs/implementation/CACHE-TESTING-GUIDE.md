# Cache Testing Guide

Quick guide to verify the session-based caching is working correctly.

## Quick Test (2 minutes)

### 1. Open Browser DevTools Console
- Open Chrome DevTools (F12 or Cmd+Option+I)
- Go to Console tab
- Set log level to "Verbose" (shows debug messages)

### 2. First Load (Cache Miss)
Navigate to `/devices` page

**Expected Console Output:**
```
[Cache] Miss: smartthings:devices:v1
[DeviceStore] Fetching devices from API...
[Cache] Set: smartthings:devices:v1 (ttl: 300000ms)
[DeviceStore] Cached 47 devices
```

**Network Tab:**
- Should see request to `/api/devices`
- Response time: ~300ms

### 3. Second Load (Cache Hit)
Navigate away (e.g., to `/`) and then back to `/devices`

**Expected Console Output:**
```
[Cache] Hit: smartthings:devices:v1 (age: 2345ms)
[DeviceStore] Loaded 47 devices from cache
```

**Network Tab:**
- Should NOT see request to `/api/devices`
- Page load: ~8ms (60x faster!)

### 4. Force Refresh (Optional)
Add a refresh button to test manual cache clearing:

```svelte
<script>
  import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
  const store = getDeviceStore();

  async function handleRefresh() {
    await store.refreshDevices();
  }
</script>

<button onclick={handleRefresh}>Force Refresh</button>
```

**Expected Console Output:**
```
[DeviceStore] Force refreshing devices (clearing cache)...
[Cache] Cleared: smartthings:devices:v1
[DeviceStore] Fetching devices from API...
[DeviceStore] Cached 47 devices
```

## Verify Cache Statistics

### In Browser Console:
```javascript
// Get cache stats
import { getCacheStats } from '$lib/utils/cache';
console.table(getCacheStats().entries);
```

**Expected Output:**
```
┌─────────────────────────────┬──────────┬────────┬──────────┐
│           (index)           │   size   │  age   │ expired  │
├─────────────────────────────┼──────────┼────────┼──────────┤
│ smartthings:devices:v1      │ 15.24 KB │  2.5s  │  false   │
│ smartthings:rooms:v1        │  1.89 KB │  2.6s  │  false   │
└─────────────────────────────┴──────────┴────────┴──────────┘
```

### Inspect sessionStorage Directly:
```javascript
// View raw cache entry
sessionStorage.getItem('smartthings:devices:v1')

// Pretty print
JSON.parse(sessionStorage.getItem('smartthings:devices:v1'))
```

**Expected Structure:**
```json
{
  "data": [...], // Array of devices
  "timestamp": 1701234567890,
  "ttl": 300000,
  "version": "v1"
}
```

## Performance Comparison

### Before Caching (No Cache)
```javascript
performance.mark('start');
await fetch('/api/devices');
performance.mark('end');
performance.measure('api-call', 'start', 'end');
// Result: ~300ms
```

### After Caching (Cache Hit)
```javascript
performance.mark('start');
getCache('smartthings:devices:v1');
performance.mark('end');
performance.measure('cache-hit', 'start', 'end');
// Result: ~5ms (60x faster!)
```

## Test Scenarios

### ✅ Scenario 1: Normal Navigation (Cache Works)
1. Go to `/devices` (loads from API, caches)
2. Go to `/` (home page)
3. Go back to `/devices` (loads from cache)
4. **Verify:** No network request, instant load

### ✅ Scenario 2: Multiple Tabs (Isolated Caches)
1. Open Tab 1: `/devices` (API call, cache Tab 1)
2. Open Tab 2: `/devices` (API call, cache Tab 2)
3. **Verify:** Each tab has separate cache

### ✅ Scenario 3: Cache Expiration (TTL)
1. Load `/devices` (cache populated)
2. Wait 5 minutes
3. Reload `/devices`
4. **Verify:** Console shows "Expired", new API call

### ✅ Scenario 4: Private Browsing (Graceful Degradation)
1. Open incognito/private window
2. Go to `/devices`
3. **Verify:**
   - Console: `[Cache] sessionStorage unavailable`
   - App still works (no caching)

### ✅ Scenario 5: Version Mismatch (Auto-Clear)
1. Load `/devices` (cache populated)
2. Manually edit cache version in console:
   ```javascript
   const cached = JSON.parse(sessionStorage.getItem('smartthings:devices:v1'));
   cached.version = 'v0';
   sessionStorage.setItem('smartthings:devices:v1', JSON.stringify(cached));
   ```
3. Reload `/devices`
4. **Verify:** Console shows "Version mismatch", cache cleared

## Debugging Commands

### Clear All Caches
```javascript
import { clearAllCaches } from '$lib/utils/cache';
clearAllCaches();
```

### Clear Specific Cache
```javascript
import { clearCache, CACHE_KEYS } from '$lib/utils/cache';
clearCache(CACHE_KEYS.DEVICES);
clearCache(CACHE_KEYS.ROOMS);
```

### Check if Cache Exists
```javascript
import { getCache } from '$lib/utils/cache';
const devices = getCache('smartthings:devices:v1');
console.log(devices ? 'Cache exists' : 'No cache');
```

### Force Cache Miss (Testing)
```javascript
// Clear cache before test
sessionStorage.removeItem('smartthings:devices:v1');
```

## Expected Performance Metrics

| Metric | No Cache | Cache Hit | Improvement |
|--------|----------|-----------|-------------|
| Device Load | 300ms | 5ms | 60x |
| Room Load | 150ms | 3ms | 50x |
| Total | 450ms | 8ms | 56x |

## Troubleshooting

### Issue: Cache not being used
**Check:**
1. Console for `[Cache] Miss` messages
2. Verify `forceRefresh` not set to `true`
3. Check TTL hasn't expired (5 minutes)
4. Verify sessionStorage available (not private browsing)

### Issue: Stale data in cache
**Solution:**
```javascript
// Force refresh to get latest data
import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
const store = getDeviceStore();
await store.refreshDevices();
```

### Issue: Cache quota exceeded
**Check console for:**
```
[Cache] Quota exceeded, clearing old caches
```
**This is normal** - cache auto-cleans and retries.

### Issue: Console spam
**Reduce log level:**
- Chrome DevTools → Console → Default levels (hides debug)
- Or remove `console.debug()` calls in production build

## Production Deployment Notes

1. **Cache is automatic** - no config needed
2. **TTL is 5 minutes** - adjust `DEFAULT_TTL` if needed
3. **Storage limit: 5MB** - current usage ~20KB (safe)
4. **No cleanup required** - sessionStorage auto-clears on tab close
5. **Version bumping** - increment `CACHE_VERSION` to invalidate all caches

## Success Criteria

- ✅ First page load: Shows API call
- ✅ Second page load: No API call, instant
- ✅ Console logs: Clear cache hit/miss messages
- ✅ Performance: 50-60x improvement for cache hits
- ✅ Tab isolation: Each tab has separate cache
- ✅ Graceful degradation: Works without sessionStorage
- ✅ Auto-expiration: Clears after 5 minutes

---

**Caching is working if:**
- Page loads in ~8ms on repeat visits
- No network requests for cached data
- Console shows `[Cache] Hit` messages
- User experience feels instant
