import { describe, it, expect } from 'vitest';
import { computeSha256, computeAuditEventHash } from '../common/crypto.js';

describe('Backend Cryptographic Engine (SHA-256 & Audit Chaining)', () => {
  it('should compute deterministic 64-character SHA-256 hash', () => {
    const input = 'DOC-01|v1.0|Project Charter & Stakeholder Matrix';
    const hash1 = computeSha256(input);
    const hash2 = computeSha256(input);

    expect(hash1).toBeDefined();
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different inputs (avoids collision)', () => {
    const hashA = computeSha256('Data_A');
    const hashB = computeSha256('Data_B');
    expect(hashA).not.toBe(hashB);
  });

  it('should compute tamper-evident audit event hash with chained previous block hash', () => {
    const prevHash = `sha256:${computeSha256('GENESIS_BLOCK')}`;
    const eventHash1 = computeAuditEventHash(
      prevHash,
      'AUD-001',
      'Duc Pham',
      'QA',
      'Approved Test Case',
      'TestCase',
      'TC-AUTH-001',
      '2026-11-02 10:00'
    );

    expect(eventHash1).toBeDefined();
    expect(eventHash1.startsWith('sha256:')).toBe(true);
    expect(eventHash1.length).toBe(7 + 64);

    // Chaining next block with eventHash1 as previous
    const eventHash2 = computeAuditEventHash(
      eventHash1,
      'AUD-002',
      'Khoa Dang',
      'Tech Lead / DEV',
      'Verified Evidence',
      'Evidence',
      'EVD-001',
      '2026-11-02 10:15'
    );

    expect(eventHash2).toBeDefined();
    expect(eventHash2).not.toBe(eventHash1);
  });

  it('should detect tampering if audit data or previous hash is altered', () => {
    const prevHash = 'sha256:genesis123';
    const validHash = computeAuditEventHash(
      prevHash,
      'AUD-001',
      'Sarah Le',
      'BA',
      'Created Requirement',
      'Requirement',
      'REQ-001',
      '2026-11-02 10:00'
    );

    // Attempted tampering: unauthorized user changed role to 'Project Admin'
    const tamperedHash = computeAuditEventHash(
      prevHash,
      'AUD-001',
      'Sarah Le',
      'Project Admin', // Tampered!
      'Created Requirement',
      'Requirement',
      'REQ-001',
      '2026-11-02 10:00'
    );

    expect(validHash).not.toBe(tamperedHash);
  });
});
