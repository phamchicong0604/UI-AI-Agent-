import { Migration } from '../migrator.js';
import { migration001InitialSchema } from './001_initial_schema.js';
import { migration002FileStorageAndDocumentVersions } from './002_file_storage_and_document_versions.js';
import { migration003AiTraceabilityAndRelationships } from './003_ai_traceability_and_relationships.js';
import { migration004UploadBatches } from './004_upload_batches.js';
import { migration005JobQueue } from './005_job_queue.js';
import { migration006ProjectAiPolicy } from './006_project_ai_policy.js';
import { migration007KnowledgeUnitsAndConflicts } from './007_knowledge_units_and_conflicts.js';
import { migration008FtsApprovedKnowledge } from './008_fts_approved_knowledge.js';
import { migration009EnforceOfflinePolicyDefault } from './009_enforce_offline_policy_default.js';
import { migration010UsersProjectMembersAndReqProjectId } from './010_users_project_members_and_req_project_id.js';
import { migration011CleanProjectsAndEnforceOfflinePolicy } from './011_clean_projects_and_enforce_offline_policy.js';

export const allMigrations: Migration[] = [
  migration001InitialSchema,
  migration002FileStorageAndDocumentVersions,
  migration003AiTraceabilityAndRelationships,
  migration004UploadBatches,
  migration005JobQueue,
  migration006ProjectAiPolicy,
  migration007KnowledgeUnitsAndConflicts,
  migration008FtsApprovedKnowledge,
  migration009EnforceOfflinePolicyDefault,
  migration010UsersProjectMembersAndReqProjectId,
  migration011CleanProjectsAndEnforceOfflinePolicy
];
