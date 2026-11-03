import { SkillRecord, SkillVersionRecord, PipelineRunRecord } from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { computeSha256 } from '../../common/crypto.js';

export interface SkillDefinition {
  skillId: string;
  name: string;
  description: string;
  promptTemplate: string;
  inputSchema: any;
  outputSchema: any;
  modelRecommended?: string;
}

export class SkillRegistry {
  /**
   * Register or retrieve an existing version of a skill.
   * If prompt or schema has changed, a new version is created (E4-T2.2).
   */
  public registerOrGetVersion(def: SkillDefinition): SkillVersionRecord {
    // 1. Ensure parent skill exists
    const existingSkill = db.prepare('SELECT id FROM skills WHERE id = ? OR name = ?').get(def.skillId, def.name) as any;
    if (!existingSkill) {
      db.prepare(`
        INSERT OR IGNORE INTO skills (id, name, description, created_at)
        VALUES (?, ?, ?, ?)
      `).run(def.skillId, def.name, def.description, new Date().toISOString());
    } else {
      def.skillId = existingSkill.id;
    }

    // 2. Compute prompt and schema hash
    const inputSchemaStr = typeof def.inputSchema === 'string' ? def.inputSchema : JSON.stringify(def.inputSchema);
    const outputSchemaStr = typeof def.outputSchema === 'string' ? def.outputSchema : JSON.stringify(def.outputSchema);
    const hashContent = `${def.promptTemplate}|${inputSchemaStr}|${outputSchemaStr}`;
    const promptHash = `sha256:${computeSha256(hashContent)}`;

    // 3. Check if exact version with this hash already exists
    const match = db.prepare(`
      SELECT id, skill_id as skillId, version, prompt_template as promptTemplate,
             prompt_hash as promptHash, input_schema as inputSchema,
             output_schema as outputSchema, model_recommended as modelRecommended,
             created_at as createdAt
      FROM skill_versions
      WHERE skill_id = ? AND prompt_hash = ?
      LIMIT 1
    `).get(def.skillId, promptHash) as SkillVersionRecord | undefined;

    if (match) {
      return match;
    }

    // 4. Generate next semantic version
    const versions = db.prepare(`
      SELECT version FROM skill_versions WHERE skill_id = ? ORDER BY created_at DESC
    `).all(def.skillId) as { version: string }[];

    let nextVer = '1.0.0';
    if (versions.length > 0) {
      const parts = versions[0].version.split('.').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        nextVer = `${parts[0]}.${parts[1] + 1}.0`;
      } else {
        nextVer = `${versions.length + 1}.0.0`;
      }
    }

    const versionId = `${def.skillId}@${nextVer}`;
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO skill_versions (id, skill_id, version, prompt_template, prompt_hash, input_schema, output_schema, model_recommended, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      def.skillId,
      nextVer,
      def.promptTemplate,
      promptHash,
      inputSchemaStr,
      outputSchemaStr,
      def.modelRecommended || 'gemini-1.5-flash',
      timestamp
    );

    return {
      id: versionId,
      skillId: def.skillId,
      version: nextVer,
      promptTemplate: def.promptTemplate,
      promptHash,
      inputSchema: inputSchemaStr,
      outputSchema: outputSchemaStr,
      modelRecommended: def.modelRecommended || null,
      createdAt: timestamp
    };
  }

  /**
   * Check cache in pipeline_runs by documentVersionId, skillVersionId, modelId (E4-T2.3)
   */
  public getCachedOutput(documentVersionId: string, skillVersionId: string, modelId: string): PipelineRunRecord | null {
    const row = db.prepare(`
      SELECT id, document_version_id as documentVersionId, skill_version_id as skillVersionId,
             model_id as modelId, provider, status, input_payload as inputPayload,
             output_payload as outputPayload, tokens_prompt as tokensPrompt,
             tokens_completion as tokensCompletion, latency_ms as latencyMs,
             error_message as errorMessage, created_at as createdAt
      FROM pipeline_runs
      WHERE document_version_id = ? AND skill_version_id = ? AND model_id = ? AND status = 'SUCCESS'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(documentVersionId, skillVersionId, modelId) as PipelineRunRecord | undefined;

    return row || null;
  }

  /**
   * Save a completed pipeline run into SQLite
   */
  public saveRun(run: PipelineRunRecord): void {
    dbRepository.pipelineRuns.upsert(run);
  }
}

export const defaultSkillRegistry = new SkillRegistry();
