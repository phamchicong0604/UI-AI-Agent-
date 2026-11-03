/**
 * Enterprise API Client connecting Frontend (port 3000) to Backend Server (port 5001)
 * Fully wired to SQLite persistent database and AI engine endpoints.
 */

import {
  DocumentItem,
  RequirementItem,
  EvidenceItem,
  TestCaseItem,
  TestRunItem,
  BugItem,
  AuditEvent,
  StatusLifecycle,
  TestResultStatus,
  ModelOption
} from '../../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || json.message || `HTTP ${res.status}`);
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:5001/health', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------
 * 1. DOCUMENTS API
 * ----------------------------------------------------------- */
export const documentsApi = {
  async getAll(): Promise<DocumentItem[]> {
    return fetchJson<DocumentItem[]>(`${API_BASE_URL}/documents`);
  },
  async getById(id: string): Promise<DocumentItem> {
    return fetchJson<DocumentItem>(`${API_BASE_URL}/documents/${id}`);
  },
  async create(doc: Partial<DocumentItem>): Promise<DocumentItem> {
    return fetchJson<DocumentItem>(`${API_BASE_URL}/documents`, {
      method: 'POST',
      body: JSON.stringify(doc)
    });
  },
  async updateStatus(id: string, status: StatusLifecycle, userRole?: string): Promise<DocumentItem> {
    return fetchJson<DocumentItem>(`${API_BASE_URL}/documents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, userRole })
    });
  }
};

/* -------------------------------------------------------------
 * 2. REQUIREMENTS API
 * ----------------------------------------------------------- */
export const requirementsApi = {
  async getAll(): Promise<RequirementItem[]> {
    return fetchJson<RequirementItem[]>(`${API_BASE_URL}/requirements`);
  },
  async getById(id: string): Promise<RequirementItem> {
    return fetchJson<RequirementItem>(`${API_BASE_URL}/requirements/${id}`);
  },
  async create(req: Partial<RequirementItem>): Promise<RequirementItem> {
    return fetchJson<RequirementItem>(`${API_BASE_URL}/requirements`, {
      method: 'POST',
      body: JSON.stringify(req)
    });
  },
  async updateStatus(id: string, status: StatusLifecycle, userRole?: string): Promise<RequirementItem> {
    return fetchJson<RequirementItem>(`${API_BASE_URL}/requirements/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, userRole })
    });
  }
};

/* -------------------------------------------------------------
 * 3. EVIDENCE (EVD) API
 * ----------------------------------------------------------- */
export const evidenceApi = {
  async getAll(): Promise<EvidenceItem[]> {
    return fetchJson<EvidenceItem[]>(`${API_BASE_URL}/evidence`);
  },
  async getById(id: string): Promise<EvidenceItem> {
    return fetchJson<EvidenceItem>(`${API_BASE_URL}/evidence/${id}`);
  },
  async create(evd: Partial<EvidenceItem>): Promise<EvidenceItem> {
    return fetchJson<EvidenceItem>(`${API_BASE_URL}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evd)
    });
  },
  async verify(id: string, verifiedBy?: string): Promise<EvidenceItem> {
    return fetchJson<EvidenceItem>(`${API_BASE_URL}/evidence/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ verifiedBy })
    });
  }
};

/* -------------------------------------------------------------
 * 4. TEST CASES API (Section 7.1 Workspace)
 * ----------------------------------------------------------- */
