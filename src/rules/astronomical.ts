// src/rules/astronomical.ts

/**
 * Astronomical Calculations for Rules Engine
 *
 * Provides sunrise/sunset calculations based on location for use in:
 * - Astronomical triggers (execute at sunrise/sunset with offset)
 * - Time conditions (before/after sunrise/sunset)
 *
 * Design Decision: Location-based calculations using suncalc
 * Rationale: SunCalc is a lightweight, accurate library for solar calculations.
 * Location can be auto-detected or manually configured.
 *
 * Location Sources (in priority order):
 * 1. Manual configuration via setLocation()
 * 2. SmartThings location (from API)
 * 3. Default fallback (configurable)
 */

import SunCalc from 'suncalc';
import logger from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface GeoLocation {
  latitude: number;
  longitude: number;
  timezone?: string;
  name?: string;
}

export interface SolarTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dawn: Date;        // Civil dawn (sun 6° below horizon)
  dusk: Date;        // Civil dusk
  nauticalDawn: Date;
  nauticalDusk: Date;
  goldenHour: Date;  // Golden hour start (evening)
  goldenHourEnd: Date; // Golden hour end (morning)
}

// ============================================================================
// Astronomical Calculator
// ============================================================================

export class AstronomicalCalculator {
  private location: GeoLocation | null = null;
  private cachedTimes: { date: string; times: SolarTimes } | null = null;

  /**
   * Set the location for calculations
   *
   * @param location Geographic location with latitude/longitude
   */
  setLocation(location: GeoLocation): void {
    this.location = location;
    this.cachedTimes = null; // Clear cache when location changes
    logger.info(`[Astronomical] Location set: ${location.name || `${location.latitude}, ${location.longitude}`}`);
  }

  /**
   * Get the current location
   */
  getLocation(): GeoLocation | null {
    return this.location;
  }

  /**
   * Calculate solar times for a specific date
   *
   * @param date Date to calculate (defaults to today)
   * @returns Solar times or null if location not set
   */
  getTimes(date: Date = new Date()): SolarTimes | null {
    if (!this.location) {
      logger.debug('[Astronomical] Location not set, cannot calculate times');
      return null;
    }

    const times = SunCalc.getTimes(date, this.location.latitude, this.location.longitude);

    return {
      sunrise: times.sunrise,
      sunset: times.sunset,
      solarNoon: times.solarNoon,
      dawn: times.dawn,
      dusk: times.dusk,
      nauticalDawn: times.nauticalDawn,
      nauticalDusk: times.nauticalDusk,
      goldenHour: times.goldenHour,
      goldenHourEnd: times.goldenHourEnd,
    };
  }

  /**
   * Get today's solar times (cached)
   *
   * Caches result for the current day to avoid repeated calculations.
   */
  getTodaysTimes(): SolarTimes | null {
    const todayParts = new Date().toISOString().split('T');
    const today = todayParts[0] || '';

    if (this.cachedTimes && this.cachedTimes.date === today) {
      return this.cachedTimes.times;
    }

    const times = this.getTimes();
    if (times) {
      this.cachedTimes = { date: today, times };
    }

    return times;
  }

  /**
   * Get time for a specific event with optional offset
   *
   * @param event Astronomical event name
   * @param offsetMinutes Offset in minutes (+/-)
   * @param date Date to calculate (defaults to today)
   */
  getEventTime(
    event: 'sunrise' | 'sunset' | 'dawn' | 'dusk' | 'solarNoon',
    offsetMinutes: number = 0,
    date: Date = new Date()
  ): Date | null {
    const times = this.getTimes(date);
    if (!times) return null;

    const baseTime = times[event];
    if (!baseTime) return null;

    return new Date(baseTime.getTime() + offsetMinutes * 60 * 1000);
  }

  /**
   * Check if current time is before a given event
   *
   * @param event Astronomical event
   * @param offsetMinutes Offset from event
   */
  isBeforeEvent(
    event: 'sunrise' | 'sunset' | 'dawn' | 'dusk',
    offsetMinutes: number = 0
  ): boolean {
    const eventTime = this.getEventTime(event, offsetMinutes);
    if (!eventTime) return false;

    return new Date() < eventTime;
  }

  /**
   * Check if current time is after a given event
   *
   * @param event Astronomical event
   * @param offsetMinutes Offset from event
   */
  isAfterEvent(
    event: 'sunrise' | 'sunset' | 'dawn' | 'dusk',
    offsetMinutes: number = 0
  ): boolean {
    const eventTime = this.getEventTime(event, offsetMinutes);
    if (!eventTime) return false;

    return new Date() > eventTime;
  }

  /**
   * Check if current time is between two events
   *
   * @param startEvent Start event
   * @param endEvent End event
   * @param startOffset Offset for start event (minutes)
   * @param endOffset Offset for end event (minutes)
   */
  isBetweenEvents(
    startEvent: 'sunrise' | 'sunset' | 'dawn' | 'dusk',
    endEvent: 'sunrise' | 'sunset' | 'dawn' | 'dusk',
    startOffset: number = 0,
    endOffset: number = 0
  ): boolean {
    return this.isAfterEvent(startEvent, startOffset) && this.isBeforeEvent(endEvent, endOffset);
  }

