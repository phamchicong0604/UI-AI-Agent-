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
  TestResultStatus
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
 * 10. SETTINGS & AI KEYS API
 * ----------------------------------------------------------- */
export const settingsApi = {
  async getAiConfig(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/settings/ai`);
  },
  async saveAiConfig(data: {
    provider: string;
    geminiKey?: string;
    openaiKey?: string;
    geminiModel?: string;
    openaiModel?: string;
  }): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/settings/ai`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async testConnection(): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/settings/ai/test-connection`, {
      method: 'POST'
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
  },
  async getBackgroundAgents(): Promise<any[]> {
    return fetchJson<any[]>(`${API_BASE_URL}/agent/background`);
  },
  async startBackgroundAgent(id: string): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/agent/background/${id}/start`, {
      method: 'POST'
    });
  },
  async stopBackgroundAgent(id: string): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/agent/background/${id}/stop`, {
      method: 'POST'
    });
  },
  async triggerBackgroundAgent(id: string): Promise<any> {
    return fetchJson<any>(`${API_BASE_URL}/agent/background/${id}/trigger`, {
      method: 'POST'
    });
  },
  async getBackgroundAgentLogs(id: string): Promise<any[]> {
    return fetchJson<any[]>(`${API_BASE_URL}/agent/background/${id}/logs`);
  }
};

// Aliases for backwards compatibility with earlier components
export const getAiStatus = aiApi.getStatus;
export const requestAiTestCases = aiApi.generateTestCases;
export const requestImpactAnalysis = aiApi.analyzeImpact;
export const verifyAuditChainOnBackend = auditApi.verifyChain;
export const getAiSettings = settingsApi.getAiConfig;
export const saveAiSettings = settingsApi.saveAiConfig;
export const testAiConnection = settingsApi.testConnection;
export const getAgentConfig = agentApi.getConfig;
export const saveAgentConfig = agentApi.saveConfig;
export const generateAgentToken = agentApi.generateToken;
export const executeAgentCommand = agentApi.executeCommand;
export const getBackgroundAgents = agentApi.getBackgroundAgents;
export const startBackgroundAgent = agentApi.startBackgroundAgent;
export const stopBackgroundAgent = agentApi.stopBackgroundAgent;
export const triggerBackgroundAgent = agentApi.triggerBackgroundAgent;
export const getBackgroundAgentLogs = agentApi.getBackgroundAgentLogs;
