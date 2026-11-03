import { Migration } from '../migrator.js';
import { migration001InitialSchema } from './001_initial_schema.js';
import { migration002FileStorageAndDocumentVersions } from './002_file_storage_and_document_versions.js';
import { migration003AiTraceabilityAndRelationships } from './003_ai_traceability_and_relationships.js';
import { migration004UploadBatches } from './004_upload_batches.js';

export const allMigrations: Migration[] = [
  migration001InitialSchema,
  migration002FileStorageAndDocumentVersions,
  migration003AiTraceabilityAndRelationships,
  migration004UploadBatches
];
