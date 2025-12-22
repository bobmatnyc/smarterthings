# SSE Connection Status Reactivity Fix

**Date**: 2025-12-21
**Component**: `web/src/lib/components/layout/ConnectionStatus.svelte`
**Issue**: Svelte 5 runes reactivity not tracking module-level state changes via getters

---

## Problem Statement

The ConnectionStatus component showed "Reconnecting..." even when the SSE connection was successfully established. Console logs confirmed connection success (`[SSE] Connected to device event stream`), but the UI state wasn't updating.

## Root Cause

**Svelte 5 `$derived()` doesn't track getter changes when the getter returns module-level `$state`.**

### Code Flow

1. **State Definition** (`deviceStore.svelte.ts` line 67):
   ```typescript
   let sseConnected = $state(false); // Module-level state
   ```

2. **Getter Export** (`deviceStore.svelte.ts` line 579):
   ```typescript
   export function getDeviceStore() {
     return {
       get sseConnected() {
         return sseConnected; // Returns module-level $state
       },
       setSSEConnected, // Function to update state
       // ...
     };
   }
   ```

3. **State Update** (`deviceStream.svelte.ts` line 78):
   ```typescript
   eventSource.onopen = () => {
     console.log('[SSE] Connected to device event stream');
     store.setSSEConnected(true); // Updates module-level state
     reconnectAttempts = 0;
     lastHeartbeat = Date.now();
   };
   ```

4. **State Read - BROKEN** (`ConnectionStatus.svelte` line 30):
   ```svelte
   let connected = $derived(deviceStore.sseConnected); // ❌ Doesn't track changes
   ```

### Why It Failed

- `$derived(expression)` evaluates the expression **once** during component initialization
- `deviceStore.sseConnected` is a **getter function** that returns module-level state
- When `setSSEConnected(true)` updates the module-level state, `$derived` doesn't re-evaluate
- Different component instances (`DeviceListContainer` initializes SSE, `ConnectionStatus` displays status) don't share reactivity scope

## Solution

Use `$derived.by()` to create a **reactive function** that re-evaluates on dependency changes:

```diff
- let connected = $derived(deviceStore.sseConnected);
+ let connected = $derived.by(() => deviceStore.sseConnected);
```

### Why This Works

- `$derived.by(() => ...)` accepts a **function** that is re-evaluated on dependency changes
- The function **re-calls the getter** each time, establishing proper reactivity tracking
- Svelte's compiler tracks all reactive dependencies within the function
- Creates reactive chain: `module $state` → `getter` → `$derived.by()` → `component render`

## Technical Deep Dive

### Svelte 5 Runes Reactivity Model

**Reactive Primitives:**
- `$state(value)` - Creates reactive state
- `$derived(expression)` - Computes derived value **once**
- `$derived.by(() => ...)` - Computes derived value **reactively**

**Key Insight:**
```svelte
// ❌ Expression evaluated once at initialization
let value = $derived(store.getter);

// ✅ Function re-evaluated on dependency changes
let value = $derived.by(() => store.getter);
```

**When to Use Which:**
- `$derived(expr)` - For expressions with direct reactive dependencies (local `$state`, `$props`)
- `$derived.by(() => ...)` - For getters, function calls, or cross-module reactivity

### Module-Level State Pattern

**Pattern**: Module-level `$state` with getter/setter functions

```typescript
// store.svelte.ts
let count = $state(0); // Module-level state

export function getStore() {
  return {
    get count() { return count; },      // Getter
    increment: () => { count++; },      // Setter
  };
}
```

**Component Usage**:
```svelte
<script>
  const store = getStore();

  // ❌ WRONG - Doesn't track changes
  let value = $derived(store.count);

  // ✅ CORRECT - Tracks changes
  let value = $derived.by(() => store.count);
</script>
```

## Files Changed

### Primary Fix

**File**: `web/src/lib/components/layout/ConnectionStatus.svelte`

