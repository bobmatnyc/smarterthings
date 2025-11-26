/**
 * Device state cache with race condition prevention.
 *
 * Provides TTL-based caching of device states with:
 * - In-flight request tracking (race condition fix)
 * - Event-driven invalidation
 * - Memory usage monitoring
 * - Cache pruning for large device counts
 * - LRU eviction policy
 *
 * Critical Fix from Code Review:
 * - Added inFlightRequests map to track concurrent requests
 * - Prevents duplicate API calls for same device
 * - Ensures only one refresh per device at a time
 *
 * Design Principles:
 * - Thread-safe: Concurrent access handled correctly
 * - Memory-bounded: LRU eviction prevents unbounded growth
 * - Event-driven: Auto-invalidate on state changes
 * - Observable: Metrics for monitoring cache effectiveness
 *
 * @module utils/DeviceStateCache
 */

import type { EventEmitter } from 'events';
import type { UniversalDeviceId } from '../types/unified-device.js';
import type { DeviceState } from '../types/device-state.js';
import type {
  CachedState,
  StateCacheConfig,
  StateCacheMetrics,
  StateChangeEvent,
} from '../types/device-state.js';

/**
 * Device state cache manager.
 *
 * Responsibilities:
 * - Cache device states with TTL
 * - Prevent duplicate concurrent requests (race condition fix)
 * - Invalidate cache on state changes
 * - Emit events on state changes
 * - Monitor cache effectiveness
 * - Enforce memory limits via LRU eviction
 *
 * Critical Fix from Code Review:
 * ✅ In-flight request tracking prevents race conditions
 * ✅ Multiple concurrent calls for same device return same Promise
 * ✅ Cleanup on completion ensures no memory leaks
 */
export class DeviceStateCache {
  /** Cached device states with metadata */
  private cache: Map<UniversalDeviceId, CachedState> = new Map();

  /**
   * In-flight refresh requests.
   *
   * ✅ CRITICAL FIX from code review:
   * Tracks ongoing refresh operations to prevent duplicate API calls.
   *
   * When multiple callers request same device state simultaneously:
   * 1. First caller triggers refresh, adds Promise to map
   * 2. Subsequent callers receive same Promise
   * 3. All callers wait for same refresh operation
   * 4. Promise removed from map on completion (success or failure)
   *
   * This prevents race conditions where:
   * - Multiple API calls for same device
   * - Cache thrashing from concurrent updates
   * - Wasted network resources
   */
  private inFlightRequests: Map<UniversalDeviceId, Promise<DeviceState>> =
    new Map();

  /** Cache access order for LRU eviction */
  private accessOrder: UniversalDeviceId[] = [];

