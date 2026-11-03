import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LocalDiskFileStore } from '../common/fileStore.js';
import { computeSha256 } from '../common/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testFilesDir = path.resolve(__dirname, '../../data/test_files');

describe('LocalDiskFileStore (E1-T3)', () => {
  let fileStore: LocalDiskFileStore;

  beforeEach(() => {
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    fileStore = new LocalDiskFileStore(testFilesDir);
  });

  afterAll(() => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  it('should store and retrieve files byte-for-byte with exact SHA-256', async () => {
    const rawContent = '# Master Architecture Guide\n\nExact binary & text preservation.';
    const buffer = Buffer.from(rawContent, 'utf-8');
    const expectedHash = `sha256:${computeSha256(buffer)}`;

    const { storageKey, sha256, sizeBytes } = await fileStore.put('architecture.md', buffer);

    expect(sha256).toBe(expectedHash);
    expect(sizeBytes).toBe(buffer.length);
    expect(await fileStore.exists(storageKey)).toBe(true);

    const retrieved = await fileStore.get(storageKey);
    expect(retrieved.toString('utf-8')).toBe(rawContent);
    expect(retrieved.equals(buffer)).toBe(true);

    // Delete
    const deleted = await fileStore.delete(storageKey);
    expect(deleted).toBe(true);
    expect(await fileStore.exists(storageKey)).toBe(false);
  });

  it('should block path traversal attempts when accessing storageKey', async () => {
    expect(() => {
      fileStore.getFilePath('../../../etc/passwd');
    }).toThrow(/Security Exception/);
  });
});
