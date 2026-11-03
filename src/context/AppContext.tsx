import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Project,
  UserRole,
  DocumentItem,
  RequirementItem,
  EvidenceItem,
  TestCaseItem,
  TestRunItem,
  BugItem,
  AuditEvent,
  ClarificationQuestion,
  StatusLifecycle,
  TestResultStatus
} from '../types';
import {
  initialProjects,
  initialDocuments,
  initialRequirements,
  initialEvidences,
  initialTestCases,
  initialTestRuns,
  initialBugs,
  initialAuditEvents,
  initialClarificationQuestions
} from '../data/mockData';
import { syncSha256 } from '../common/utils/hash';
import { loadFromStorage, saveToStorage } from '../common/utils/storage';
import {
  checkBackendHealth,
  projectsApi,
  documentsApi,
  requirementsApi,
  evidenceApi,
  testCasesApi,
  testRunsApi,
  bugsApi,
  auditApi,
  getAiConnection,
  authenticateRoleSession
} from '../common/services/api';

export type NavigationTab = 
  | 'dashboard'
  | 'documents'
  | 'requirements'
  | 'evidence'
  | 'testcases'
  | 'testruns'
  | 'bugs'
  | 'traceability'
  | 'settings';

interface AppContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: string;
  activeProject: Project;
  setActiveProject: (proj: Project) => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  createProject: (data: Partial<Project>) => Promise<Project>;
  
  // Entities
  documents: DocumentItem[];
  requirements: RequirementItem[];
  evidences: EvidenceItem[];
  testCases: TestCaseItem[];
  testRuns: TestRunItem[];
  bugs: BugItem[];
  auditEvents: AuditEvent[];
  questions: ClarificationQuestion[];

  // Backend Sync Status
  backendConnected: boolean;
  isSyncing: boolean;
  syncWithBackend: () => Promise<void>;
  reloadDocuments: (projectId?: string) => Promise<void>;

  // Entity Actions
  addDocument: (doc: DocumentItem) => void;
  deleteDocument: (id: string) => Promise<void>;
  updateDocumentStatus: (id: string, status: StatusLifecycle) => void;
  
  addRequirement: (req: RequirementItem) => void;
  updateRequirement: (req: RequirementItem) => void;
  updateRequirementStatus: (id: string, status: StatusLifecycle) => void;
  
  addEvidence: (evd: EvidenceItem) => void;
  verifyEvidence: (id: string) => void;
  
  addTestCase: (tc: TestCaseItem) => void;
  updateTestCase: (tc: TestCaseItem) => void;
  updateTestCaseStatus: (id: string, status: any) => void;
  addTestCaseReviewComment: (tcId: string, comment: string, decision?: 'Approved' | 'Changes Requested') => void;
  
  createTestRun: (run: TestRunItem) => void;
  recordTestResult: (runId: string, tcId: string, status: TestResultStatus, actualResult: string, evidenceIds?: string[]) => void;
  
  addBug: (bug: BugItem) => void;
  updateBugStatus: (id: string, status: any) => void;
  
  addClarificationQuestion: (q: ClarificationQuestion) => void;
  answerQuestion: (id: string, answer: string) => void;
  
  logAudit: (action: string, entityType: AuditEvent['entityType'], entityId: string, details: string) => void;
  
  // Workspace & Modals state
  selectedTestCaseId: string | null;
  setSelectedTestCaseId: (id: string | null) => void;
  isAiModalOpen: boolean;
  setIsAiModalOpen: (open: boolean) => void;
  isImpactModalOpen: boolean;
  setIsImpactModalOpen: (open: boolean) => void;
  isModelSwitcherOpen: boolean;
  setIsModelSwitcherOpen: (open: boolean) => void;
  aiConfig: any;
  reloadAiConfig: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  
  // Helpers
  canApprove: () => boolean;
  canEditRequirement: () => boolean;
  canExecuteTest: () => boolean;
  resetToSampleData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Role
  const getInitialTab = (): NavigationTab => {
    const hash = window.location.hash.replace('#', '') as NavigationTab;
    const validTabs: NavigationTab[] = [
      'dashboard', 'documents', 'requirements', 'evidence',
      'testcases', 'testruns', 'bugs', 'traceability', 'settings'
    ];
    if (validTabs.includes(hash)) return hash;
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState<NavigationTab>(getInitialTab);
  const setActiveTab = (tab: NavigationTab) => {
    setActiveTabState(tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavigationTab;
      const validTabs: NavigationTab[] = [
        'dashboard', 'documents', 'requirements', 'evidence',
        'testcases', 'testruns', 'bugs', 'traceability', 'settings'
      ];
      if (validTabs.includes(hash)) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [currentRole, setCurrentRole] = useState<UserRole>('QA');
  const [currentUser] = useState<string>('Duc Pham');

  // Authenticate session whenever active role or user switches (NEW-01, NEW-02)
  useEffect(() => {
    authenticateRoleSession(currentRole, currentUser);
  }, [currentRole, currentUser]);

  // Backend Sync State
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load baseline with typed storage utility
  const [projects, setProjects] = useState<Project[]>(() => {
    return loadFromStorage<Project[]>('docqa_projects', initialProjects);
  });

  const [activeProject, setActiveProject] = useState<Project>(() => {
    const savedActiveId = loadFromStorage<string>('docqa_active_project_id', '');
    const found = projects.find(p => p.id === savedActiveId);
    return found || projects[0] || initialProjects[0];
  });

  useEffect(() => {
    saveToStorage('docqa_projects', projects);
  }, [projects]);

  useEffect(() => {
    if (activeProject?.id) {
      saveToStorage('docqa_active_project_id', activeProject.id);
    }
  }, [activeProject]);

  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    return loadFromStorage<DocumentItem[]>('docqa_documents', initialDocuments);
  });

  const [requirements, setRequirements] = useState<RequirementItem[]>(() => {
    return loadFromStorage<RequirementItem[]>('docqa_requirements', initialRequirements);
  });

  const [evidences, setEvidences] = useState<EvidenceItem[]>(() => {
    return loadFromStorage<EvidenceItem[]>('docqa_evidences', initialEvidences);
  });

  const [testCases, setTestCases] = useState<TestCaseItem[]>(() => {
    return loadFromStorage<TestCaseItem[]>('docqa_testcases', initialTestCases);
  });

  const [testRuns, setTestRuns] = useState<TestRunItem[]>(() => {
    return loadFromStorage<TestRunItem[]>('docqa_testruns', initialTestRuns);
  });

  const [bugs, setBugs] = useState<BugItem[]>(() => {
    return loadFromStorage<BugItem[]>('docqa_bugs', initialBugs);
  });

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => {
    return loadFromStorage<AuditEvent[]>('docqa_audits', initialAuditEvents);
  });

  const [questions, setQuestions] = useState<ClarificationQuestion[]>(() => {
    return loadFromStorage<ClarificationQuestion[]>('docqa_questions', initialClarificationQuestions);
  });

  // UI state
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [isModelSwitcherOpen, setIsModelSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiConfig, setAiConfig] = useState<any>(null);

  const reloadAiConfig = useCallback(async () => {
    try {
      const res = await getAiConnection();
      const cfg = res?.data !== undefined ? res.data : res;
      if (cfg && cfg.provider) {
        setAiConfig(cfg);
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    reloadAiConfig();
  }, [reloadAiConfig]);

  // Dual local caching for offline resiliency
  useEffect(() => { saveToStorage('docqa_documents', documents); }, [documents]);
  useEffect(() => { saveToStorage('docqa_requirements', requirements); }, [requirements]);
  useEffect(() => { saveToStorage('docqa_evidences', evidences); }, [evidences]);
  useEffect(() => { saveToStorage('docqa_testcases', testCases); }, [testCases]);
  useEffect(() => { saveToStorage('docqa_testruns', testRuns); }, [testRuns]);
  useEffect(() => { saveToStorage('docqa_bugs', bugs); }, [bugs]);
  useEffect(() => { saveToStorage('docqa_audits', auditEvents); }, [auditEvents]);

  /**
   * Primary Backend Sync Engine: Fetches full dataset from SQLite backend
   */
  const syncWithBackend = useCallback(async () => {
    setIsSyncing(true);
    try {
      const isHealthy = await checkBackendHealth();
      setBackendConnected(isHealthy);

      if (isHealthy) {
        const [projectsRes, docsRes, reqsRes, evdRes, tcRes, runsRes, bugsRes, auditRes] = await Promise.all([
          projectsApi.getAll().catch(() => null),
          documentsApi.getAll().catch(() => null),
          requirementsApi.getAll().catch(() => null),
          evidenceApi.getAll().catch(() => null),
          testCasesApi.getAll().catch(() => null),
          testRunsApi.getAll().catch(() => null),
          bugsApi.getAll().catch(() => null),
          auditApi.getEvents().catch(() => null)
        ]);

        if (projectsRes && projectsRes.length > 0) {
          setProjects(projectsRes);
          setActiveProject(prev => {
            const found = projectsRes.find(p => p.id === prev?.id);
            return found || projectsRes[0];
          });
        }
        if (docsRes && docsRes.length > 0) setDocuments(docsRes);
        if (reqsRes && reqsRes.length > 0) setRequirements(reqsRes);
        if (evdRes && evdRes.length > 0) setEvidences(evdRes);
        if (tcRes && tcRes.length > 0) setTestCases(tcRes);
        if (runsRes && runsRes.length > 0) setTestRuns(runsRes);
        if (bugsRes && bugsRes.length > 0) setBugs(bugsRes);
        if (auditRes && auditRes.length > 0) setAuditEvents(auditRes);
        await reloadAiConfig().catch(() => {});
      }
    } catch (err) {
      console.warn('[DocQA] Backend sync notice: running with active local cache', err);
      setBackendConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const reloadDocuments = useCallback(async (projId?: string) => {
    const targetProject = projId || activeProject?.id;
    if (backendConnected) {
      try {
        const docs = await documentsApi.getAll(targetProject);
        if (docs) {
          setDocuments(prev => {
            if (targetProject && targetProject !== 'ALL') {
              const other = prev.filter(d => d.projectId && d.projectId !== targetProject);
              return [...docs, ...other];
            }
            return docs;
          });
        }
      } catch (err) {
        console.warn('[DocQA] Document reload error:', err);
      }
    }
  }, [backendConnected, activeProject?.id]);

  // Initial load on mount
  useEffect(() => {
    syncWithBackend();
  }, [syncWithBackend]);

  // Permission helpers
  const canApprove = () => {
    return currentRole === 'Project Admin' || currentRole === 'Reviewer / Approver' || currentRole === 'PM / Project Lead';
  };

  const canEditRequirement = () => {
    return currentRole === 'BA' || currentRole === 'Project Admin' || currentRole === 'PM / Project Lead';
  };

  const canExecuteTest = () => {
    return currentRole === 'QA' || currentRole === 'Project Admin' || currentRole === 'Tech Lead / DEV';
  };

  /**
   * Logs a tamper-evident audit event with SHA-256 block hash chaining
   */
  const logAudit = async (action: string, entityType: AuditEvent['entityType'], entityId: string, details: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const previousHash = auditEvents[0]?.eventHash || `sha256:${syncSha256('GENESIS_BLOCK')}`;
    const id = `AUD-${Date.now().toString().slice(-4)}`;
    
    // Cryptographic hash calculation for the audit block
    const rawPayload = `${previousHash}|${id}|${currentUser}|${currentRole}|${action}|${entityType}|${entityId}|${timestamp}`;
    const eventHash = `sha256:${syncSha256(rawPayload)}`;

    const newEvent: AuditEvent = {
      id,
      user: currentUser,
      role: currentRole,
      action,
      entityType,
      entityId,
      details,
      timestamp,
      eventHash,
      previousEventHash: previousHash
    };

    setAuditEvents(prev => [newEvent, ...prev]);

    // Async persist to Backend SQLite Audit Chain
    if (backendConnected) {
      auditApi.logEvent({
        user: currentUser,
        role: currentRole,
        action,
        entityType,
        entityId,
        details
      }).catch(err => console.warn('[DocQA] Audit log backend sync deferred:', err));
    }
  };

  /* -------------------------------------------------------------
   * WIRED CRUD ACTIONS (Optimistic UI + Backend SQLite Persistence)
   * ----------------------------------------------------------- */

  const createProject = async (data: Partial<Project>): Promise<Project> => {
    let created: Project;
    if (backendConnected) {
      try {
        created = await projectsApi.create(data);
      } catch (err: any) {
        console.warn('[DocQA] Error creating project via backend:', err);
        const nextIndex = projects.length + 1;
        created = {
          id: `PRJ-${String(nextIndex).padStart(2, '0')}`,
          name: (data.name || 'New Project').trim(),
          key: (data.key || 'NEW').trim().toUpperCase(),
          description: (data.description || '').trim(),
          version: (data.version || 'v1.0.0').trim(),
          author: (data.author || currentUser).trim(),
          membersCount: Number(data.membersCount) || 1,
          createdAt: new Date().toISOString().split('T')[0]
        };
      }
    } else {
      const nextIndex = projects.length + 1;
      created = {
        id: `PRJ-${String(nextIndex).padStart(2, '0')}`,
        name: (data.name || 'New Project').trim(),
        key: (data.key || 'NEW').trim().toUpperCase(),
        description: (data.description || '').trim(),
        version: (data.version || 'v1.0.0').trim(),
        author: (data.author || currentUser).trim(),
        membersCount: Number(data.membersCount) || 1,
        createdAt: new Date().toISOString().split('T')[0]
      };
    }

    setProjects(prev => {
      const exists = prev.some(p => p.id === created.id || p.key === created.key);
      if (exists) return prev.map(p => p.id === created.id ? created : p);
      return [created, ...prev];
    });
    setActiveProject(created);
    logAudit('Created Project', 'Document', created.id, `Created project ${created.name} [${created.key}]`);
    return created;
  };

  const deleteDocument = async (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    logAudit('Deleted Document', 'Document', id, `Deleted document ${id}`);

    if (backendConnected) {
      try {
        await documentsApi.delete(id);
      } catch (err) {
        console.warn('[DocQA] Document delete sync notice:', err);
      }
    }
  };

  const addDocument = async (doc: DocumentItem) => {
    const docWithProj = {
      ...doc,
      projectId: doc.projectId || activeProject?.id || 'PRJ-01'
    };
    setDocuments(prev => [docWithProj, ...prev]);
    logAudit('Created Document', 'Document', docWithProj.id, `Uploaded / Created ${docWithProj.title} (${docWithProj.category}) [SHA256: ${docWithProj.versions[0]?.checksum?.slice(7, 17) || 'N/A'}...]`);

    if (backendConnected) {
      try {
        const saved = await documentsApi.create(docWithProj);
        if (saved) {
          setDocuments(prev => prev.map(d => d.id === docWithProj.id ? saved : d));
        }
      } catch (err) {
        console.warn('[DocQA] Document backend sync notice:', err);
      }
    }
  };

  const updateDocumentStatus = async (id: string, status: StatusLifecycle) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status, updatedAt: new Date().toISOString().slice(0, 16) } : d));
    logAudit(`Updated Status to ${status}`, 'Document', id, `Document transitioned to ${status}`);

    if (backendConnected) {
      try {
        await documentsApi.updateStatus(id, status);
      } catch (err) {
        console.warn('[DocQA] Document status sync notice:', err);
      }
    }
  };

  const addRequirement = async (req: RequirementItem) => {
    setRequirements(prev => [req, ...prev]);
    logAudit('Created Requirement', 'Requirement', req.id, `Created requirement ${req.title}`);

    if (backendConnected) {
      try {
        const saved = await requirementsApi.create(req);
        if (saved) {
          setRequirements(prev => prev.map(r => r.id === req.id ? saved : r));
        }
      } catch (err) {
        console.warn('[DocQA] Requirement backend sync notice:', err);
      }
    }
  };

  const updateRequirement = async (req: RequirementItem) => {
    setRequirements(prev => prev.map(r => r.id === req.id ? req : r));
    logAudit('Updated Requirement', 'Requirement', req.id, `Modified details for ${req.id}`);

    if (backendConnected) {
      try {
        await requirementsApi.create(req);
      } catch (err) {
        console.warn('[DocQA] Requirement update sync notice:', err);
      }
    }
  };

  const updateRequirementStatus = async (id: string, status: StatusLifecycle) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString().slice(0, 16) } : r));
    logAudit(`Updated Status to ${status}`, 'Requirement', id, `Requirement transitioned to ${status}`);

    if (backendConnected) {
      try {
        await requirementsApi.updateStatus(id, status, currentRole);
      } catch (err) {
        console.warn('[DocQA] Requirement status sync notice:', err);
      }
    }
  };

  const addEvidence = async (evd: EvidenceItem) => {
    setEvidences(prev => [evd, ...prev]);
    logAudit('Uploaded Evidence', 'Evidence', evd.id, `Uploaded ${evd.type} for ${evd.environment} [SHA256: ${evd.storageChecksum.slice(7, 17)}...]`);

    if (backendConnected) {
      try {
        const saved = await evidenceApi.create(evd);
        if (saved) {
          setEvidences(prev => prev.map(e => e.id === evd.id ? saved : e));
        }
      } catch (err) {
        console.warn('[DocQA] Evidence backend sync notice:', err);
      }
    }
  };

  const verifyEvidence = async (id: string) => {
    setEvidences(prev => prev.map(e => e.id === id ? {
      ...e,
      status: 'Verified',
      verifiedBy: currentUser,
      verifiedAt: new Date().toISOString().slice(0, 16)
    } : e));
    logAudit('Verified Evidence', 'Evidence', id, `Evidence verified and marked authoritative`);

    if (backendConnected) {
      try {
        await evidenceApi.verify(id, currentUser);
      } catch (err) {
        console.warn('[DocQA] Evidence verify sync notice:', err);
      }
    }
  };

  const addTestCase = async (tc: TestCaseItem) => {
    setTestCases(prev => [tc, ...prev]);
    logAudit('Created Test Case', 'TestCase', tc.id, `Created ${tc.id}: ${tc.title}`);

    if (backendConnected) {
      try {
        const saved = await testCasesApi.create(tc);
        if (saved) {
          setTestCases(prev => prev.map(t => t.id === tc.id ? saved : t));
        }
      } catch (err) {
        console.warn('[DocQA] TestCase backend sync notice:', err);
      }
    }
  };

  const updateTestCase = async (tc: TestCaseItem) => {
    setTestCases(prev => prev.map(t => t.id === tc.id ? tc : t));
    logAudit('Updated Test Case', 'TestCase', tc.id, `Modified steps or specs for ${tc.id}`);

    if (backendConnected) {
      try {
        await testCasesApi.create(tc);
      } catch (err) {
        console.warn('[DocQA] TestCase update sync notice:', err);
      }
    }
  };

  const updateTestCaseStatus = async (id: string, status: any) => {
    setTestCases(prev => prev.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString().slice(0, 16) } : t));
    logAudit(`Updated Status to ${status}`, 'TestCase', id, `Test Case marked as ${status}`);

    if (backendConnected) {
      try {
        await testCasesApi.updateStatus(id, status, currentRole);
      } catch (err) {
        console.warn('[DocQA] TestCase status sync notice:', err);
      }
    }
  };

  const addTestCaseReviewComment = async (tcId: string, content: string, decision?: 'Approved' | 'Changes Requested') => {
    const comment = {
      id: `RC-${Date.now().toString().slice(-4)}`,
      author: currentUser,
      role: currentRole,
      content,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      decision
    };

    setTestCases(prev => prev.map(t => {
      if (t.id === tcId) {
        let newStatus = t.status;
        if (decision === 'Approved' && canApprove()) {
          newStatus = 'Approved';
        } else if (decision === 'Changes Requested') {
          newStatus = 'Draft';
        }
        return {
          ...t,
          status: newStatus,
          reviewComments: [...t.reviewComments, comment],
          updatedAt: new Date().toISOString().slice(0, 16)
        };
      }
      return t;
    }));

    logAudit(`Review Comment: ${decision || 'Note'}`, 'TestCase', tcId, `Reviewer commented: "${content.slice(0, 40)}..."`);

    if (backendConnected) {
      try {
        await testCasesApi.addComment(tcId, {
          author: currentUser,
          role: currentRole,
          content,
          decision
        });
      } catch (err) {
        console.warn('[DocQA] TestCase comment sync notice:', err);
      }
    }
  };

  const createTestRun = async (run: TestRunItem) => {
    setTestRuns(prev => [run, ...prev]);
    logAudit('Created Test Run', 'TestRun', run.id, `Initialized run ${run.title} on ${run.environment}`);

    if (backendConnected) {
      try {
        const saved = await testRunsApi.create(run);
        if (saved) {
          setTestRuns(prev => prev.map(r => r.id === run.id ? saved : r));
        }
      } catch (err) {
        console.warn('[DocQA] TestRun backend sync notice:', err);
      }
    }
  };

  const recordTestResult = async (runId: string, tcId: string, status: TestResultStatus, actualResult: string, evidenceIds: string[] = []) => {
    setTestRuns(prev => prev.map(run => {
      if (run.id === runId) {
        const existingIdx = run.records.findIndex(r => r.testCaseId === tcId);
        const record = {
          testCaseId: tcId,
          testCaseTitle: testCases.find(t => t.id === tcId)?.title || tcId,
          status,
          actualResult,
          executedBy: currentUser,
          executedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          evidenceIds: evidenceIds.length > 0 ? evidenceIds : (existingIdx >= 0 ? run.records[existingIdx].evidenceIds : [])
        };

        const updatedRecords = existingIdx >= 0
          ? run.records.map((r, i) => i === existingIdx ? record : r)
          : [...run.records, record];

        return { ...run, records: updatedRecords };
      }
      return run;
    }));

    logAudit(`Executed Test: ${status}`, 'TestRun', runId, `Test Case ${tcId} executed with result ${status}`);

    if (backendConnected) {
      try {
        await testRunsApi.recordResult(runId, {
          testCaseId: tcId,
          status,
          actualResult,
          executedBy: currentUser,
          evidenceIds
        });
      } catch (err) {
        console.warn('[DocQA] Test result execution sync notice:', err);
      }
    }
  };

  const addBug = async (bug: BugItem) => {
    setBugs(prev => [bug, ...prev]);
    logAudit('Logged Defect', 'Bug', bug.id, `Created defect ${bug.id}: ${bug.title}`);

    if (backendConnected) {
      try {
        const saved = await bugsApi.create(bug);
        if (saved) {
          setBugs(prev => prev.map(b => b.id === bug.id ? saved : b));
        }
      } catch (err) {
        console.warn('[DocQA] Bug backend sync notice:', err);
      }
    }
  };

  const updateBugStatus = async (id: string, status: any) => {
    setBugs(prev => prev.map(b => b.id === id ? { ...b, status, updatedAt: new Date().toISOString().slice(0, 16) } : b));
    logAudit(`Updated Bug Status: ${status}`, 'Bug', id, `Defect ${id} marked as ${status}`);

    if (backendConnected) {
      try {
        await bugsApi.updateStatus(id, status);
      } catch (err) {
        console.warn('[DocQA] Bug status sync notice:', err);
      }
    }
  };

  const addClarificationQuestion = (q: ClarificationQuestion) => {
    setQuestions(prev => [q, ...prev]);
  };

  const answerQuestion = (id: string, _answer: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: 'Answered' } : q));
  };

  const resetToSampleData = () => {
    setDocuments(initialDocuments);
    setRequirements(initialRequirements);
    setEvidences(initialEvidences);
    setTestCases(initialTestCases);
    setTestRuns(initialTestRuns);
    setBugs(initialBugs);
    setAuditEvents(initialAuditEvents);
    setQuestions(initialClarificationQuestions);
    syncWithBackend();
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentRole,
        setCurrentRole,
        currentUser,
        activeProject,
        setActiveProject,
        projects,
        setProjects,
        createProject,
        documents,
        requirements,
        evidences,
        testCases,
        testRuns,
        bugs,
        auditEvents,
        questions,

        backendConnected,
        isSyncing,
        syncWithBackend,
        reloadDocuments,

        addDocument,
        deleteDocument,
        updateDocumentStatus,
        addRequirement,
        updateRequirement,
        updateRequirementStatus,
        addEvidence,
        verifyEvidence,
        addTestCase,
        updateTestCase,
        updateTestCaseStatus,
        addTestCaseReviewComment,
        createTestRun,
        recordTestResult,
        addBug,
        updateBugStatus,
        addClarificationQuestion,
        answerQuestion,
        logAudit,

        selectedTestCaseId,
        setSelectedTestCaseId,
        isAiModalOpen,
        setIsAiModalOpen,
        isImpactModalOpen,
        setIsImpactModalOpen,
        isModelSwitcherOpen,
        setIsModelSwitcherOpen,
        aiConfig,
        reloadAiConfig,
        searchQuery,
        setSearchQuery,

        canApprove,
        canEditRequirement,
        canExecuteTest,
        resetToSampleData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