  /** Cache metrics for monitoring */
  private metrics: StateCacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    invalidations: 0,
    evictions: 0,
    currentSize: 0,
    peakSize: 0,
    averageAge: 0,
    oldestAge: 0,
  };

  /** Configuration */
  private readonly config: Required<StateCacheConfig>;

  /**
   * Create device state cache.
   *
   * @param adapter Adapter that will refresh states
   * @param config Cache configuration (optional)
   */
  constructor(
    private adapter: { refreshDeviceState: (deviceId: string) => Promise<DeviceState> } & EventEmitter,
    config?: Partial<StateCacheConfig>
  ) {
    // Apply defaults
    this.config = {
      ttl: config?.ttl ?? 60_000, // 60 seconds
      maxSize: config?.maxSize ?? 1000,
      enableMetrics: config?.enableMetrics ?? true,
      autoInvalidateOnChange: config?.autoInvalidateOnChange ?? true,
    };

    // Auto-invalidate on state changes if enabled
    if (this.config.autoInvalidateOnChange) {
      this.adapter.on('stateChange', (event: StateChangeEvent) => {
        this.invalidate(event.deviceId);
      });
    }
  }

  /**
   * Get device state from cache or refresh if missing/expired.
   *
   * ✅ CRITICAL FIX: In-flight request tracking prevents race conditions
   *
   * Race Condition Scenario (BEFORE FIX):
   * - Request 1: Cache miss → starts API call A
   * - Request 2: Cache miss (A not done) → starts API call B
   * - Result: Two API calls for same device
   *
   * Fixed Behavior (AFTER FIX):
   * - Request 1: Cache miss → starts API call A, stores Promise
   * - Request 2: Cache miss → finds in-flight Promise A, waits for it
   * - Result: One API call, both requests satisfied
   *
   * @param deviceId Device to get state for
   * @returns Device state (cached or fresh)
   */
  async get(deviceId: UniversalDeviceId): Promise<DeviceState> {
    // Check cache first
    const cached = this.cache.get(deviceId);
    const now = Date.now();

    // Return cached if fresh
    if (cached && now < cached.expiresAt.getTime()) {
      // Update metrics and access order
      if (this.config.enableMetrics) {
        this.metrics.hits++;
        this.updateHitRate();
        cached.hitCount++;
      }
      this.updateAccessOrder(deviceId);

      return cached.state;
    }

    // ✅ CRITICAL FIX: Check for in-flight request
    const inFlight = this.inFlightRequests.get(deviceId);
    if (inFlight) {
      // Another request is already refreshing this device
      // Wait for it instead of starting a new request
      return inFlight;
    }

    // Cache miss - need to refresh
    if (this.config.enableMetrics) {
      this.metrics.misses++;
      this.updateHitRate();
    }

    // ✅ CRITICAL FIX: Create and track new refresh request
    const refreshPromise = this.adapter
      .refreshDeviceState(deviceId)
      .then((state) => {
        // Success: cache the result
        this.set(deviceId, state);
        return state;
      })
      .finally(() => {
        // ✅ CRITICAL FIX: Always clean up in-flight request
        // This prevents memory leaks and allows future refreshes
        this.inFlightRequests.delete(deviceId);
      });

    // ✅ CRITICAL FIX: Store promise before awaiting
    // This ensures subsequent requests find the in-flight request
    this.inFlightRequests.set(deviceId, refreshPromise);

    return refreshPromise;
  }

  /**
   * Set device state in cache.
   *
   * @param deviceId Device ID
   * @param state Device state to cache
   */
  set(deviceId: UniversalDeviceId, state: DeviceState): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.ttl);

    // Create cached entry
    const cachedState: CachedState = {
      state,
      cachedAt: now,
      expiresAt,
      hitCount: 0,
    };

    // Check if we need to evict (LRU)
    if (
      !this.cache.has(deviceId) &&
      this.cache.size >= this.config.maxSize
    ) {
      this.evictOldest();
    }

    // Store in cache
    this.cache.set(deviceId, cachedState);
    this.updateAccessOrder(deviceId);

    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.currentSize = this.cache.size;
      this.metrics.peakSize = Math.max(this.metrics.peakSize, this.cache.size);
    }
  }

  /**
   * Invalidate cached state for device.
   *
   * Next access will trigger refresh.
   *
   * @param deviceId Device to invalidate
   */
  invalidate(deviceId: UniversalDeviceId): void {
    this.cache.delete(deviceId);

    // Remove from access order
    const index = this.accessOrder.indexOf(deviceId);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.invalidations++;
      this.metrics.currentSize = this.cache.size;
    }
  }

  /**
   * Clear entire cache.
   *
   * All subsequent accesses will trigger refresh.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.inFlightRequests.clear();

    if (this.config.enableMetrics) {
      this.metrics.currentSize = 0;
    }
  }

  /**
   * Get cache metrics.
   *
   * @returns Current cache metrics
   */
  getMetrics(): StateCacheMetrics {
    if (this.config.enableMetrics) {
      this.updateAgeMetrics();
    }
    return { ...this.metrics };
  }

  /**
   * Check if device state is cached and fresh.
   *
   * @param deviceId Device to check
   * @returns True if cached and not expired
   */
  has(deviceId: UniversalDeviceId): boolean {
    const cached = this.cache.get(deviceId);
    if (!cached) {
      return false;
    }

    const now = Date.now();
    return now < cached.expiresAt.getTime();
  }

  /**
   * Prune expired entries from cache.
   *
   * Useful for memory management in long-running processes.
   *
   * @returns Number of entries pruned
   */
  prune(): number {
    const now = Date.now();
    let prunedCount = 0;

    for (const [deviceId, cached] of this.cache.entries()) {
      if (now >= cached.expiresAt.getTime()) {
        this.cache.delete(deviceId);
        prunedCount++;

        // Remove from access order
        const index = this.accessOrder.indexOf(deviceId);
        if (index !== -1) {
          this.accessOrder.splice(index, 1);
        }
      }
    }

    if (this.config.enableMetrics && prunedCount > 0) {
      this.metrics.currentSize = this.cache.size;
    }

    return prunedCount;
  }

  /**
   * Get cache size.
   *
   * @returns Number of cached entries
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get number of in-flight requests.
   *
   * Useful for debugging and monitoring.
   *
   * @returns Number of ongoing refresh operations
   */
  inFlightCount(): number {
    return this.inFlightRequests.size;
  }

  //
  // Private Helper Methods
  //

  /**
   * Evict oldest entry (LRU policy).
   */
  private evictOldest(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    // Remove least recently accessed
    const oldestId = this.accessOrder.shift();
    if (oldestId) {
      this.cache.delete(oldestId);

      if (this.config.enableMetrics) {
        this.metrics.evictions++;
      }
    }
  }

  /**
   * Update access order for LRU tracking.
   *
   * @param deviceId Device that was accessed
   */
  private updateAccessOrder(deviceId: UniversalDeviceId): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(deviceId);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(deviceId);
  }

  /**
   * Update hit rate metric.
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Update age metrics.
   */
  private updateAgeMetrics(): void {
    if (this.cache.size === 0) {
      this.metrics.averageAge = 0;
      this.metrics.oldestAge = 0;
      return;
    }

    const now = Date.now();
    let totalAge = 0;
    let oldestAge = 0;

    for (const cached of this.cache.values()) {
      const age = now - cached.cachedAt.getTime();
      totalAge += age;
      oldestAge = Math.max(oldestAge, age);
    }

    this.metrics.averageAge = totalAge / this.cache.size;
    this.metrics.oldestAge = oldestAge;
  }
}
