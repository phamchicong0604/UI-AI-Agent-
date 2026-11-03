import { describe, it, expect } from 'vitest';
import { dbRepository } from '../database/db.js';
import { defaultFileStore } from '../common/fileStore.js';
import { computeSha256 } from '../common/crypto.js';

describe('Document Versions & Stored Files (E1-T3)', () => {
  it('should have populated document_versions for seeded baseline documents', () => {
    const versionsDoc1 = dbRepository.documentVersions.getByDocumentId('DOC-01');
    expect(versionsDoc1.length).toBeGreaterThanOrEqual(1);

    const v1 = versionsDoc1[0];
    expect(v1.documentId).toBe('DOC-01');
    expect(v1.versionNo).toBe('v1.0');
    expect(v1.extractedContent).toBeDefined();

    if (v1.fileId) {
      const stored = dbRepository.storedFiles.getById(v1.fileId);
      expect(stored).toBeDefined();
      expect(stored?.sha256.startsWith('sha256:')).toBe(true);
    }
  });

  it('should store, retrieve and verify stored files with byte-for-byte integrity', async () => {
    const originalText = '# Project Alpha Security Spec\n\nConfidential specification.';
    const buffer = Buffer.from(originalText, 'utf-8');
    const sha256 = `sha256:${computeSha256(buffer)}`;

    const { storageKey } = await defaultFileStore.put('alpha-sec.md', buffer);

    const fileId = `FILE-${sha256.slice(7, 17)}`;
    dbRepository.storedFiles.upsert({
      id: fileId,
      storageKey,
      originalName: 'alpha-sec.md',
      mimeType: 'text/markdown',
      sizeBytes: buffer.length,
      sha256,
      createdAt: '2026-11-03'
    });

    const fetchedFile = dbRepository.storedFiles.getById(fileId);
    expect(fetchedFile).toBeDefined();
    expect(fetchedFile?.originalName).toBe('alpha-sec.md');
    expect(fetchedFile?.sha256).toBe(sha256);

    // Retrieve byte-for-byte
    const retrievedBuffer = await defaultFileStore.get(fetchedFile!.storageKey);
    expect(retrievedBuffer.equals(buffer)).toBe(true);
    expect(retrievedBuffer.toString('utf-8')).toBe(originalText);

    // Clean up
    await defaultFileStore.delete(storageKey);
  });

  it('should support multi-version tracking for a document', () => {
    const docId = 'DOC-MULTI-VER-TEST';

    // Insert parent document first
    dbRepository.documents.upsert({
      id: docId,
      projectId: 'PRJ-01',
      title: 'Multi-version Document Test',
      category: '01_Project_Overview',
      currentVersion: 'v1.1',
      status: 'In Review',
      author: 'Author A',
      updatedAt: '2026-11-02',
      description: 'Testing version cascading',
      tags: ['Test'],
      linkedRequirementsCount: 0,
      versions: []
    });

    // Version 1.0
    dbRepository.documentVersions.upsert({
      id: `${docId}-v1.0`,
      documentId: docId,
      versionNo: 'v1.0',
      fileId: null,
      extractedContent: 'Initial draft v1.0',
      status: 'Draft',
      changeSummary: 'First revision',
      createdBy: 'Author A',
      createdAt: '2026-11-01'
    });

    // Version 1.1
    dbRepository.documentVersions.upsert({
      id: `${docId}-v1.1`,
      documentId: docId,
      versionNo: 'v1.1',
      fileId: null,
      extractedContent: 'Updated spec v1.1',
      status: 'In Review',
      changeSummary: 'Added acceptance criteria',
      createdBy: 'Author B',
      createdAt: '2026-11-02'
    });

    const versions = dbRepository.documentVersions.getByDocumentId(docId);
    expect(versions.length).toBe(2);
    expect(versions[0].versionNo).toBe('v1.0');
    expect(versions[1].versionNo).toBe('v1.1');
    expect(versions[1].status).toBe('In Review');

    // Clean up
    dbRepository.documents.delete(docId);
    expect(dbRepository.documentVersions.getByDocumentId(docId).length).toBe(0);
  });
});
