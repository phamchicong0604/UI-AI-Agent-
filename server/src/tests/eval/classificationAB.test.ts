import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { app } from '../../app.js';
import { db, dbRepository } from '../../database/db.js';
import { defaultJobQueue } from '../../modules/workflow/jobQueue.js';
import { registerPipelineHandlers } from '../../modules/workflow/pipelineWorker.js';
import { defaultStage2Runner } from '../../modules/ai/stage2Runner.js';
import { signUserSession } from '../../common/auth.js';
import { HELDOUT_CLASSIFICATION_V1 } from './heldoutClassification.v1.js';
import { HELDOUT_CLASSIFICATION_V2 } from './heldoutClassification.v2.js';

/**
 * With/without comparison for M0-T2 through the real upload route and the real PIPELINE_RUN handler.
 *  - "without": the folder right after upload (detectCategory on the file name). Before M0-T2 this was final.
 *  - "with": the folder after the pipeline ran ClassificationScorer.
 *  - "stage2": recommended_category of the Stage 2 fallback generator (existed before, never written to the doc).
 * Only runs when CLASSIFICATION_AB_OUT is set; it is a measurement, not a pass/fail gate.
 */
const OUT = process.env.CLASSIFICATION_AB_OUT;

describe.runIf(!!OUT)('Eval: upload classification with vs without ClassificationScorer', () => {
  let server: http.Server;
  let baseUrl: string;
  const projectId = `PRJ-AB-${Date.now()}`;
  const adminToken = signUserSession({ id: 'usr_admin', username: 'admin', name: 'Alex Nguyen', role: 'Project Admin' });

  const upload = async (fileName: string, content: string) => {
    const boundary = `----DocQABoundary${randomUUID().replace(/-/g, '')}`;
    const body = [
      `--${boundary}`, 'Content-Disposition: form-data; name="projectId"', '', projectId,
      `--${boundary}`, `Content-Disposition: form-data; name="files"; filename="${fileName}"`,
      'Content-Type: text/markdown', '', content, `--${boundary}--`
    ].join('\r\n');
    const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, Authorization: `Bearer ${adminToken}` },
      body
    });
    const json = (await res.json()) as any;
    if (![200, 201].includes(res.status) || json?.data?.documents?.length !== 1) {
      throw new Error(`upload failed for ${fileName}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    }
    return json.data.documents[0] as { id: string; category: string; title: string };
  };

  const drain = async () => {
    for (let i = 0; i < 20; i++) {
      if ((await defaultJobQueue.processNext(5)) === 0) break;
    }
  };

  beforeAll(async () => {
    registerPipelineHandlers();
    db.prepare("UPDATE users SET must_change_password = 0 WHERE id = 'usr_admin'").run();
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
      VALUES (?, 'AB Eval Project', 'AB', 'Desc', 'v1.0', 'Admin', 1, '{}', datetime('now'), datetime('now'))
    `).run(projectId);
    db.prepare("INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, 'usr_admin', 'Project Admin', datetime('now'))")
      .run(`pm_${projectId}_admin`, projectId);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('measures both arms on the held-out sets and on dataset.v1', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const v1 = JSON.parse(fs.readFileSync(path.join(here, 'dataset.v1.json'), 'utf8')) as any[];

    const cases = [
      ...HELDOUT_CLASSIFICATION_V1.map(d => ({ set: 'heldout.v1', ...d })),
      ...HELDOUT_CLASSIFICATION_V2.map(d => ({ set: 'heldout.v2', ...d })),
      ...v1.map(d => ({
        set: 'dataset.v1', id: d.id, fileName: path.basename(d.filePath), nameType: 'descriptive', language: d.language,
        expected: d.groundTruth.primaryCategory,
        // dataset.v1 keeps headings apart from content; rebuild one markdown file as an uploader would send it
        content: [...(d.headings || []), d.content].join('\n')
      }))
    ];

    const rows: any[] = [];
    for (const c of cases) {
      const created = await upload(c.fileName, c.content);
      const t0 = performance.now();
      await drain();
      const pipelineMs = performance.now() - t0;
      const doc = dbRepository.documents.getById(created.id)!;
      const version = db.prepare('SELECT status FROM document_versions WHERE document_id = ?').get(created.id) as { status: string };
      const stage2 = JSON.parse(defaultStage2Runner.generateFallbackResponse('eval', created.title, c.content));
      rows.push({
        set: c.set, id: c.id, fileName: c.fileName, nameType: c.nameType, language: c.language, expected: c.expected,
        without: created.category,
        withScorer: doc.category,
        suggested: doc.classification?.suggestedCategory ?? null,
        score: doc.classification?.score ?? null,
        isAmbiguous: doc.classification?.isAmbiguous ?? null,
        needsHumanReview: !!doc.needsHumanReview,
        secondary: doc.secondaryCategories ?? [],
        stage2: stage2.classification?.recommended_category ?? null,
        versionStatus: version?.status,
        pipelineMs: Math.round(pipelineMs * 10) / 10
      });
    }

    fs.mkdirSync(path.dirname(OUT!), { recursive: true });
    fs.writeFileSync(OUT!, JSON.stringify(rows, null, 2));
    expect(rows.length).toBe(cases.length);
  }, 120000);
});
