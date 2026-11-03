import { Database } from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration008FtsApprovedKnowledge: Migration = {
  version: '008',
  name: 'fts_approved_knowledge',
  up: (db: Database) => {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS approved_knowledge_fts USING fts5(
        unit_id UNINDEXED,
        project_id UNINDEXED,
        subject,
        content,
        tokenize = 'unicode61'
      );

      -- Populate initial approved units if any exist
      INSERT INTO approved_knowledge_fts (unit_id, project_id, subject, content)
      SELECT id, project_id, subject, content
      FROM knowledge_units
      WHERE status = 'Approved';

      -- Triggers to maintain approved_knowledge_fts automatically
      CREATE TRIGGER IF NOT EXISTS trg_ku_insert_approved AFTER INSERT ON knowledge_units
      WHEN NEW.status = 'Approved'
      BEGIN
        INSERT INTO approved_knowledge_fts (unit_id, project_id, subject, content)
        VALUES (NEW.id, NEW.project_id, NEW.subject, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS trg_ku_update_approved AFTER UPDATE OF status, subject, content ON knowledge_units
      BEGIN
        DELETE FROM approved_knowledge_fts WHERE unit_id = OLD.id;
        INSERT INTO approved_knowledge_fts (unit_id, project_id, subject, content)
        SELECT NEW.id, NEW.project_id, NEW.subject, NEW.content
        WHERE NEW.status = 'Approved';
      END;

      CREATE TRIGGER IF NOT EXISTS trg_ku_delete_approved AFTER DELETE ON knowledge_units
      BEGIN
        DELETE FROM approved_knowledge_fts WHERE unit_id = OLD.id;
      END;
    `);
  },
  down: (db: Database) => {
    db.exec(`
      DROP TRIGGER IF EXISTS trg_ku_delete_approved;
      DROP TRIGGER IF EXISTS trg_ku_update_approved;
      DROP TRIGGER IF EXISTS trg_ku_insert_approved;
      DROP TABLE IF EXISTS approved_knowledge_fts;
    `);
  }
};
