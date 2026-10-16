import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

describe('relativeTime', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  it('formats like GitHub', () => {
    expect(relativeTime('2026-10-16T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-10-16T09:00:00Z', now)).toBe('3 hours ago');
    expect(relativeTime('2026-10-15T12:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-08-01T12:00:00Z', now)).toBe('3 months ago');
  });
});
