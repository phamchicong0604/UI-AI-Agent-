import fs from 'fs';
import path from 'path';
import os from 'os';
import { beforeAll, afterAll } from 'vitest';

// BUG-029 & NEW-03: Completely isolate test SQLite DB and file store in a temporary directory
// to ensure zero writes, locks or deletes on server/data/docqa.sqlite or server/data/files
const testDir = path.join(os.tmpdir(), `docqa-test-server-${process.pid}`);
const testDbPath = path.join(testDir, 'test.sqlite');
const testFilesDir = path.join(testDir, 'files');

if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}
if (!fs.existsSync(testFilesDir)) {
  fs.mkdirSync(testFilesDir, { recursive: true });
}

process.env.DOCQA_DB_PATH = testDbPath;
process.env.DOCQA_FILES_DIR = testFilesDir;
process.env.NODE_ENV = 'test';

afterAll(() => {
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch {}
});
