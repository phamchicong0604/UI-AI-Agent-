import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import AdmZip from 'adm-zip';
import { db, dbRepository } from '../database/db.js';
import { documentsRouter } from '../modules/documents/documents.router.js';

describe('Upload Batches & Duplicate Detection (E2-T2)', () => {
  let testProjectId: string;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/documents', documentsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    testProjectId = `PRJ-BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Ensure test project exists in db
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testProjectId,
      'Test Batch Project',
      'TBP',
      'Project for testing upload batches and duplicate detection',
      'v1.0.0',
      'Tester',
      5,
      JSON.stringify({ id: testProjectId, name: 'Test Batch Project' }),
      new Date().toISOString(),
      new Date().toISOString()
    );
  });

  it('should create and retrieve upload_batches record from database repository', () => {
    const batchId = `BATCH-${Date.now()}`;
    dbRepository.uploadBatches.upsert({
      id: batchId,
      projectId: testProjectId,
      filename: 'sample_batch.zip',
      totalFiles: 3,
      processedFiles: 2,
      failedFiles: 1,
      status: 'PARTIAL',
      errorSummary: 'file3.exe: Disallowed format',
      batchDetails: JSON.stringify([
        { filename: 'file1.md', status: 'SUCCESS' },
        { filename: 'file2.md', status: 'SUCCESS' },
        { filename: 'file3.exe', status: 'FAILED', error: 'Disallowed format' }
      ]),
      createdAt: new Date().toISOString()
    });

    const retrieved = dbRepository.uploadBatches.getById(batchId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(batchId);
    expect(retrieved?.projectId).toBe(testProjectId);
    expect(retrieved?.status).toBe('PARTIAL');
    expect(retrieved?.totalFiles).toBe(3);
    expect(retrieved?.processedFiles).toBe(2);
    expect(retrieved?.failedFiles).toBe(1);

    const projectBatches = dbRepository.uploadBatches.getByProjectId(testProjectId);
    expect(projectBatches.some(b => b.id === batchId)).toBe(true);
  });

  it('should process ZIP archive where 1 corrupt file out of 5 does not fail the batch and marks status PARTIAL', async () => {
    const zip = new AdmZip();
    // 4 valid markdown files
    zip.addFile('doc_01.md', Buffer.from('# Section 1\nValid markdown content 1.', 'utf-8'));
    zip.addFile('doc_02.md', Buffer.from('# Section 2\nValid markdown content 2.', 'utf-8'));
    zip.addFile('doc_03.md', Buffer.from('# Section 3\nValid markdown content 3.', 'utf-8'));
    zip.addFile('doc_04.md', Buffer.from('# Section 4\nValid markdown content 4.', 'utf-8'));

    // 1 corrupt/disallowed file (binary null bytes pretending to be markdown)
    const corruptBuffer = Buffer.from('Normal prefix\x00\x00\x00Binary payload');
    zip.addFile('doc_05_corrupt.md', corruptBuffer);

    const zipBuffer = zip.toBuffer();
    const initialDocs = dbRepository.documents.getAll(testProjectId).length;

    const formData = new FormData();
    formData.append('projectId', testProjectId);
    formData.append('files', new Blob([zipBuffer], { type: 'application/zip' }), 'multi_test_package.zip');

    const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
      method: 'POST',
      body: formData
    });

    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.status).toBe('PARTIAL');
    expect(data.totalFiles).toBe(5);
    expect(data.processedFiles).toBe(4);
    expect(data.failedFiles).toBe(1);

    // Verify 4 documents were created
    const finalDocs = dbRepository.documents.getAll(testProjectId).length;
    expect(finalDocs - initialDocs).toBe(4);

    // Verify batch details itemization
    const details = data.batchDetails;
    expect(details.length).toBe(5);
    const failedItem = details.find((d: any) => d.status === 'FAILED');
    expect(failedItem).toBeDefined();
    expect(failedItem.filename).toBe('doc_05_corrupt.md');
    expect(failedItem.error).toContain('chứa mã nhị phân không hợp lệ');

    // Verify batch record in SQLite
    const batchInDb = dbRepository.uploadBatches.getById(data.batchId);
    expect(batchInDb).not.toBeNull();
    expect(batchInDb?.status).toBe('PARTIAL');
    expect(batchInDb?.processedFiles).toBe(4);
    expect(batchInDb?.failedFiles).toBe(1);
  });

  it('should detect identical file by sha256 in same project and create duplicate_of relationship instead of duplicate document', async () => {
    const uniqueContent = `# Unique Spec Document ${Date.now()}\nThis is a unique specification file for testing duplicate detection.`;
    const docBuffer = Buffer.from(uniqueContent, 'utf-8');

    // 1. First upload: Creates document
    const form1 = new FormData();
    form1.append('projectId', testProjectId);
    form1.append('files', new Blob([docBuffer], { type: 'text/markdown' }), 'unique_spec_v1.md');

    const res1 = await fetch(`${baseUrl}/api/v1/documents/upload`, {
      method: 'POST',
      body: form1
    });

    expect(res1.status).toBe(201);
    const json1 = await res1.json() as any;
    expect(json1.data.processedFiles).toBe(1);
    const createdDoc = json1.data.documents[0];
    expect(createdDoc).toBeDefined();
    const createdDocId = createdDoc.id;

    const docsAfterFirst = dbRepository.documents.getAll(testProjectId).length;

    // 2. Second upload: Identical content with different filename
    const form2 = new FormData();
    form2.append('projectId', testProjectId);
    form2.append('files', new Blob([docBuffer], { type: 'text/markdown' }), 'unique_spec_copy.md');

    const res2 = await fetch(`${baseUrl}/api/v1/documents/upload`, {
      method: 'POST',
      body: form2
    });

    expect(res2.status).toBe(201);
    const json2 = await res2.json() as any;
    const data2 = json2.data;
    expect(data2.processedFiles).toBe(0);
    expect(data2.duplicateCount).toBe(1);
    expect(data2.status).toBe('COMPLETED');

    // Document count in this project must NOT have increased
    const docsAfterSecond = dbRepository.documents.getAll(testProjectId).length;
    expect(docsAfterSecond).toBe(docsAfterFirst);

    // Batch details must indicate DUPLICATE and point to the original document ID
    const duplicateDetail = data2.batchDetails.find((d: any) => d.status === 'DUPLICATE');
    expect(duplicateDetail).toBeDefined();
    expect(duplicateDetail.duplicateOfId).toBe(createdDocId);

    // Verify duplicate_of relationship was created in document_relationships table
    const relationships = dbRepository.documentRelationships.getByDocument(createdDocId);
    const duplicateRel = relationships.find(r => r.relationshipType === 'duplicate_of');
    expect(duplicateRel).toBeDefined();
    expect(duplicateRel?.relationshipType).toBe('duplicate_of');
  });

  it('should query upload batch status via GET /api/v1/documents/batches/:id', async () => {
    const content = '# Heading Batch Query\nText for batch query test.';
    const buffer = Buffer.from(content, 'utf-8');

    const form = new FormData();
    form.append('projectId', testProjectId);
    form.append('files', new Blob([buffer], { type: 'text/markdown' }), 'query_test.md');

    const uploadRes = await fetch(`${baseUrl}/api/v1/documents/upload`, {
      method: 'POST',
      body: form
    });

    expect(uploadRes.status).toBe(201);
    const uploadJson = await uploadRes.json() as any;
    const batchId = uploadJson.data.batchId;

    const queryRes = await fetch(`${baseUrl}/api/v1/documents/batches/${batchId}`);
    expect(queryRes.status).toBe(200);
    const queryJson = await queryRes.json() as any;
    expect(queryJson.success).toBe(true);
    expect(queryJson.data.id).toBe(batchId);
    expect(queryJson.data.status).toBe('COMPLETED');
    expect(Array.isArray(queryJson.data.batchDetails)).toBe(true);
  });
});
