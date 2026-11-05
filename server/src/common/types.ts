export type UserRole = 
  | 'Project Admin'
  | 'PM / Project Lead'
  | 'BA'
  | 'Tech Lead / DEV'
  | 'QA'
  | 'Reviewer / Approver';

export type StatusLifecycle = 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Deprecated';

export type AiDataPolicy = 'OFFLINE_ONLY' | 'COMMERCIAL_PRIVATE' | 'ALLOW_EXTERNAL';

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  version: string;
  author: string;
  membersCount: number;
  aiPolicy?: AiDataPolicy;
  createdAt: string;
  updatedAt?: string;
}

export interface StoredFileRecord {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  versionNo: string;
  fileId: string | null;
  extractedContent: string | null;
  status: StatusLifecycle | WorkflowState;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface SkillVersionRecord {
  id: string;
  skillId: string;
  version: string;
  promptTemplate: string;
  promptHash: string;
  inputSchema: string;
  outputSchema: string;
  modelRecommended: string | null;
  createdAt: string;
}

export interface PipelineRunRecord {
  id: string;
  documentVersionId: string;
  skillVersionId: string;
  modelId: string;
  provider: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  inputPayload: string | null;
  outputPayload: string | null;
  tokensPrompt: number;
  tokensCompletion: number;
  latencyMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface ReviewDecisionRecord {
  id: string;
  targetType: 'document_version' | 'knowledge_unit' | 'conflict';
  targetId: string;
  decision: 'Approve' | 'Reject' | 'Request_Changes';
  reviewer: string;
  comment: string | null;
  createdAt: string;
}

export interface DocumentRelationshipRecord {
  id: string;
  sourceDocId: string;
  targetDocId: string;
  relationshipType: 'duplicate_of' | 'version_of' | 'references' | 'supersedes';
  confidenceScore: number;
  createdAt: string;
}

export type KnowledgeUnitType = 'Requirement' | 'BusinessRule' | 'Constraint' | 'Definition';
export type KnowledgeUnitStatus = 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Superseded' | 'Deprecated';

export interface KnowledgeUnitRecord {
  id: string;
  projectId: string;
  unitType: KnowledgeUnitType;
  content: string;
  subject: string;
  action: string;
  condition: string | null;
  evidenceLevel: 'Explicit' | 'Inferred' | 'Assumed' | 'Not Specified' | 'Conflict' | 'Unknown';
  status: KnowledgeUnitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSourceRecord {
  id: string;
  unitId: string;
  documentVersionId: string;
  headingPath: string; // JSON string array
  charOffsetStart: number;
  charOffsetEnd: number;
  pageNumber: number | null;
  exactQuote: string;
  createdAt: string;
}

export type ConflictSeverity = 'Critical' | 'Major' | 'Minor';
export type ConflictResolution = 'KEEP_NEW_SUPERSEDE_OLD' | 'REJECT_NEW_PRESERVE_OLD' | 'MERGE_SPECIFICATION' | 'UNRESOLVED';

export interface ConflictRecord {
  id: string;
  projectId: string;
  unitAId: string;
  unitBId: string;
  conflictType: 'Contradiction' | 'Ambiguity' | 'Redundancy';
  severity: ConflictSeverity;
  description: string;
  resolution: ConflictResolution;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
}

export type UploadBatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface UploadBatchItemDetail {
  filename: string;
  status: 'SUCCESS' | 'FAILED' | 'DUPLICATE';
  documentId?: string;
  duplicateOfId?: string;
  error?: string;
  sizeBytes?: number;
}

export interface UploadBatchRecord {
  id: string;
  projectId: string;
  filename: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  status: UploadBatchStatus;
  errorSummary: string | null;
  batchDetails: string | null; // JSON string of UploadBatchItemDetail[]
  createdAt: string;
}

export type WorkflowState = 
  | 'UPLOADED'
  | 'FILE_PROCESSING'
  | 'AI_ANALYSIS'
  | 'VALIDATION'
  | 'REVIEW_REQUIRED'
  | 'ORGANIZED'
  | 'FEEDBACK_REQUIRED'
  | 'REANALYSIS'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUPERSEDED';

export type JobType = 
  | 'EXTRACT_FILE'
  | 'PIPELINE_RUN'
  | 'SEMANTIC_VALIDATION'
  | 'PROMOTE_KNOWLEDGE'
  | 'REINDEX_FTS';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobRecord {
  id: string;
  type: JobType;
  documentId?: string;
  payload: string; // JSON string
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lockedBy: string | null;
  lockedAt: string | null;
  nextRunAt: string;
  lastError: string | null;
  result: string | null; // JSON string
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  version: string;
  updatedAt: string;
  author: string;
  status: StatusLifecycle;
  changeSummary: string;
  fileSize: string;
  checksum: string;
}

export type DocumentCategory = 
  | '01_Project_Overview'
  | '02_Business_Requirements'
  | '03_System_Requirements'
  | '04_UI_UX'
  | '05_Technical_Documents'
  | '06_QA'
  | '07_EVD_Evidence'
  | '08_Change_History';

export interface DocumentItem {
  id: string;
  projectId?: string;
  title: string;
  category: DocumentCategory;
  currentVersion: string;
  status: StatusLifecycle;
  author: string;
  updatedAt: string;
  description: string;
  contentMarkdown?: string;
  tags: string[];
  versions: DocumentVersion[];
  linkedRequirementsCount: number;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  completed: boolean;
}

export interface SourceReference {
  documentId: string;
  documentTitle: string;
  version: string;
  section: string;
}

export type RequirementType = 'Business' | 'Functional' | 'Non-functional' | 'Technical';
export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface RequirementItem {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  type: RequirementType;
  priority: PriorityLevel;
  businessRules: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  sourceReferences: SourceReference[];
  status: StatusLifecycle;
  owner: string;
  approver: string;
  relatedUI?: string;
  relatedAPI?: string;
  createdAt: string;
  updatedAt: string;
  isAiGenerated?: boolean;
}

export type EvidenceType = 'Screenshot' | 'Video' | 'Log' | 'API Response' | 'File' | 'Approval Record';
export type EvidenceStatus = 'Draft' | 'Submitted' | 'Verified' | 'Rejected' | 'Archived';
export type Environment = 'DEV' | 'QA' | 'STG' | 'PROD';

export interface EvidenceLink {
  targetType: 'Requirement' | 'TestCase' | 'TestRun' | 'Bug' | 'Document';
  targetId: string;
  targetTitle: string;
  purpose: string;
}

export interface EvidenceItem {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  type: EvidenceType;
  environment: Environment;
  buildVersion: string;
  status: EvidenceStatus;
  storageRef: string;
  fileSize: string;
  storageChecksum: string;
  previewUrl?: string;
  logPayload?: string;
  createdBy: string;
  createdAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  links: EvidenceLink[];
}

export interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  testData?: string;
}

export interface ReviewComment {
  id: string;
  author: string;
  role: UserRole;
  content: string;
  createdAt: string;
  decision?: 'Approved' | 'Changes Requested';
}

export type TestCaseType = 'Positive' | 'Negative' | 'Boundary' | 'Permission' | 'Security';

export interface TestCaseItem {
  id: string;
  requirementId: string;
  requirementTitle: string;
  title: string;
  scenario: string;
  preconditions: string;
  testData: string;
  type: TestCaseType;
  priority: PriorityLevel;
  status: StatusLifecycle | 'Ready for Execution';
  version: string;
  sourceReferences: SourceReference[];
  steps: TestStep[];
  reviewComments: ReviewComment[];
  relatedEvidenceIds: string[];
  createdAt: string;
  updatedAt: string;
  isAiDrafted?: boolean;
  sourceCitationHash?: string;
}

export type TestResultStatus = 'Pass' | 'Fail' | 'Blocked' | 'Not Applicable' | 'Not Run';

export interface TestExecutionRecord {
  testCaseId: string;
  testCaseTitle: string;
  status: TestResultStatus;
  actualResult: string;
  executedBy?: string;
  executedAt?: string;
  evidenceIds: string[];
  bugId?: string;
}

export interface TestRunItem {
  id: string;
  projectId?: string;
  title: string;
  environment: Environment;
  buildVersion: string;
  scope: string;
  status: 'Planning' | 'In Progress' | 'Completed';
  createdBy: string;
  createdAt: string;
  records: TestExecutionRecord[];
}

export type BugSeverity = 'Critical' | 'Major' | 'Minor' | 'Trivial';
export type BugStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface BugItem {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  severity: BugSeverity;
  priority: PriorityLevel;
  status: BugStatus;
  assignee: string;
  environment: Environment;
  buildVersion: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  linkedRequirementId?: string;
  linkedTestCaseId?: string;
  linkedTestRunId?: string;
  linkedEvidenceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  user: string;
  role: UserRole;
  action: string;
  entityType: 'Document' | 'Requirement' | 'TestCase' | 'Evidence' | 'TestRun' | 'Bug' | 'Conflict' | 'User';
  entityId: string;
  details: string;
  timestamp: string;
  eventHash: string;
  previousEventHash?: string;
}

export type AiProviderId = 'google' | 'anthropic' | 'openai' | 'custom';
export type AiAuthMethod = 'api_key' | 'cli_subscription';
export type AiConnectionStatus = 'connected' | 'disconnected' | 'auth_required' | 'error';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
  contextWindow: string;
  maxOutput: string;
  category: 'reasoning' | 'fast' | 'flagship' | 'local';
  rateLimits: {
    rpm: number;
    tpm: number;
    rpd?: number;
  };
  pricingType: 'token_billed' | 'subscription_included';
  bestFor: string;
  isLive?: boolean;
  /** Where the model entry came from: e.g. "cli:agy", "api:google", "catalog" */
  source?: string;
  /** Account / subscription identity the model list was synced for */
  account?: string;
  /** ISO timestamp of the last successful sync from the provider account */
  syncedAt?: string;
}

/** A persisted snapshot of the model list available to one provider account */
export interface AccountModelSnapshot {
  provider: AiProviderId;
  authMethod: AiAuthMethod;
  source: string;
  account?: string;
  syncedAt?: string;
  models: ModelOption[];
}

export interface AiQuotaInfo {
  provider: AiProviderId;
  authMethod: AiAuthMethod;
  model: string;
  planName: string;
  status: 'healthy' | 'warning' | 'exhausted' | 'auth_required';
  statusLabel: string;
  rateLimits: {
    rpm: number;
    tpm: number;
    rpd?: number;
    contextWindow: string;
    maxOutput: string;
  };
  usage: {
    requestsToday: number;
    estimatedTokensToday: number;
    remainingQuotaPercent?: number;
    resetTimeDescription: string;
    billingModel: 'subscription_included' | 'pay_per_token';
  };
  accountDetails?: {
    account?: string;
    tier?: string;
    subscriptionPeriod?: string;
    rawLimits?: Record<string, any>;
  };
}

export type ReasoningEffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AiConnectionConfig {
  id: string;
  provider: AiProviderId;
  authMethod: AiAuthMethod;
  apiKey?: string;
  maskedApiKey?: string;
  baseUrl?: string;
  model: string;
  effortLevel?: ReasoningEffortLevel;
  maxOutputTokens?: number;
  cliBinary?: string;
  cliVersion?: string;
  cliAuthStatus?: 'authenticated' | 'unauthenticated' | 'not_found';
  connectionStatus: AiConnectionStatus;
  lastTestedAt?: string;
  latencyMs?: number;
  errorMessage?: string;
  updatedAt: string;
}

export interface CliDetectionInfo {
  id: string;
  provider: AiProviderId;
  name: string;
  binary: string;
  installed: boolean;
  version?: string;
  path?: string;
  authStatus: 'authenticated' | 'unauthenticated' | 'unknown' | 'not_installed';
  account?: string;
  loginCommand: string;
}
