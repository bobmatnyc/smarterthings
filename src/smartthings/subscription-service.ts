/**
 * SmartThings Subscription Management Service
 *
 * Manages event subscriptions to receive real-time device updates
 * via webhook from SmartThings cloud.
 */

import { SmartThingsClient, SubscriptionSource } from '@smartthings/core-sdk';
import logger from '../utils/logger.js';

export interface SubscriptionConfig {
  capability: string;
  attribute?: string;
  subscriptionName: string;
}

// Key capabilities to subscribe to for real-time events
export const DEFAULT_SUBSCRIPTIONS: SubscriptionConfig[] = [
  { capability: 'motionSensor', attribute: 'motion', subscriptionName: 'motion-events' },
  { capability: 'contactSensor', attribute: 'contact', subscriptionName: 'contact-events' },
  { capability: 'switch', attribute: 'switch', subscriptionName: 'switch-events' },
  { capability: 'switchLevel', attribute: 'level', subscriptionName: 'level-events' },
  { capability: 'lock', attribute: 'lock', subscriptionName: 'lock-events' },
  {
    capability: 'temperatureMeasurement',
    attribute: 'temperature',
    subscriptionName: 'temperature-events',
  },
];

export class SubscriptionService {
  private client: SmartThingsClient;
  private installedAppId: string | null = null;
  private locationId: string | null = null;

  constructor(client: SmartThingsClient) {
    this.client = client;
  }

  /**
   * Set the installed app context for subscriptions
   */
  setContext(installedAppId: string, locationId: string): void {
    this.installedAppId = installedAppId;
    this.locationId = locationId;
    logger.info('Subscription service context set', { installedAppId, locationId });
  }

  /**
   * List all current subscriptions
   */
  async listSubscriptions(): Promise<any[]> {
    if (!this.installedAppId) {
      throw new Error('No installed app context set');
    }

    try {
      const subscriptions = await this.client.subscriptions.list(this.installedAppId);
      return subscriptions;
    } catch (error) {
      logger.error('Failed to list subscriptions', { error });
      throw error;
    }
  }

  /**
   * Subscribe to a capability for all devices
   */
  async subscribeToCapability(config: SubscriptionConfig): Promise<any> {
    if (!this.installedAppId || !this.locationId) {
      throw new Error('No installed app context set');
    }

    try {
      const subscription = await this.client.subscriptions.create(
        {
          sourceType: SubscriptionSource.CAPABILITY,
          capability: {
            locationId: this.locationId,
            capability: config.capability,
            attribute: config.attribute || '*',
            subscriptionName: config.subscriptionName,
          },
        },
        this.installedAppId
      );

      logger.info('Created capability subscription', {
        capability: config.capability,
        subscriptionId: subscription.id,
      });

      return subscription;
    } catch (error: any) {
      // Ignore "already exists" errors
      if (error.message?.includes('already exists') || error.statusCode === 409) {
        logger.debug('Subscription already exists', { capability: config.capability });
        return null;
      }
      logger.error('Failed to create subscription', { config, error });
      throw error;
    }
  }

  /**
   * Subscribe to all default capabilities
   */
  async subscribeToDefaults(): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };

    for (const config of DEFAULT_SUBSCRIPTIONS) {
      try {
        await this.subscribeToCapability(config);
        results.success.push(config.capability);
      } catch (error) {
        results.failed.push(config.capability);
        logger.error('Failed to subscribe to capability', { capability: config.capability, error });
      }
    }

    logger.info('Default subscriptions created', results);
    return results;
  }

  /**
   * Delete a subscription by ID
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    if (!this.installedAppId) {
      throw new Error('No installed app context set');
    }

    await this.client.subscriptions.delete(this.installedAppId, subscriptionId);
    logger.info('Deleted subscription', { subscriptionId });
  }

  /**
   * Delete all subscriptions
   */
  async deleteAllSubscriptions(): Promise<number> {
    const subscriptions = await this.listSubscriptions();
    let deleted = 0;

    for (const sub of subscriptions) {
      try {
        await this.deleteSubscription(sub.id);
        deleted++;
      } catch (error) {
        logger.error('Failed to delete subscription', { subscriptionId: sub.id, error });
      }
    }

    return deleted;
  }
}
