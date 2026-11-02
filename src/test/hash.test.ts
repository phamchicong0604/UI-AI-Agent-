import { describe, it, expect } from 'vitest';
import { computeSha256, syncSha256 } from '../common/utils/hash';

describe('Frontend Cryptographic Utility (SHA-256 Checksum)', () => {
  it('should compute standard SHA-256 hex string asynchronously using Web Crypto API', async () => {
    const input = 'DOC-01|v1.0|Project Charter & Stakeholder Matrix';
    const hash = await computeSha256(input);

    expect(hash).toBeDefined();
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    // Empty string SHA-256 standard NIST test vector
    const emptyHash = await computeSha256('');
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should compute deterministic 64-character hash synchronously', () => {
    const input = 'BR-AUTH-01: Only Approver can approve';
    const hash1 = syncSha256(input);
    const hash2 = syncSha256(input);

    expect(hash1).toBeDefined();
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('should generate distinct hashes for different inputs (avoids collisions)', () => {
    const hA = syncSha256('BR-AUTH-01');
    const hB = syncSha256('BR-AUTH-02');
    expect(hA).not.toBe(hB);
  });
});
