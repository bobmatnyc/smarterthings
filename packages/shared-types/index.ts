// Re-export backend types for frontend consumption
export type { UnifiedDevice, DeviceCapability } from '../../src/types/unified-device.js';
export type { DeviceId, LocationId } from '../../src/types/smartthings.js';
export type { DirectResult } from '../../src/direct/types.js';
export { isSuccess, isError } from '../../src/direct/types.js';
