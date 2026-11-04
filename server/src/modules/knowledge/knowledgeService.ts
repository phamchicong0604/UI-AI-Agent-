import { 
  KnowledgeUnitRecord, 
  KnowledgeSourceRecord, 
  ConflictRecord, 
  RequirementItem 
} from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { randomUUID } from 'crypto';

export class KnowledgeGovernanceService {
  /**
   * Promote an approved Knowledge Unit into Requirement or BusinessRule (E6-T3, BUG-004, BUG-014)
   */
  public async promoteUnitToRequirementOrRule(
    unitId: string, 
    reviewer: string,
    options?: { overrideExplicit?: boolean; reason?: string }
  ): Promise<{ unit: KnowledgeUnitRecord; requirement?: RequirementItem; supersededUnits: number; impactedTestCases: number }> {
    const unit = dbRepository.knowledgeUnits.getById(unitId);
    if (!unit) {
      throw new Error(`Knowledge Unit "${unitId}" không tồn tại`);
    }

    // State Guard (BUG-004): Cannot approve unit that is not Draft or In Review
    if (unit.status !== 'Draft' && unit.status !== 'In Review') {
      throw new Error(`Không thể phê duyệt đơn vị tri thức ở trạng thái "${unit.status}". Chỉ cho phép phê duyệt khi đơn vị đang ở trạng thái Draft hoặc In Review.`);
    }

    // Evidence Level Guard (BUG-004): Non-explicit units require explicit override and justification >= 5 chars
    if (unit.evidenceLevel !== 'Explicit') {
      if (!options?.overrideExplicit) {
        throw new Error(`Chỉ được phê duyệt đơn vị tri thức có evidence_level là Explicit. Các mức bằng chứng khác (${unit.evidenceLevel}) yêu cầu xác nhận ghi đè kèm lý do.`);
      }
      if (!options.reason || options.reason.trim().length < 5) {
        throw new Error(`Lý do ghi đè phê duyệt cho bằng chứng "${unit.evidenceLevel}" phải có ít nhất 5 ký tự.`);
      }
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let createdRequirement: RequirementItem | undefined;
    let supersededCount = 0;
    let impactedTestCases = 0;

    // Execute CAS update, review decision, requirement upsert, superseding and impact cascade in an atomic SQLite transaction (NEW-06)
    const promoteTx = db.transaction(() => {
      // 1. Mark unit as Approved using Compare-And-Set inside transaction (BUG-004)
      const casSuccess = db.prepare(`
        UPDATE knowledge_units
        SET status = 'Approved', updated_at = ?
        WHERE id = ? AND status = ?
      `).run(now, unit.id, unit.status);

      if (casSuccess.changes === 0) {
        throw new Error(`Xung đột đồng thời: Đơn vị tri thức "${unitId}" đã bị thay đổi trạng thái bởi phiên làm việc khác`);
      }

      unit.status = 'Approved';

      // Record review decision with reason/override comment (BUG-004)
      dbRepository.reviewDecisions.create({
        id: `REV-${randomUUID()}`,
        targetType: 'knowledge_unit',
        targetId: unit.id,
        decision: 'Approve',
        reviewer,
        comment: options?.reason || (options?.overrideExplicit ? 'Approved with explicit override' : 'Approved standard explicit unit'),
        createdAt: now
      });

      // 2. Query source anchors
      const sources = dbRepository.knowledgeSources.getByUnitId(unitId);

      // Build rich SourceReferences with real document info (BUG-014)
      const sourceReferences = sources.map(s => {
        let docId = 'DOC-01';
        let docTitle = 'Tài liệu nguồn';
        let docVersionStr = 'v1.0';

        try {
          const row = db.prepare(`
            SELECT d.id as doc_id, d.data as doc_data, dv.version_no
            FROM document_versions dv
            JOIN documents d ON d.id = dv.document_id
            WHERE dv.id = ?
          `).get(s.documentVersionId) as { doc_id: string; doc_data: string; version_no: string } | undefined;

          if (row) {
            docId = row.doc_id;
            docVersionStr = row.version_no ? (row.version_no.startsWith('v') ? row.version_no : `v${row.version_no}`) : 'v1.0';
            try {
              const parsed = JSON.parse(row.doc_data);
              if (parsed.title) docTitle = parsed.title;
            } catch {}
          } else {
            // Find default document for project
            const fallbackDoc = db.prepare('SELECT id, data FROM documents WHERE project_id = ? LIMIT 1').get(unit.projectId) as { id: string; data: string } | undefined;
            if (fallbackDoc) {
              docId = fallbackDoc.id;
              try {
                const parsed = JSON.parse(fallbackDoc.data);
                if (parsed.title) docTitle = parsed.title;
              } catch {}
            }
          }
        } catch {}

        let headingPathStr = '';
        try {
          const parsedHeadings = JSON.parse(s.headingPath);
          headingPathStr = Array.isArray(parsedHeadings) ? parsedHeadings.join(' > ') : s.headingPath;
        } catch {
          headingPathStr = s.headingPath;
        }

        let sectionStr = headingPathStr || 'Root';
        if (s.charOffsetStart !== undefined && s.charOffsetStart !== null && s.charOffsetEnd !== undefined && s.charOffsetEnd !== null) {
          sectionStr += ` (Offsets: ${s.charOffsetStart}-${s.charOffsetEnd})`;
        }

        return {
          unitId: unit.id,
          documentId: docId,
          documentTitle: docTitle,
          version: docVersionStr,
          section: sectionStr
        };
      });

      // 3. Promote to RequirementItem if unitType === 'Requirement' or 'BusinessRule' (BUG-014)
      if (unit.unitType === 'Requirement' || unit.unitType === 'BusinessRule') {
        const prefix = unit.unitType === 'BusinessRule' ? 'BR' : 'REQ';
        const reqId = `${prefix}-${unit.id.replace(/^KU-/, '')}`;

        const existingReq = dbRepository.requirements.getById(reqId);
        if (existingReq) {
          // BUG-014: Preserve user edits and status on existing requirement, update source references and approver
          createdRequirement = {
            ...existingReq,
            projectId: unit.projectId,
            status: existingReq.status || 'Draft',
            approver: reviewer,
            updatedAt: now,
            sourceReferences: [
              ...existingReq.sourceReferences.filter(r => r.documentId !== sourceReferences[0]?.documentId),
              ...sourceReferences
            ]
          };
        } else {
          createdRequirement = {
            id: reqId,
            projectId: unit.projectId,
            title: `${unit.subject}: ${unit.action}`,
            description: unit.content,
            type: unit.unitType === 'BusinessRule' ? 'Non-functional' : 'Functional',
            priority: 'High',
            businessRules: unit.condition ? [unit.condition] : (unit.unitType === 'BusinessRule' ? [unit.content] : []),
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
            createdAt: now,
            updatedAt: now,
            isAiGenerated: true
          };
        }

        if (createdRequirement) {
          dbRepository.requirements.upsert(createdRequirement);
        }
      }

      // 4. Superseding Rule: Older approved units for the same subject transition to 'Superseded' (E6-T4)
      supersededCount = dbRepository.knowledgeUnits.supersedeOlderUnits(unit.projectId, unit.id, unit.subject);

      // 5. Change Impact Cascade (E6-T4.3): Shift linked approved Test Cases to 'In Review'
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
    });

    promoteTx.immediate();

    return {
      unit,
      requirement: createdRequirement,
      supersededUnits: supersededCount,
      impactedTestCases
    };
  }

  /**
   * Reject a Knowledge Unit with required reason (BUG-004)
   */
  public async rejectUnit(unitId: string, reviewer: string, reason?: string): Promise<KnowledgeUnitRecord> {
    const unit = dbRepository.knowledgeUnits.getById(unitId);
    if (!unit) {
      throw new Error(`Knowledge Unit "${unitId}" không tồn tại`);
    }

    if (unit.status !== 'Draft' && unit.status !== 'In Review') {
      throw new Error(`Không thể từ chối đơn vị tri thức ở trạng thái "${unit.status}". Chỉ cho phép từ chối khi đơn vị đang ở trạng thái Draft hoặc In Review.`);
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do từ chối đơn vị tri thức bắt buộc phải có ít nhất 5 ký tự.');
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    // Atomic CAS update
    const casSuccess = db.prepare(`
      UPDATE knowledge_units
      SET status = 'Rejected', updated_at = ?
      WHERE id = ? AND status = ?
    `).run(now, unit.id, unit.status);

    if (casSuccess.changes === 0) {
      throw new Error(`Xung đột đồng thời: Đơn vị tri thức "${unitId}" đã bị thay đổi trạng thái bởi phiên làm việc khác`);
    }

    // Record review decision in audit trail (BUG-004)
    dbRepository.reviewDecisions.create({
      id: `REV-${randomUUID()}`,
      targetType: 'knowledge_unit',
      targetId: unit.id,
      decision: 'Reject',
      reviewer,
      comment: reason.trim(),
      createdAt: now
    });

    unit.status = 'Rejected';
    return unit;
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
