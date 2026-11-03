import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

const testDir = path.join(os.tmpdir(), `docqa-test-server-${process.pid}`);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    fileParallelism: false,
    env: {
      DOCQA_DB_PATH: path.join(testDir, 'test.sqlite'),
      DOCQA_FILES_DIR: path.join(testDir, 'files'),
      NODE_ENV: 'test'
    }
  }
});
