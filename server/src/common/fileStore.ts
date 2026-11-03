import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeSha256 } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StoredFileMetadata {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface IFileStore {
  put(originalName: string, buffer: Buffer, customKey?: string): Promise<{ storageKey: string; sha256: string; sizeBytes: number }>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<boolean>;
  exists(storageKey: string): Promise<boolean>;
  getFilePath(storageKey: string): string;
}

export class LocalDiskFileStore implements IFileStore {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    // BUG-029: Allow tests to specify an isolated file storage directory
    this.baseDir = customBaseDir || process.env.DOCQA_FILES_DIR || path.resolve(__dirname, '../../data/files');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getFilePath(storageKey: string): string {
    const resolvedBase = path.resolve(this.baseDir);
    const resolvedPath = path.resolve(this.baseDir, storageKey);

    if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
      throw new Error(`Security Exception: Access denied for path traversal attempt: ${storageKey}`);
    }

    return resolvedPath;
  }

  public async put(
    originalName: string,
    buffer: Buffer,
    customKey?: string
  ): Promise<{ storageKey: string; sha256: string; sizeBytes: number }> {
    const sha256 = `sha256:${computeSha256(buffer)}`;
    const sizeBytes = buffer.length;

    let storageKey = customKey;
    if (!storageKey) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const hashPrefix = sha256.slice(7, 15);
      const safeFilename = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
      storageKey = `${year}/${month}/${hashPrefix}_${safeFilename}`;
    }

    const targetPath = this.getFilePath(storageKey);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, buffer);

    return {
      storageKey,
      sha256,
      sizeBytes
    };
  }

  public async get(storageKey: string): Promise<Buffer> {
    const filePath = this.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found in store: ${storageKey}`);
    }
    return fs.readFileSync(filePath);
  }

  public async delete(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(storageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async exists(storageKey: string): Promise<boolean> {
    const filePath = this.getFilePath(storageKey);
    return fs.existsSync(filePath);
  }
}

export const defaultFileStore = new LocalDiskFileStore();
