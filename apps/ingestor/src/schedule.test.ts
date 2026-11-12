import { describe, expect, it } from 'vitest';
import { parseIntervalMinutes } from './schedule.js';

describe('parseIntervalMinutes', () => {
  it('means run once when unset or empty', () => {
    expect(parseIntervalMinutes(undefined)).toBeNull();
    expect(parseIntervalMinutes('')).toBeNull();
    expect(parseIntervalMinutes('  ')).toBeNull();
  });

  it('reads a positive number of minutes', () => {
    expect(parseIntervalMinutes('60')).toBe(60);
    expect(parseIntervalMinutes('0.5')).toBe(0.5);
  });

  it('rejects values that would silently disable or spin the schedule', () => {
    for (const value of ['0', '-5', 'hourly', 'NaN', 'Infinity']) {
      expect(() => parseIntervalMinutes(value)).toThrow(/INGEST_INTERVAL_MINUTES/);
    }
  });
});