**Change**:
```diff
@@ -27,7 +27,10 @@
 	const deviceStore = getDeviceStore();

 	// Reactive connection status from device store
-	let connected = $derived(deviceStore.sseConnected);
+	// FIX: Use $derived.by() to properly track getter changes across component boundaries
+	// The getter deviceStore.sseConnected returns module-level $state, which requires
+	// explicit reactivity tracking in Svelte 5 when accessed from a different component
+	let connected = $derived.by(() => deviceStore.sseConnected);

 	// Derive status for display
 	let status = $derived(connected ? 'connected' : 'reconnecting');
```

### Documentation

- `docs/qa/SSE-CONNECTION-STATUS-BUG-FIX-2025-12-21.md` - Detailed bug analysis
- `docs/implementation/SSE-CONNECTION-STATUS-REACTIVITY-FIX.md` - This document

### Tests

- `tests/unit/web/components/ConnectionStatus.test.ts` - Unit tests for reactivity

## Verification

### Manual Testing

1. **Start dev servers**: `bash scripts/dev-start.sh`
2. **Open browser**: http://localhost:5181
3. **Observe SubNav**: Should show "Reconnecting..." → "Connected" (1-2 seconds)
4. **Restart backend**: Stop/start backend server
5. **Verify reconnect**: "Connected" → "Reconnecting..." → "Connected"

### Expected Behavior

**Initial Load:**
```
[SSE] Connected to device event stream
[SSE] Connection acknowledged: 2025-12-22T00:03:47.256Z
```
UI: "Reconnecting..." → "Connected" (green badge, pulsing dot)

**Backend Restart:**
```
[SSE] Connection error: ...
[SSE] Reconnecting in 1000ms (attempt 1/10)
[SSE] Connected to device event stream
```
UI: "Connected" → "Reconnecting..." → "Connected"

### Automated Testing

```bash
# Run unit tests
pnpm test tests/unit/web/components/ConnectionStatus.test.ts

# Expected: All tests pass
# - Renders with "Reconnecting..." when disconnected
# - Renders with "Connected" when connected
# - Updates reactively on state changes
# - Has proper accessibility attributes
# - Handles rapid connect/disconnect cycles
```

## Performance Impact

- **No measurable overhead**: `$derived.by()` is compiler-optimized
- **Fine-grained updates**: Only ConnectionStatus component re-renders on state change
- **Efficient reactivity**: Svelte tracks minimal dependency set

## Lessons Learned

### Svelte 5 Best Practices

1. **Module-Level State + Getters**: Always use `$derived.by()` when accessing module-level `$state` via getters from different components
2. **Getter Reactivity**: `$derived(getter)` captures value once; `$derived.by(() => getter)` re-evaluates on changes
3. **Cross-Component State**: Shared state across component trees requires explicit reactivity tracking

### When to Use `$derived.by()`

✅ **Use `$derived.by()`:**
- Getters returning module-level `$state`
- Function calls with side effects
- Cross-component reactive state
- Complex computed values needing re-evaluation

❌ **Don't need `$derived.by()`:**
- Local component `$state` (direct reactivity)
- `$props` (automatically reactive)
- Simple expressions with direct dependencies

## Related Issues

- **Ticket**: SSE-CONNECTION-STATUS-BUG-2025-12-21
- **Sprint**: 1.2 - UI Enhancements
- **Priority**: High (user-facing bug)
- **Complexity**: Low (single line change)

## References

- [Svelte 5 Runes RFC](https://github.com/sveltejs/rfcs/blob/master/text/0000-runes.md)
- [Svelte 5 $derived Documentation](https://svelte-5-preview.vercel.app/docs/runes#$derived)
- [Module-Level State Pattern](https://svelte.dev/docs/svelte/state#How-do-I-use-external-stores-in-Svelte-5)

---

**Status**: ✅ Fixed and Verified
**Impact**: Improved UX - Real-time connection status now works correctly
**Testing**: Manual verification + Unit tests added
**Performance**: No degradation
