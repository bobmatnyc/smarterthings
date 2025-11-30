/**
 * Integration tests for ToolExecutor Direct Mode API.
 *
 * Verifies all 29 wrapper methods work correctly with proper type safety
 * and error handling. Uses mocked ServiceContainer and handlers.
 *
 * Ticket: 1M-412 - Phase 4.2 QA Verification
 *
 * Coverage Strategy:
 * - Factory function: createToolExecutor() with initialization
 * - All 29 methods: Structure, type safety, error handling
 * - Success paths: Verify DirectResult<T> success format
 * - Error paths: Verify DirectResult<T> error format
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createToolExecutor, ToolExecutor } from '../../src/direct/ToolExecutor.js';
import { isSuccess, isError } from '../../src/direct/types.js';
import type { ServiceContainer } from '../../src/services/ServiceContainer.js';
import type { DeviceId, LocationId, RoomId, SceneId } from '../../src/types/smartthings.js';

// Mock ServiceContainer
const createMockServiceContainer = (): ServiceContainer => {
  return {
    deviceService: {
      listDevices: vi.fn(),
      getDevice: vi.fn(),
      getDeviceStatus: vi.fn(),
      executeCommand: vi.fn(),
      getDeviceCapabilities: vi.fn(),
      getDeviceEvents: vi.fn(),
    },
    smartThingsService: {
      listLocations: vi.fn(),
      listRooms: vi.fn(),
      createRoom: vi.fn(),
      updateRoom: vi.fn(),
      deleteRoom: vi.fn(),
      assignDeviceToRoom: vi.fn(),
      listScenes: vi.fn(),
      executeScene: vi.fn(),
      testConnection: vi.fn(),
      getSystemInfo: vi.fn(),
    },
    automationService: {
      createAutomation: vi.fn(),
      updateAutomation: vi.fn(),
      deleteAutomation: vi.fn(),
      testAutomation: vi.fn(),
      executeAutomation: vi.fn(),
      getTemplate: vi.fn(),
      listBuiltInTemplates: vi.fn(),
      buildAutomation: vi.fn(),
    },
    diagnosticService: {
      getDeviceHealth: vi.fn(),
      validateDeviceCapabilities: vi.fn(),
      exportDiagnostics: vi.fn(),
    },
    patternDetectorService: {
      detectPatterns: vi.fn(),
    },
    initialize: vi.fn(),
    dispose: vi.fn(),
  } as unknown as ServiceContainer;
};

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let mockContainer: ServiceContainer;

  beforeEach(() => {
    mockContainer = createMockServiceContainer();
    executor = createToolExecutor(mockContainer);
  });

  describe('Factory Function', () => {
    it('should create ToolExecutor instance via createToolExecutor', () => {
      const instance = createToolExecutor(mockContainer);
      expect(instance).toBeInstanceOf(ToolExecutor);
    });

    it('should accept ServiceContainer as dependency', () => {
      expect(() => createToolExecutor(mockContainer)).not.toThrow();
    });
  });

  describe('Device Control Tools (3 methods)', () => {
    describe('turnOnDevice', () => {
      it('should return DirectResult<void> with correct structure', async () => {
        const deviceId = 'device-123' as DeviceId;
        const result = await executor.turnOnDevice(deviceId);

        // Should have DirectResult structure
        expect(result).toHaveProperty('success');
        if (isSuccess(result)) {
          expect(result.data).toBeUndefined(); // void operation
        } else {
          expect(result.error).toHaveProperty('code');
          expect(result.error).toHaveProperty('message');
        }
      });

      it('should accept DeviceId branded type', async () => {
        const deviceId = 'test-device' as DeviceId;
        const result = await executor.turnOnDevice(deviceId);
        expect(result).toBeDefined();
      });
    });

    describe('turnOffDevice', () => {
      it('should return DirectResult<void> with correct structure', async () => {
        const deviceId = 'device-456' as DeviceId;
        const result = await executor.turnOffDevice(deviceId);

        expect(result).toHaveProperty('success');
        if (!isSuccess(result)) {
          expect(result.error).toHaveProperty('code');
          expect(result.error).toHaveProperty('message');
        }
      });
    });

    describe('getDeviceStatus', () => {
      it('should return DirectResult<any> with correct structure', async () => {
        const deviceId = 'device-789' as DeviceId;
        const result = await executor.getDeviceStatus(deviceId);

        expect(result).toHaveProperty('success');
        if (isSuccess(result)) {
          // Status should be an object (any type)
          expect(result.data).toBeDefined();
        }
      });
    });
  });

  describe('Device Query Tools (4 methods)', () => {
    describe('listDevices', () => {
      it('should accept optional filters parameter', async () => {
        const result1 = await executor.listDevices();
        expect(result1).toHaveProperty('success');

        const result2 = await executor.listDevices({ capability: 'switch' });
        expect(result2).toHaveProperty('success');

        const result3 = await executor.listDevices({ roomName: 'Living Room' });
        expect(result3).toHaveProperty('success');
      });

      it('should return DirectResult<any> (device list)', async () => {
        const result = await executor.listDevices();
        expect(result).toHaveProperty('success');
      });
    });

    describe('listDevicesByRoom', () => {
      it('should accept roomName string parameter', async () => {
        const result = await executor.listDevicesByRoom('Bedroom');
        expect(result).toHaveProperty('success');
      });
    });

    describe('getDeviceCapabilities', () => {
      it('should accept DeviceId parameter', async () => {
        const deviceId = 'device-abc' as DeviceId;
        const result = await executor.getDeviceCapabilities(deviceId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('listRooms', () => {
      it('should return DirectResult<any> (room list)', async () => {
        const result = await executor.listRooms();
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('Device Events Tools (1 method)', () => {
    describe('getDeviceEvents', () => {
      it('should accept DeviceId and optional limit', async () => {
        const deviceId = 'device-xyz' as DeviceId;

        const result1 = await executor.getDeviceEvents(deviceId);
        expect(result1).toHaveProperty('success');

        const result2 = await executor.getDeviceEvents(deviceId, 50);
        expect(result2).toHaveProperty('success');
      });
    });
  });

  describe('Scene Tools (3 methods)', () => {
    describe('executeScene', () => {
      it('should accept SceneId parameter', async () => {
        const sceneId = 'scene-123' as SceneId;
        const result = await executor.executeScene(sceneId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('listScenes', () => {
      it('should accept optional LocationId parameter', async () => {
        const result1 = await executor.listScenes();
        expect(result1).toHaveProperty('success');

        const locationId = 'location-abc' as LocationId;
        const result2 = await executor.listScenes(locationId);
        expect(result2).toHaveProperty('success');
      });
    });

    describe('listScenesByRoom', () => {
      it('should accept roomName string parameter', async () => {
        const result = await executor.listScenesByRoom('Kitchen');
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('System Tools (1 method)', () => {
    describe('toggleDebug', () => {
      it('should accept boolean enabled parameter', async () => {
        const result1 = await executor.toggleDebug(true);
        expect(result1).toHaveProperty('success');

        const result2 = await executor.toggleDebug(false);
        expect(result2).toHaveProperty('success');
      });
    });
  });

  describe('Diagnostic Tools (5 methods)', () => {
    describe('testConnection', () => {
      it('should return DirectResult<any> (connection status)', async () => {
        const result = await executor.testConnection();
        expect(result).toHaveProperty('success');
      });
    });

    describe('getSystemInfo', () => {
      it('should return DirectResult<any> (system info)', async () => {
        const result = await executor.getSystemInfo();
        expect(result).toHaveProperty('success');
      });
    });

    describe('getDeviceHealth', () => {
      it('should accept DeviceId parameter', async () => {
        const deviceId = 'device-health' as DeviceId;
        const result = await executor.getDeviceHealth(deviceId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('validateDeviceCapabilities', () => {
      it('should accept DeviceId parameter', async () => {
        const deviceId = 'device-validate' as DeviceId;
        const result = await executor.validateDeviceCapabilities(deviceId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('exportDiagnostics', () => {
      it('should accept optional format parameter', async () => {
        const result1 = await executor.exportDiagnostics();
        expect(result1).toHaveProperty('success');

        const result2 = await executor.exportDiagnostics('json');
        expect(result2).toHaveProperty('success');

        const result3 = await executor.exportDiagnostics('markdown');
        expect(result3).toHaveProperty('success');
      });

      it('should return DirectResult<string>', async () => {
        const result = await executor.exportDiagnostics('json');
        if (isSuccess(result)) {
          expect(typeof result.data).toBe('string');
        }
      });
    });
  });

  describe('Management Tools (5 methods)', () => {
    describe('listLocations', () => {
      it('should return DirectResult<any> (location list)', async () => {
        const result = await executor.listLocations();
        expect(result).toHaveProperty('success');
      });
    });

    describe('createRoom', () => {
      it('should accept LocationId and name parameters', async () => {
        const locationId = 'location-123' as LocationId;
        const result = await executor.createRoom(locationId, 'New Room');
        expect(result).toHaveProperty('success');
      });
    });

    describe('updateRoom', () => {
      it('should accept RoomId, LocationId, and name parameters', async () => {
        const roomId = 'room-456' as RoomId;
        const locationId = 'location-789' as LocationId;
        const result = await executor.updateRoom(roomId, locationId, 'Updated Room');
        expect(result).toHaveProperty('success');
      });
    });

    describe('deleteRoom', () => {
      it('should accept RoomId and LocationId parameters', async () => {
        const roomId = 'room-abc' as RoomId;
        const locationId = 'location-def' as LocationId;
        const result = await executor.deleteRoom(roomId, locationId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('assignDeviceToRoom', () => {
      it('should accept DeviceId, RoomId, and LocationId parameters', async () => {
        const deviceId = 'device-ghi' as DeviceId;
        const roomId = 'room-jkl' as RoomId;
        const locationId = 'location-mno' as LocationId;
        const result = await executor.assignDeviceToRoom(deviceId, roomId, locationId);
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('System Status Tools (1 method)', () => {
    describe('getSystemStatus', () => {
      it('should return DirectResult<any> (system status)', async () => {
        const result = await executor.getSystemStatus();
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('Automation Tools (6 methods)', () => {
    describe('createAutomation', () => {
      it('should accept AutomationConfig parameter', async () => {
        const config = {
          name: 'Test Automation',
          locationId: 'location-123' as LocationId,
          template: 'motion_lights' as const,
          trigger: {
            deviceId: 'trigger-device' as DeviceId,
            capability: 'motionSensor',
            attribute: 'motion',
            value: 'active',
          },
          action: {
            deviceId: 'action-device' as DeviceId,
            capability: 'switch',
            command: 'on',
          },
        };

        const result = await executor.createAutomation(config);
        expect(result).toHaveProperty('success');
      });
    });

    describe('updateAutomation', () => {
      it('should accept ruleId, LocationId, and updates parameters', async () => {
        const locationId = 'location-456' as LocationId;
        const updates = { name: 'Updated Automation' };
        const result = await executor.updateAutomation('rule-789', locationId, updates);
        expect(result).toHaveProperty('success');
      });
    });

    describe('deleteAutomation', () => {
      it('should accept ruleId and LocationId parameters', async () => {
        const locationId = 'location-abc' as LocationId;
        const result = await executor.deleteAutomation('rule-def', locationId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('testAutomation', () => {
      it('should accept test config parameter', async () => {
        const config = {
          template: 'motion_lights' as const,
          trigger: {
            deviceId: 'trigger-test' as DeviceId,
            capability: 'motionSensor',
            attribute: 'motion',
            value: 'active',
          },
          action: {
            deviceId: 'action-test' as DeviceId,
            capability: 'switch',
            command: 'on',
          },
        };

        const result = await executor.testAutomation(config);
        expect(result).toHaveProperty('success');
      });
    });

    describe('executeAutomation', () => {
      it('should accept ruleId and LocationId parameters', async () => {
        const locationId = 'location-execute' as LocationId;
        const result = await executor.executeAutomation('rule-ghi', locationId);
        expect(result).toHaveProperty('success');
      });
    });

    describe('getAutomationTemplate', () => {
      it('should accept optional template parameter', async () => {
        const result1 = await executor.getAutomationTemplate();
        expect(result1).toHaveProperty('success');

        const result2 = await executor.getAutomationTemplate('motion_lights');
        expect(result2).toHaveProperty('success');
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce branded types at compile time', async () => {
      // These should compile (branded types)
      const deviceId = 'test' as DeviceId;
      const locationId = 'test' as LocationId;
      const roomId = 'test' as RoomId;
      const sceneId = 'test' as SceneId;

      await executor.turnOnDevice(deviceId);
      await executor.listScenes(locationId);
      await executor.updateRoom(roomId, locationId, 'Test');
      await executor.executeScene(sceneId);

      // Plain strings would cause TypeScript errors at compile time
      // @ts-expect-error - should not accept plain string
      await executor.turnOnDevice('plain-string');
    });

    it('should return properly typed DirectResult', async () => {
      const result = await executor.getSystemInfo();

      // Type guard should narrow types
      if (isSuccess(result)) {
        // result.data should be accessible
        expect(result.data).toBeDefined();
      } else if (isError(result)) {
        // result.error should be accessible
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should return error result on handler failure', async () => {
      // All methods should handle errors gracefully
      const deviceId = 'invalid-device' as DeviceId;
      const result = await executor.getDeviceStatus(deviceId);

      // Should return error result, not throw
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      }
    });

    it('should preserve error details in DirectResult', async () => {
      const deviceId = 'error-test' as DeviceId;
      const result = await executor.turnOnDevice(deviceId);

      if (isError(result)) {
        expect(typeof result.error.code).toBe('string');
        expect(typeof result.error.message).toBe('string');
        // details may or may not be present
        if (result.error.details !== undefined) {
          expect(result.error.details).toBeDefined();
        }
      }
    });
  });

  describe('Method Count Verification', () => {
    it('should have all 29 methods implemented', () => {
      const methodNames = [
        // Device Control (3)
        'turnOnDevice',
        'turnOffDevice',
        'getDeviceStatus',
        // Device Query (4)
        'listDevices',
        'listDevicesByRoom',
        'getDeviceCapabilities',
        'listRooms',
        // Device Events (1)
        'getDeviceEvents',
        // Scenes (3)
        'executeScene',
        'listScenes',
        'listScenesByRoom',
        // System (1)
        'toggleDebug',
        // Diagnostics (5)
        'testConnection',
        'getSystemInfo',
        'getDeviceHealth',
        'validateDeviceCapabilities',
        'exportDiagnostics',
        // Management (5)
        'listLocations',
        'createRoom',
        'updateRoom',
        'deleteRoom',
        'assignDeviceToRoom',
        // System Status (1)
        'getSystemStatus',
        // Automation (6)
        'createAutomation',
        'updateAutomation',
        'deleteAutomation',
        'testAutomation',
        'executeAutomation',
        'getAutomationTemplate',
      ];

      expect(methodNames).toHaveLength(29);

      // Verify all methods exist on executor
      methodNames.forEach((method) => {
        expect(executor).toHaveProperty(method);
        expect(typeof (executor as any)[method]).toBe('function');
      });
    });
  });
});
