/**
 * Unit tests for Lutron capability inference fix.
 *
 * Ticket: Lutron devices missing capabilities due to SmartThings Edge driver bug
 *
 * Test Strategy:
 * - Verify Lutron dimmers get switch + switchLevel capabilities
 * - Verify Lutron switches get switch capability
 * - Verify non-Lutron devices are unaffected
 * - Verify devices with full capabilities are not duplicated
 * - Verify edge cases (partial capabilities, mixed devices)
 */

import { describe, it, expect } from 'vitest';
import { toUnifiedDevice } from '../../../../src/services/transformers/deviceInfoToUnified.js';
import { DeviceCapability } from '../../../../src/types/unified-device.js';
import type { DeviceInfo } from '../../../../src/types/smartthings.js';

describe('Lutron Capability Inference', () => {
  describe('Lutron Caséta Wall Dimmer', () => {
    it('should add switch and switchLevel capabilities when only refresh exists', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'lutron-dimmer-1' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'AR Lights',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should have SWITCH and DIMMER capabilities
      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).toContain(DeviceCapability.DIMMER);
    });

    it('should work for various Lutron dimmer naming patterns', () => {
      const patterns = [
        'Lutron Caseta Wall Dimmer',
        'Lutron Caséta Wall Dimmer',
        'LUTRON DIMMER',
        'lutron dimmer',
      ];

      patterns.forEach((name) => {
        const deviceInfo: DeviceInfo = {
          deviceId: `test-${name}` as any,
          name,
          label: 'Test Device',
          capabilities: ['refresh'],
        };

        const unified = toUnifiedDevice(deviceInfo);
        expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
        expect(unified.capabilities).toContain(DeviceCapability.DIMMER);
      });
    });

    it('should not add duplicate capabilities if switch/switchLevel already exist', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'lutron-dimmer-fixed' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'Fixed Device',
        capabilities: ['refresh', 'switch', 'switchLevel'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Count occurrences of SWITCH capability
      const switchCount = unified.capabilities.filter((c) => c === DeviceCapability.SWITCH)
        .length;
      const dimmerCount = unified.capabilities.filter((c) => c === DeviceCapability.DIMMER)
        .length;

      expect(switchCount).toBe(1);
      expect(dimmerCount).toBe(1);
    });
  });

  describe('Lutron Caséta Wall Switch', () => {
    it('should add switch capability when only refresh exists', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'lutron-switch-1' as any,
        name: 'Lutron Caseta Wall Switch',
        label: 'Patio Door Light',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should have SWITCH capability
      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      // Should NOT have DIMMER capability
      expect(unified.capabilities).not.toContain(DeviceCapability.DIMMER);
    });

    it('should not add duplicate switch capability if already exists', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'lutron-switch-fixed' as any,
        name: 'Lutron Caseta Wall Switch',
        label: 'Fixed Switch',
        capabilities: ['refresh', 'switch'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      const switchCount = unified.capabilities.filter((c) => c === DeviceCapability.SWITCH)
        .length;
      expect(switchCount).toBe(1);
    });
  });

  describe('Non-Lutron Devices', () => {
    it('should not modify non-Lutron devices with only refresh capability', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'other-device-1' as any,
        name: 'Generic Refresh-Only Device',
        label: 'Some Device',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should not have SWITCH or DIMMER capabilities
      expect(unified.capabilities).not.toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).not.toContain(DeviceCapability.DIMMER);
    });

    it('should not affect normal SmartThings dimmers', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'normal-dimmer' as any,
        name: 'Z-Wave Dimmer Switch',
        label: 'Living Room Dimmer',
        capabilities: ['switch', 'switchLevel', 'refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should have exactly the mapped capabilities
      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).toContain(DeviceCapability.DIMMER);

      // No duplicates
      const switchCount = unified.capabilities.filter((c) => c === DeviceCapability.SWITCH)
        .length;
      const dimmerCount = unified.capabilities.filter((c) => c === DeviceCapability.DIMMER)
        .length;
      expect(switchCount).toBe(1);
      expect(dimmerCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Lutron devices with partial capabilities', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'lutron-partial' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'Partially Fixed Device',
        capabilities: ['refresh', 'switch'], // Has switch but missing switchLevel
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should not apply inference rule (requires ONLY refresh)
      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
    });

    it('should handle empty capabilities array', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'empty-caps' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'Empty Device',
        capabilities: [],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should not crash or add capabilities (requires hasOnlyRefresh)
      expect(unified.capabilities).toHaveLength(0);
    });

    it('should handle Lutron devices with many capabilities', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'lutron-full' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'Fully Featured Device',
        capabilities: ['switch', 'switchLevel', 'refresh', 'energyMeter', 'powerMeter'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      // Should not add duplicate capabilities
      const switchCount = unified.capabilities.filter((c) => c === DeviceCapability.SWITCH)
        .length;
      const dimmerCount = unified.capabilities.filter((c) => c === DeviceCapability.DIMMER)
        .length;

      expect(switchCount).toBe(1);
      expect(dimmerCount).toBe(1);
    });
  });

  describe('Real-World Devices', () => {
    it('should fix AR Lights (Lutron Dimmer)', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'ar-lights' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'AR Lights',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).toContain(DeviceCapability.DIMMER);
      expect(unified.name).toBe('AR Lights');
    });

    it('should fix Foyer Hall Lights (Lutron Dimmer)', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'foyer-hall' as any,
        name: 'Lutron Caseta Wall Dimmer',
        label: 'Foyer Hall Lights',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).toContain(DeviceCapability.DIMMER);
    });

    it('should fix Patio Door Light (Lutron Switch)', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'patio-door' as any,
        name: 'Lutron Caseta Wall Switch',
        label: 'Patio Door Light',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).not.toContain(DeviceCapability.DIMMER);
    });

    it('should fix Foyer Washers (Lutron Switch)', () => {
      const deviceInfo: DeviceInfo = {
        deviceId: 'foyer-washers' as any,
        name: 'Lutron Caseta Wall Switch',
        label: 'Foyer Washers',
        capabilities: ['refresh'],
      };

      const unified = toUnifiedDevice(deviceInfo);

      expect(unified.capabilities).toContain(DeviceCapability.SWITCH);
      expect(unified.capabilities).not.toContain(DeviceCapability.DIMMER);
    });
  });
});
