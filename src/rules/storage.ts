// src/rules/storage.ts

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import logger from '../utils/logger.js';
import {
  Rule,
  RuleId,
  RulesStorage,
  CreateRuleRequest,
  UpdateRuleRequest,
  createRuleId,
} from './types.js';

const RULES_FILE_PATH = path.join(process.cwd(), 'data', 'rules.json');
const STORAGE_VERSION = '1.0.0';

class RulesStorageManager {
  private rules: Map<RuleId, Rule> = new Map();
  private initialized = false;
  private writeQueue: Promise<void> = Promise.resolve();

  /**
   * Initialize storage - load rules from file
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(RULES_FILE_PATH);
      if (!existsSync(dataDir)) {
        await mkdir(dataDir, { recursive: true });
      }

      // Load existing rules or create empty file
      if (existsSync(RULES_FILE_PATH)) {
        const content = await readFile(RULES_FILE_PATH, 'utf-8');
        const storage: RulesStorage = JSON.parse(content);

        for (const rule of storage.rules) {
          this.rules.set(rule.id, rule);
        }

        logger.info(`[RulesStorage] Loaded ${this.rules.size} rules from file`);
      } else {
        await this.persist();
        logger.info('[RulesStorage] Created new rules storage file');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('[RulesStorage] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get all rules
   */
  getAll(): Rule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get enabled rules only (sorted by priority)
   */
  getEnabled(): Rule[] {
    return this.getAll().filter(rule => rule.enabled);
  }

  /**
   * Get rule by ID
   */
  get(id: RuleId): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Create a new rule
   */
  async create(request: CreateRuleRequest, createdBy: Rule['createdBy'] = 'user', llmPrompt?: string): Promise<Rule> {
    const now = new Date().toISOString();
    const id = createRuleId(`rule-${randomUUID().slice(0, 8)}`);

    const rule: Rule = {
      id,
      name: request.name,
      description: request.description,
      enabled: request.enabled ?? true,
      priority: request.priority ?? 50,
      triggers: request.triggers,
      conditions: request.conditions,
      actions: request.actions,
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      createdBy,
      llmPrompt,
    };

    this.rules.set(id, rule);
    await this.persist();

    logger.info(`[RulesStorage] Created rule: ${rule.name} (${id})`);
    return rule;
  }

  /**
   * Update an existing rule
   */
  async update(id: RuleId, request: UpdateRuleRequest): Promise<Rule | null> {
    const existing = this.rules.get(id);
    if (!existing) {
      return null;
    }

    const updated: Rule = {
      ...existing,
      ...request,
      id, // Preserve ID
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt, // Preserve creation time
      executionCount: existing.executionCount, // Preserve count
      createdBy: existing.createdBy, // Preserve source
    };

    this.rules.set(id, updated);
    await this.persist();

    logger.info(`[RulesStorage] Updated rule: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * Delete a rule
   */
  async delete(id: RuleId): Promise<boolean> {
    const existed = this.rules.delete(id);
    if (existed) {
      await this.persist();
      logger.info(`[RulesStorage] Deleted rule: ${id}`);
    }
    return existed;
  }

  /**
   * Enable or disable a rule
   */
  async setEnabled(id: RuleId, enabled: boolean): Promise<Rule | null> {
    return this.update(id, { enabled });
  }

  /**
   * Record rule execution
   */
  async recordExecution(id: RuleId): Promise<void> {
    const rule = this.rules.get(id);
    if (rule) {
      rule.lastExecutedAt = new Date().toISOString();
      rule.executionCount += 1;
      await this.persist();
    }
  }

  /**
   * Find rules matching a device event
   */
  findMatchingRules(deviceId: string, attribute: string, value: unknown): Rule[] {
    return this.getEnabled().filter(rule => {
      return rule.triggers.some(trigger => {
        if (trigger.type !== 'device_state') return false;
        if (trigger.deviceId !== deviceId) return false;
        if (trigger.attribute !== attribute) return false;

        return this.evaluateOperator(trigger.operator, value, trigger.value, trigger.valueEnd);
      });
    });
  }

  /**
   * Evaluate trigger operator
   */
  private evaluateOperator(
    operator: string,
    actual: unknown,
    expected: unknown,
    expectedEnd?: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'greaterThan':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'lessThan':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
      case 'between':
        return (
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          typeof expectedEnd === 'number' &&
          actual >= expected &&
          actual <= expectedEnd
        );
      default:
        return false;
    }
  }

  /**
   * Persist rules to file (queued for thread safety)
   */
  private async persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const storage: RulesStorage = {
        version: STORAGE_VERSION,
        rules: Array.from(this.rules.values()),
        lastModified: new Date().toISOString(),
      };

      await writeFile(RULES_FILE_PATH, JSON.stringify(storage, null, 2), 'utf-8');
    });

    await this.writeQueue;
  }
}

// Singleton instance
let instance: RulesStorageManager | null = null;

export function getRulesStorage(): RulesStorageManager {
  if (!instance) {
    instance = new RulesStorageManager();
  }
  return instance;
}

export async function initializeRulesStorage(): Promise<RulesStorageManager> {
  const storage = getRulesStorage();
  await storage.initialize();
  return storage;
}
