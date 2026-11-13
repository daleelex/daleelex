import { describe, expect, it } from 'vitest';
import { timeAgo } from './time';

const NOW = new Date('2026-11-13T12:00:00Z');

describe('timeAgo', () => {
  it('collapses anything under a minute to "just now"', () => {
    expect(timeAgo('2026-11-13T11:59:30Z', NOW)).toBe('just now');
  });

  it('picks the largest unit that fits', () => {
    expect(timeAgo('2026-11-13T09:00:00Z', NOW)).toBe('3 hr. ago');
    expect(timeAgo('2026-11-10T12:00:00Z', NOW)).toBe('3 days ago');
    expect(timeAgo('2026-08-01T12:00:00Z', NOW)).toBe('3 mo. ago');
  });

  it('uses natural wording for one day back', () => {
    expect(timeAgo('2026-11-12T12:00:00Z', NOW)).toBe('yesterday');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('');
  });
});
