export type UserRole = 
  | 'Project Admin'
  | 'PM / Project Lead'
  | 'BA'
  | 'Tech Lead / DEV'
  | 'QA'
  | 'Reviewer / Approver';

export type StatusLifecycle = 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Deprecated';

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
  entityType: 'Document' | 'Requirement' | 'TestCase' | 'Evidence' | 'TestRun' | 'Bug';
  entityId: string;
  details: string;
  timestamp: string;
  eventHash: string;
  previousEventHash?: string;
}

export type AiProviderId = 'google' | 'anthropic' | 'openai' | 'custom';
export type AiAuthMethod = 'api_key' | 'cli_subscription';
export type AiConnectionStatus = 'connected' | 'disconnected' | 'auth_required' | 'error';

export interface AiConnectionConfig {
  id: string;
  provider: AiProviderId;
  authMethod: AiAuthMethod;
  apiKey?: string;
  maskedApiKey?: string;
  baseUrl?: string;
  model: string;
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
