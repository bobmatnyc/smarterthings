// src/rules/scheduler.ts

/**
 * Rules Scheduler - Time-based and Cron-based Trigger Execution
 *
 * Handles scheduled rule execution including:
 * - Time-based triggers (specific times with day filtering)
 * - Cron expression triggers (flexible scheduling)
 * - Astronomical triggers (sunrise/sunset with offsets)
 *
 * Design Decision: Centralized scheduling with node-cron
 * Rationale: Node-cron provides reliable scheduling with minimal overhead.
 * Each rule with time-based triggers gets its own scheduled job.
 *
 * Architecture:
 * - Maintains map of scheduled jobs per rule
 * - Automatically reschedules when rules are updated
 * - Integrates with astronomical module for sunrise/sunset
 */

import cron from 'node-cron';
import logger from '../utils/logger.js';
import { getRulesStorage } from './storage.js';
import { executeRule } from './executor.js';
import { getAstronomicalCalculator } from './astronomical.js';
import {
  Rule,
  RuleId,
  TimeTrigger,
  CronTrigger,
  AstronomicalTrigger,
  RuleExecutionContext,
  isTimeTrigger,
  isCronTrigger,
  isAstronomicalTrigger,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

interface ScheduledJob {
  ruleId: RuleId;
  triggerId: string;
  type: 'time' | 'cron' | 'astronomical';
  cronExpression: string;
  task: cron.ScheduledTask;
  nextRun?: Date;
}

interface SchedulerStats {
  initialized: boolean;
  enabled: boolean;
  activeJobs: number;
  executedRules: number;
  failedExecutions: number;
}

// ============================================================================
// Scheduler Class
// ============================================================================

export class RulesScheduler {
  private initialized = false;
  private enabled = true;
  private jobs: Map<string, ScheduledJob> = new Map();
  private executedRules = 0;
  private failedExecutions = 0;
  private astronomicalRefreshJob: cron.ScheduledTask | null = null;

  /**
   * Initialize the scheduler
   *
   * Loads all enabled rules and schedules time-based triggers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[RulesScheduler] Already initialized');
      return;
    }

    try {
      const storage = getRulesStorage();
      const enabledRules = storage.getEnabled();

      // Schedule all time-based rules
      for (const rule of enabledRules) {
        this.scheduleRule(rule);
      }

      // Refresh astronomical times daily at midnight
      this.astronomicalRefreshJob = cron.schedule('0 0 * * *', () => {
        logger.info('[RulesScheduler] Refreshing astronomical times');
        this.refreshAstronomicalTriggers();
      });

      this.initialized = true;
      logger.info(`[RulesScheduler] Initialized with ${this.jobs.size} scheduled jobs`);
    } catch (error) {
      logger.error('[RulesScheduler] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Schedule a rule's time-based triggers
   *
   * @param rule Rule to schedule
   */
  scheduleRule(rule: Rule): void {
    if (!rule.enabled) return;

    for (let i = 0; i < rule.triggers.length; i++) {
      const trigger = rule.triggers[i];
      if (!trigger) continue;

      const triggerId = `${rule.id}-trigger-${i}`;

      if (isTimeTrigger(trigger)) {
        this.scheduleTimeTrigger(rule, trigger, triggerId);
      } else if (isCronTrigger(trigger)) {
        this.scheduleCronTrigger(rule, trigger, triggerId);
      } else if (isAstronomicalTrigger(trigger)) {
        this.scheduleAstronomicalTrigger(rule, trigger, triggerId);
      }
    }
  }

  /**
   * Schedule a time-based trigger
   *
   * Converts time string (HH:MM) to cron expression with day filtering.
   */
  private scheduleTimeTrigger(rule: Rule, trigger: TimeTrigger, triggerId: string): void {
    const parts = trigger.time.split(':').map(Number);
    const hours = parts[0];
    const minutes = parts[1];

    if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) {
      logger.error(`[RulesScheduler] Invalid time format: ${trigger.time}`);
      return;
    }

    // Build cron expression: minute hour * * day-of-week
    let dayOfWeek = '*';
    if (trigger.days && trigger.days.length > 0) {
      const dayMap: Record<string, number> = {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      };
      dayOfWeek = trigger.days.map((d) => dayMap[d]).join(',');
    }

    const cronExpression = `${minutes} ${hours} * * ${dayOfWeek}`;

    this.createJob(rule.id, triggerId, 'time', cronExpression, rule);
  }

  /**
   * Schedule a cron-based trigger
   */
  private scheduleCronTrigger(rule: Rule, trigger: CronTrigger, triggerId: string): void {
    if (!cron.validate(trigger.expression)) {
      logger.error(`[RulesScheduler] Invalid cron expression: ${trigger.expression}`);
      return;
    }

    this.createJob(rule.id, triggerId, 'cron', trigger.expression, rule);
  }

  /**
   * Schedule an astronomical trigger (sunrise/sunset)
   *
   * Calculates today's sunrise/sunset and schedules accordingly.
   * Re-calculated daily at midnight.
   */
  private scheduleAstronomicalTrigger(
    rule: Rule,
    trigger: AstronomicalTrigger,
    triggerId: string
  ): void {
    const astro = getAstronomicalCalculator();
    const times = astro.getTodaysTimes();

    if (!times) {
      logger.warn('[RulesScheduler] Astronomical times not available (location not set)');
      return;
    }

    const eventTime = trigger.event === 'sunrise' ? times.sunrise : times.sunset;
    const offsetMs = (trigger.offsetMinutes || 0) * 60 * 1000;
    const targetTime = new Date(eventTime.getTime() + offsetMs);

    // Only schedule if time is in the future
    const now = new Date();
    if (targetTime > now) {
      const hours = targetTime.getHours();
      const minutes = targetTime.getMinutes();
      const cronExpression = `${minutes} ${hours} * * *`;

      this.createJob(rule.id, triggerId, 'astronomical', cronExpression, rule);

      logger.debug(`[RulesScheduler] Scheduled ${trigger.event} trigger at ${targetTime.toISOString()}`);
    } else {
      logger.debug(`[RulesScheduler] Skipping past astronomical trigger for today`);
    }
  }

  /**
   * Create and register a scheduled job
   */
  private createJob(
    ruleId: RuleId,
    triggerId: string,
    type: ScheduledJob['type'],
    cronExpression: string,
    rule: Rule
  ): void {
    // Remove existing job if any
    this.removeJob(triggerId);

    const task = cron.schedule(cronExpression, async () => {
      if (!this.enabled) {
        logger.debug('[RulesScheduler] Scheduler disabled, skipping execution');
        return;
      }

      logger.info(`[RulesScheduler] Executing scheduled rule: ${rule.name}`);

      const context: RuleExecutionContext = {
        triggeredBy: 'schedule',
        triggerEvent: {
          type: type,
          timestamp: new Date().toISOString(),
        },
        variables: {},
      };

      try {
        // Re-fetch rule to get latest version
        const storage = getRulesStorage();
        const currentRule = storage.get(ruleId);

        if (!currentRule || !currentRule.enabled) {
          logger.debug(`[RulesScheduler] Rule ${ruleId} no longer enabled, skipping`);
          return;
        }

        const result = await executeRule(currentRule, context);

        if (result.success) {
          this.executedRules++;
          logger.info(`[RulesScheduler] Rule executed successfully: ${rule.name}`);
        } else {
          this.failedExecutions++;
          logger.error(`[RulesScheduler] Rule execution failed: ${result.error}`);
        }
      } catch (error) {
        this.failedExecutions++;
        logger.error(`[RulesScheduler] Error executing rule:`, error);
      }
    });

    const job: ScheduledJob = {
      ruleId,
      triggerId,
      type,
      cronExpression,
      task,
    };

    this.jobs.set(triggerId, job);
    logger.debug(`[RulesScheduler] Created ${type} job: ${triggerId} (${cronExpression})`);
  }

  /**
   * Remove a scheduled job
   */
  private removeJob(triggerId: string): void {
    const job = this.jobs.get(triggerId);
    if (job) {
      job.task.stop();
      this.jobs.delete(triggerId);
      logger.debug(`[RulesScheduler] Removed job: ${triggerId}`);
    }
  }

  /**
   * Unschedule all jobs for a rule
   */
  unscheduleRule(ruleId: RuleId): void {
    const jobsToRemove: string[] = [];

    for (const [triggerId, job] of this.jobs) {
      if (job.ruleId === ruleId) {
        jobsToRemove.push(triggerId);
      }
    }

    for (const triggerId of jobsToRemove) {
      this.removeJob(triggerId);
    }

    if (jobsToRemove.length > 0) {
      logger.info(`[RulesScheduler] Unscheduled ${jobsToRemove.length} jobs for rule: ${ruleId}`);
    }
  }

  /**
   * Reschedule a rule (unschedule + schedule)
   */
  rescheduleRule(rule: Rule): void {
    this.unscheduleRule(rule.id);
    if (rule.enabled) {
      this.scheduleRule(rule);
    }
  }

  /**
   * Refresh all astronomical triggers
   *
   * Called daily at midnight to recalculate sunrise/sunset times.
   */
  private refreshAstronomicalTriggers(): void {
    const storage = getRulesStorage();
    const enabledRules = storage.getEnabled();

    for (const rule of enabledRules) {
      const hasAstronomical = rule.triggers.some(isAstronomicalTrigger);
      if (hasAstronomical) {
        this.rescheduleRule(rule);
      }
    }
  }

  /**
   * Enable/disable the scheduler
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`[RulesScheduler] Scheduler ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return {
      initialized: this.initialized,
      enabled: this.enabled,
      activeJobs: this.jobs.size,
      executedRules: this.executedRules,
      failedExecutions: this.failedExecutions,
    };
  }

  /**
   * Get all scheduled jobs info
   */
  getScheduledJobs(): Array<{
    ruleId: string;
    triggerId: string;
    type: string;
    cronExpression: string;
  }> {
    return Array.from(this.jobs.values()).map((job) => ({
      ruleId: job.ruleId,
      triggerId: job.triggerId,
      type: job.type,
      cronExpression: job.cronExpression,
    }));
  }

  /**
   * Stop all scheduled jobs and cleanup
   */
  shutdown(): void {
    for (const job of this.jobs.values()) {
      job.task.stop();
    }
    this.jobs.clear();

    if (this.astronomicalRefreshJob) {
      this.astronomicalRefreshJob.stop();
      this.astronomicalRefreshJob = null;
    }

    this.initialized = false;
    logger.info('[RulesScheduler] Shutdown complete');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: RulesScheduler | null = null;

export function getRulesScheduler(): RulesScheduler {
  if (!instance) {
    instance = new RulesScheduler();
  }
  return instance;
}

export async function initializeRulesScheduler(): Promise<RulesScheduler> {
  const scheduler = getRulesScheduler();
  await scheduler.initialize();
  return scheduler;
}
