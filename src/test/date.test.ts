import { describe, it, expect } from 'vitest';
import { formatDateTime, getCurrentTimestamp } from '../common/utils/date';

describe('Date & Time Formatting Utility', () => {
  it('should format ISO datetime strings into Vietnamese presentation format', () => {
    const formatted = formatDateTime('2026-11-02T10:30:00Z');
    expect(formatted).toBeDefined();
    expect(formatted).toContain('2026');
  });

  it('should generate current timestamp in YYYY-MM-DD HH:mm format', () => {
    const timestamp = getCurrentTimestamp();
    expect(timestamp).toBeDefined();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('should handle invalid or empty datetime gracefully without throwing', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('invalid-date')).toBe('invalid-date');
  });
});
