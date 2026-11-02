import { describe, it, expect } from 'vitest';
import { vi } from '../locales/vi';
import { en } from '../locales/en';

describe('Multi-Language Localization Dictionaries (i18n)', () => {
  it('should have parity between Vietnamese (vi) and English (en) dictionary keys', () => {
    const viKeys = Object.keys(vi).sort();
    const enKeys = Object.keys(en).sort();

    // Check key count
    expect(viKeys.length).toBe(enKeys.length);

    // Check each key in vi exists in en
    viKeys.forEach(k => {
      expect(en).toHaveProperty(k);
      expect((en as any)[k]).toBeDefined();
    });
  });

  it('should provide non-empty values for core application navigation and statuses', () => {
    expect(vi.brandName).toBe('DocQA');
    expect(en.brandName).toBe('DocQA');

    expect(vi.statusDraft).toContain('Bản nháp');
    expect(en.statusDraft).toContain('Draft');

    expect(vi.statusApproved).toContain('Đã phê duyệt');
    expect(en.statusApproved).toContain('Approved');

    expect(vi.settingsAuditTrail).toContain('Nhật ký Kiểm toán');
    expect(en.settingsAuditTrail).toContain('Audit');
  });
});