export const testCasesApi = {
  async getAll(): Promise<TestCaseItem[]> {
    return fetchJson<TestCaseItem[]>(`${API_BASE_URL}/testcases`);
  },
  async getById(id: string): Promise<TestCaseItem> {
    return fetchJson<TestCaseItem>(`${API_BASE_URL}/testcases/${id}`);
  },
  async getWorkspaceData(id: string): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/testcases/${id}/workspace`);
  },
  async create(tc: Partial<TestCaseItem>): Promise<TestCaseItem> {
    return fetchJson<TestCaseItem>(`${API_BASE_URL}/testcases`, {
      method: 'POST',
      body: JSON.stringify(tc)
    });
  },
  async updateStatus(id: string, status: any, userRole?: string): Promise<TestCaseItem> {
    return fetchJson<TestCaseItem>(`${API_BASE_URL}/testcases/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, userRole })
    });
  },
  async addComment(id: string, comment: { author: string; role: string; content: string; decision?: string }): Promise<TestCaseItem> {
    return fetchJson<TestCaseItem>(`${API_BASE_URL}/testcases/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment)
    });
  }
};

/* -------------------------------------------------------------
 * 5. TEST RUNS API
 * ----------------------------------------------------------- */
export const testRunsApi = {
  async getAll(): Promise<TestRunItem[]> {
    return fetchJson<TestRunItem[]>(`${API_BASE_URL}/testruns`);
  },
  async getById(id: string): Promise<TestRunItem> {
    return fetchJson<TestRunItem>(`${API_BASE_URL}/testruns/${id}`);
  },
  async create(run: Partial<TestRunItem>): Promise<TestRunItem> {
    return fetchJson<TestRunItem>(`${API_BASE_URL}/testruns`, {
      method: 'POST',
      body: JSON.stringify(run)
    });
  },
  async recordResult(runId: string, payload: {
    testCaseId: string;
    status: TestResultStatus;
    actualResult: string;
    executedBy?: string;
    evidenceIds?: string[];
  }): Promise<TestRunItem> {
    return fetchJson<TestRunItem>(`${API_BASE_URL}/testruns/${runId}/execute`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

/* -------------------------------------------------------------
 * 6. BUGS / DEFECTS API
 * ----------------------------------------------------------- */
export const bugsApi = {
  async getAll(): Promise<BugItem[]> {
    return fetchJson<BugItem[]>(`${API_BASE_URL}/bugs`);
  },
  async create(bug: Partial<BugItem>): Promise<BugItem> {
    return fetchJson<BugItem>(`${API_BASE_URL}/bugs`, {
      method: 'POST',
      body: JSON.stringify(bug)
    });
  },
  async updateStatus(id: string, status: any): Promise<BugItem> {
    return fetchJson<BugItem>(`${API_BASE_URL}/bugs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }
};

/* -------------------------------------------------------------
 * 7. AUDIT TRAIL API (Tamper-Evident SHA-256 Chained Block Hash)
 * ----------------------------------------------------------- */
export const auditApi = {
  async getEvents(): Promise<AuditEvent[]> {
    return fetchJson<AuditEvent[]>(`${API_BASE_URL}/audit/events`);
  },
  async logEvent(payload: {
    user: string;
    role: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
  }): Promise<AuditEvent> {
    return fetchJson<AuditEvent>(`${API_BASE_URL}/audit/events`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async verifyChain(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/audit/verify-chain`, {
      method: 'POST'
    });
  }
};

/* -------------------------------------------------------------
 * 8. TRACEABILITY MATRIX API
 * ----------------------------------------------------------- */
export const traceabilityApi = {
  async getMatrix(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/traceability/matrix`);
  }
};

/* -------------------------------------------------------------
 * 9. AI COPILOT API (Section 8 Grounded Synthesis & Blast Radius)
 * ----------------------------------------------------------- */
export const aiApi = {
  async getStatus(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/status`);
  },
  async generateTestCases(requirement: any, sourceDoc?: any, userPrompt?: string): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/generate-testcases`, {
      method: 'POST',
      body: JSON.stringify({ requirement, sourceDoc, userPrompt })
    });
  },
  async analyzeImpact(documentId: string, requirements: any[], testCases: any[]): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/impact-analysis`, {
      method: 'POST',
      body: JSON.stringify({ documentId, requirements, testCases })
    });
  }
};

/* -------------------------------------------------------------
 * 10. UNIFIED AI CONNECTION API
 * ----------------------------------------------------------- */
export const aiConnectionApi = {
  async getConnection(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection`);
  },
  async saveConnection(data: {
    provider?: string;
    authMethod?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    effortLevel?: string;
    maxOutputTokens?: number;
    cliBinary?: string;
  }): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async testConnection(data?: {
    provider?: string;
    authMethod?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    effortLevel?: string;
    maxOutputTokens?: number;
    cliBinary?: string;
  }): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection/test`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    });
  },
  async detectCli(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection/cli-detect`);
  },
  async disconnect(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection/disconnect`, {
      method: 'POST'
    });
  },
  async getModels(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/models`);
  },
  async fetchLiveModels(data?: {
    provider?: string;
    authMethod?: string;
    apiKey?: string;
    baseUrl?: string;
    cliBinary?: string;
  }): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/models/fetch`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    });
  },
  async getQuota(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection/quota`);
  },
  async checkQuota(data?: {
    provider?: string;
    authMethod?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    cliBinary?: string;
  }): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/ai/connection/check-quota`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    });
  }
};

/* -------------------------------------------------------------
 * 11. TERMINAL AGENT & CLI RUNNER API
 * ----------------------------------------------------------- */
export const agentApi = {
  async getConfig(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/agent/config`);
  },
  async saveConfig(data: {
    agentName?: string;
    persona?: string;
    autonomyLevel?: string;
  }): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/agent/config`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async generateToken(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/agent/generate-token`, {
      method: 'POST'
    });
  },
  async executeCommand(command: string): Promise<{
    command: string;
    stdout: string;
    latencyMs: number;
    exitCode: number;
  }> {
    return fetchJson<any>(`${API_BASE_URL}/agent/execute`, {
      method: 'POST',
      body: JSON.stringify({ command })
    });
  }
};

