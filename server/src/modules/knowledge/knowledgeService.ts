import { 
  KnowledgeUnitRecord, 
  KnowledgeSourceRecord, 
  ConflictRecord, 
  RequirementItem 
} from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';

export class KnowledgeGovernanceService {
  /**
   * Promote an approved Knowledge Unit into Requirement or BusinessRule (E6-T3)
   */
  public async promoteUnitToRequirementOrRule(unitId: string, reviewer: string): Promise<{ unit: KnowledgeUnitRecord; requirement?: RequirementItem; supersededUnits: number; impactedTestCases: number }> {
    const unit = dbRepository.knowledgeUnits.getById(unitId);
    if (!unit) {
      throw new Error(`Knowledge Unit "${unitId}" không tồn tại`);
    }

    // 1. Mark unit as Approved if not already
    if (unit.status !== 'Approved') {
      dbRepository.knowledgeUnits.updateStatus(unit.id, 'Approved');
      unit.status = 'Approved';
    }

    // 2. Query source anchors
    const sources = dbRepository.knowledgeSources.getByUnitId(unitId);

    // Build rich SourceReferences to the exact character offset & heading
    const sourceReferences = sources.map(s => {
      let docId = 'DOC-01';
      let docTitle = 'Project Specification';

      try {
        const row = db.prepare(`
          SELECT d.id, d.data
          FROM documents d
          JOIN document_versions dv ON dv.document_id = d.id
          WHERE dv.id = ?
        `).get(s.documentVersionId) as { id: string; data: string } | undefined;

        if (row) {
          docId = row.id;
          const parsed = JSON.parse(row.data);
          docTitle = parsed.title || row.id;
        }
      } catch {}

      let headingPathStr = '';
      try {
        const parsedHeadings = JSON.parse(s.headingPath);
        headingPathStr = Array.isArray(parsedHeadings) ? parsedHeadings.join(' > ') : s.headingPath;
      } catch {
        headingPathStr = s.headingPath;
      }

      return {
        documentId: docId,
        documentTitle: docTitle,
        version: s.documentVersionId.includes('-v') ? `v${s.documentVersionId.split('-v')[1]}` : 'v1.0',
        section: `${headingPathStr || 'Root'} [Offsets: ${s.charOffsetStart}-${s.charOffsetEnd}]`
      };
    });

    let createdRequirement: RequirementItem | undefined;

    // 3. Promote to RequirementItem if unitType === 'Requirement'
    if (unit.unitType === 'Requirement') {
      const reqId = `REQ-${unit.id.replace(/^KU-/, '')}`;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const existingReq = dbRepository.requirements.getById(reqId);
      createdRequirement = {
        id: reqId,
        title: `${unit.subject}: ${unit.action}`,
        description: unit.content,
        type: 'Functional',
        priority: 'High',
        businessRules: unit.condition ? [unit.condition] : [],
        acceptanceCriteria: [
          {
            id: `AC-1`,
            text: `${unit.subject} phải ${unit.action}${unit.condition ? ` khi ${unit.condition}` : ''}`,
            completed: false
          }
        ],
        sourceReferences,
        status: 'Approved',
        owner: reviewer,
        approver: reviewer,
        createdAt: existingReq?.createdAt || now,
        updatedAt: now,
        isAiGenerated: true
      };

      dbRepository.requirements.upsert(createdRequirement);
    }

    // 4. Superseding Rule: Older approved units for the same subject transition to 'Superseded' (E6-T4)
    const supersededCount = dbRepository.knowledgeUnits.supersedeOlderUnits(unit.projectId, unit.id, unit.subject);

    // 5. Change Impact Cascade (E6-T4.3): Shift linked approved Test Cases to 'In Review'
    let impactedTestCases = 0;
    if (supersededCount > 0 && createdRequirement) {
      const allTestCases = dbRepository.testCases.getAll();
      for (const tc of allTestCases) {
        if (tc.status === 'Approved' && (tc.requirementId === createdRequirement.id || tc.title.includes(unit.subject))) {
          tc.status = 'In Review';
          tc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
          dbRepository.testCases.upsert(tc);
          impactedTestCases++;
        }
      }
    }

    return {
      unit,
      requirement: createdRequirement,
      supersededUnits: supersededCount,
      impactedTestCases
    };
  }

  /**
   * Check if project has unresolved Critical conflicts (E6-T4 AC)
   */
  public hasUnresolvedCriticalConflicts(projectId: string): boolean {
    const criticalConflicts = dbRepository.conflicts.getUnresolvedByProject(projectId, 'Critical');
    return criticalConflicts.length > 0;
  }
}

export const defaultKnowledgeService = new KnowledgeGovernanceService();
