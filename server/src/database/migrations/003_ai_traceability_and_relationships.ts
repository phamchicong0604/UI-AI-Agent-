import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';
import { computeSha256 } from '../../common/crypto.js';

export const migration003AiTraceabilityAndRelationships: Migration = {
  version: '003',
  name: 'ai_traceability_and_relationships',
  up: (db: Database.Database) => {
    // 1. Create AI Traceability & Governance Tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skill_versions (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL,
        version TEXT NOT NULL,
        prompt_template TEXT NOT NULL,
        prompt_hash TEXT NOT NULL,
        input_schema TEXT NOT NULL,
        output_schema TEXT NOT NULL,
        model_recommended TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
        UNIQUE(skill_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions (skill_id);

      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id TEXT PRIMARY KEY,
        document_version_id TEXT NOT NULL,
        skill_version_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'google',
        status TEXT NOT NULL DEFAULT 'PENDING',
        input_payload TEXT,
        output_payload TEXT,
        tokens_prompt INTEGER DEFAULT 0,
        tokens_completion INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_version_id) REFERENCES skill_versions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_doc_ver ON pipeline_runs (document_version_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_skill_ver ON pipeline_runs (skill_version_id);

      CREATE TABLE IF NOT EXISTS review_decisions (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_review_decisions_target ON review_decisions (target_type, target_id);

      CREATE TABLE IF NOT EXISTS document_relationships (
        id TEXT PRIMARY KEY,
        source_doc_id TEXT NOT NULL,
        target_doc_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence_score REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_doc_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (target_doc_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_doc_rel_source ON document_relationships (source_doc_id);
      CREATE INDEX IF NOT EXISTS idx_doc_rel_target ON document_relationships (target_doc_id);
    `);

    // 2. Seed Baseline AI Skills (6 core skills from E4-T1)
    const initialSkills = [
      { id: 'SKILL-INTAKE', name: 'Intake', desc: 'File intake, security delimiter wrapping and format normalization' },
      { id: 'SKILL-UNDERSTANDING', name: 'Understanding', desc: 'Document intent parsing, executive summary and structural breakdown' },
      { id: 'SKILL-EXTRACTION', name: 'Extraction', desc: 'Atomic rule, requirement candidate and constraint extraction' },
      { id: 'SKILL-CLASSIFICATION', name: 'Classification', desc: 'Taxonomy classification into 8 standard project folders' },
      { id: 'SKILL-VALIDATION', name: 'Semantic Validation', desc: 'Consistency checking and contradiction detection with approved knowledge' },
      { id: 'SKILL-ORGANIZATION', name: 'Organization', desc: 'Traceability graph synthesis and knowledge linking' }
    ];

    const insertSkill = db.prepare(`
      INSERT OR IGNORE INTO skills (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const insertSkillVersion = db.prepare(`
      INSERT OR IGNORE INTO skill_versions (id, skill_id, version, prompt_template, prompt_hash, input_schema, output_schema, model_recommended, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = '2026-11-01 00:00:00';

    for (const skill of initialSkills) {
      insertSkill.run(skill.id, skill.name, skill.desc, now);

      const promptTemplate = `System Prompt for Skill: ${skill.name}. All input documents must be validated against schema.`;
      const promptHash = `sha256:${computeSha256(promptTemplate)}`;
      const inputSchema = JSON.stringify({ type: 'object', properties: { text: { type: 'string' } }, required: ['text'] });
      const outputSchema = JSON.stringify({ type: 'object', properties: { results: { type: 'array' } }, required: ['results'] });

      insertSkillVersion.run(
        `${skill.id}@1.0.0`,
        skill.id,
        '1.0.0',
        promptTemplate,
        promptHash,
        inputSchema,
        outputSchema,
        'gemini-3.8-flash-medium',
        now
      );
    }
  }
};