  /**
   * Check if it's currently daytime
   *
   * Daytime is defined as between sunrise and sunset.
   */
  isDaytime(): boolean {
    return this.isBetweenEvents('sunrise', 'sunset');
  }

  /**
   * Check if it's currently nighttime
   */
  isNighttime(): boolean {
    return !this.isDaytime();
  }

  /**
   * Get minutes until next event
   *
   * @param event Astronomical event
   * @param offsetMinutes Offset from event
   * @returns Minutes until event, or null if event has passed today
   */
  getMinutesUntilEvent(
    event: 'sunrise' | 'sunset' | 'dawn' | 'dusk',
    offsetMinutes: number = 0
  ): number | null {
    const eventTime = this.getEventTime(event, offsetMinutes);
    if (!eventTime) return null;

    const now = new Date();
    const diffMs = eventTime.getTime() - now.getTime();

    if (diffMs < 0) {
      // Event has passed, calculate for tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowEvent = this.getEventTime(event, offsetMinutes, tomorrow);
      if (!tomorrowEvent) return null;

      return Math.round((tomorrowEvent.getTime() - now.getTime()) / 60000);
    }

    return Math.round(diffMs / 60000);
  }

  /**
   * Get sun position for current time
   *
   * Useful for advanced automation (e.g., adjust blinds based on sun angle).
   */
  getSunPosition(date: Date = new Date()): {
    altitude: number;
    azimuth: number;
  } | null {
    if (!this.location) return null;

    const position = SunCalc.getPosition(date, this.location.latitude, this.location.longitude);

    return {
      altitude: position.altitude * (180 / Math.PI), // Convert to degrees
      azimuth: position.azimuth * (180 / Math.PI) + 180, // Convert to degrees, normalized
    };
  }

  /**
   * Get moon phase for current date
   *
   * Returns value between 0 and 1:
   * 0 = New moon, 0.25 = First quarter, 0.5 = Full moon, 0.75 = Last quarter
   */
  getMoonPhase(date: Date = new Date()): {
    phase: number;
    illumination: number;
    name: string;
  } {
    const illumination = SunCalc.getMoonIllumination(date);

    // Map phase to name
    const phase = illumination.phase;
    let name: string;

    if (phase < 0.0625) name = 'New Moon';
    else if (phase < 0.1875) name = 'Waxing Crescent';
    else if (phase < 0.3125) name = 'First Quarter';
    else if (phase < 0.4375) name = 'Waxing Gibbous';
    else if (phase < 0.5625) name = 'Full Moon';
    else if (phase < 0.6875) name = 'Waning Gibbous';
    else if (phase < 0.8125) name = 'Last Quarter';
    else if (phase < 0.9375) name = 'Waning Crescent';
    else name = 'New Moon';

    return {
      phase: illumination.phase,
      illumination: illumination.fraction,
      name,
    };
  }

  /**
   * Format event time as human-readable string
   */
  formatEventTime(
    event: 'sunrise' | 'sunset' | 'dawn' | 'dusk',
    offsetMinutes: number = 0
  ): string {
    const time = this.getEventTime(event, offsetMinutes);
    if (!time) return 'Unknown';

    const offsetStr = offsetMinutes > 0
      ? ` +${offsetMinutes}min`
      : offsetMinutes < 0
      ? ` ${offsetMinutes}min`
      : '';

    return `${time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}${offsetStr}`;
  }

  /**
   * Get summary of today's astronomical times
   */
  getTodaysSummary(): {
    location: GeoLocation | null;
    times: SolarTimes | null;
    isDaytime: boolean;
    sunPosition: { altitude: number; azimuth: number } | null;
    moonPhase: { phase: number; illumination: number; name: string };
  } {
    return {
      location: this.location,
      times: this.getTodaysTimes(),
      isDaytime: this.isDaytime(),
      sunPosition: this.getSunPosition(),
      moonPhase: this.getMoonPhase(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AstronomicalCalculator | null = null;

export function getAstronomicalCalculator(): AstronomicalCalculator {
  if (!instance) {
    instance = new AstronomicalCalculator();
  }
  return instance;
}

/**
 * Initialize astronomical calculator with location from SmartThings
 *
 * @param smartThingsAdapter SmartThings adapter to get location from
 */
export async function initializeAstronomicalFromSmartThings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  smartThingsAdapter: any
): Promise<void> {
  try {
    const calculator = getAstronomicalCalculator();

    // Get location from SmartThings
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const locations = await smartThingsAdapter.getLocations?.();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (locations && locations.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const location = locations[0];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (location.latitude && location.longitude) {
        calculator.setLocation({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          latitude: location.latitude,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          longitude: location.longitude,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          timezone: location.timeZoneId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          name: location.name,
        });
        logger.info('[Astronomical] Initialized from SmartThings location');
      }
    }
  } catch (error) {
    logger.warn('[Astronomical] Failed to initialize from SmartThings:', error);
  }
}