// Aliases for components
export const getAiStatus = aiApi.getStatus;
export const requestAiTestCases = aiApi.generateTestCases;
export const requestImpactAnalysis = aiApi.analyzeImpact;
export const verifyAuditChainOnBackend = auditApi.verifyChain;

// Unified AI Connection aliases
export const getAiConnection = aiConnectionApi.getConnection;
export const saveAiConnection = aiConnectionApi.saveConnection;
export const testAiConnection = aiConnectionApi.testConnection;
export const detectCliTools = aiConnectionApi.detectCli;
export const disconnectAiConnection = aiConnectionApi.disconnect;
export const getAiModels = aiConnectionApi.getModels;
export const fetchAiLiveModels = aiConnectionApi.fetchLiveModels;

/* -------------------------------------------------------------
 * ACCOUNT MODELS (synced from subscription / API key, stored in SQLite)
 * ----------------------------------------------------------- */
export interface AccountModelsResult {
  provider: string;
  authMethod: string;
  source: string;
  synced: boolean;
  account?: string;
  syncedAt?: string;
  models: ModelOption[];
}

export interface AccountModelsSyncResponse {
  ok: boolean;
  message: string;
  data?: AccountModelsResult;
  /** Present on failure */
  code?: 'auth_required' | 'unsupported' | 'not_installed' | 'failed';
  loginCommand?: string;
  saved?: AccountModelsResult | null;
}

/** Reads the model list last saved in the DB for this account (does not call the provider). */
export async function getSavedAccountModels(params: {
  provider: string;
  authMethod: string;
  cliBinary?: string;
}): Promise<AccountModelsResult> {
  const qs = new URLSearchParams({
    provider: params.provider,
    authMethod: params.authMethod,
    ...(params.cliBinary ? { cliBinary: params.cliBinary } : {})
  });
  return fetchJson<AccountModelsResult>(`${API_BASE_URL}/ai/models/account?${qs.toString()}`);
}

/** Queries the account for its models, saves them to the DB and returns the stored list. */
export async function syncAccountModels(params: {
  provider: string;
  authMethod: string;
  cliBinary?: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<AccountModelsSyncResponse> {
  const res = await fetch(`${API_BASE_URL}/ai/models/account/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, message: json.message || '', data: json.data };
  }
  return {
    ok: false,
    message: json.error || `HTTP ${res.status}`,
    code: json.data?.code,
    loginCommand: json.data?.loginCommand,
    saved: json.data?.saved ?? null
  };
}
export const getAiQuota = aiConnectionApi.getQuota;
export const checkAiQuota = aiConnectionApi.checkQuota;

export const getAgentConfig = agentApi.getConfig;
export const saveAgentConfig = agentApi.saveConfig;
export const generateAgentToken = agentApi.generateToken;
export const executeAgentCommand = agentApi.executeCommand;
