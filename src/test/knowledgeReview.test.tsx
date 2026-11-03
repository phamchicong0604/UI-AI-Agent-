import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeReviewModal, KnowledgeUnitItem } from '../components/documents/KnowledgeReviewModal';
import { ConflictResolutionModal, ConflictData } from '../components/documents/ConflictResolutionModal';

describe('Human Review UI (Epic E8-T1, E8-T3, E8-T4)', () => {
  const sampleUnits: KnowledgeUnitItem[] = [
    {
      id: 'ku-1',
      projectId: 'PRJ-TEST',
      unitType: 'Requirement',
      subject: 'Mã hóa lưu trữ mật khẩu',
      action: 'Băm mật khẩu bằng Argon2id',
      content: 'Mọi mật khẩu người dùng phải được băm bằng thuật toán Argon2id trước khi lưu vào DB.',
      evidenceLevel: 'Explicit',
      status: 'Draft',
      exactQuote: 'băm bằng thuật toán Argon2id'
    },
    {
      id: 'ku-2',
      projectId: 'PRJ-TEST',
      unitType: 'BusinessRule',
      subject: 'Chính sách hoàn tiền',
      action: 'Tự động hoàn tiền',
      content: 'Hệ thống tự động hoàn tiền sau 24 giờ nếu giao dịch lỗi.',
      evidenceLevel: 'Inferred',
      status: 'Draft'
    }
  ];

  it('renders split-screen with Risk Score and evidence badges', () => {
    render(
      <KnowledgeReviewModal
        isOpen={true}
        onClose={vi.fn()}
        documentTitle="Security Specifications v1.0"
        documentContent="Tài liệu bảo mật. Mọi mật khẩu người dùng phải được băm bằng thuật toán Argon2id trước khi lưu vào DB."
        units={sampleUnits}
        riskScore={45}
        riskLevel="MEDIUM"
        onUnitDecision={vi.fn()}
        onBulkApproveExplicit={vi.fn()}
      />
    );

    expect(screen.getByText('Security Specifications v1.0')).toBeInTheDocument();
    expect(screen.getByText(/Risk Score: 45\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/Rõ ràng \(Explicit\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Suy luận \(Inferred\)/i)).toBeInTheDocument();
  });

  it('enforces bulk approval guardrail: button specifies approving only Explicit units (AC-E8-3)', () => {
    const handleBulkApprove = vi.fn();
    render(
      <KnowledgeReviewModal
        isOpen={true}
        onClose={vi.fn()}
        documentTitle="Security Specs"
        documentContent="Sample content"
        units={sampleUnits}
        riskScore={30}
        riskLevel="MEDIUM"
        onUnitDecision={vi.fn()}
        onBulkApproveExplicit={handleBulkApprove}
      />
    );

    // There is 1 explicit unit out of 2 units
    const bulkBtn = screen.getByRole('button', { name: /Approve 1 Explicit/i });
    expect(bulkBtn).toBeInTheDocument();

    fireEvent.click(bulkBtn);
    expect(handleBulkApprove).toHaveBeenCalledTimes(1);
  });

  it('enforces mandatory rejection reason with minimum 5 characters (AC-E8-4)', async () => {
    const handleDecision = vi.fn();
    render(
      <KnowledgeReviewModal
        isOpen={true}
        onClose={vi.fn()}
        documentTitle="Security Specs"
        documentContent="Sample content"
        units={sampleUnits}
        riskScore={30}
        riskLevel="MEDIUM"
        onUnitDecision={handleDecision}
        onBulkApproveExplicit={vi.fn()}
      />
    );

    // Click "Từ chối" on first unit
    const rejectBtns = screen.getAllByRole('button', { name: /Từ chối/i });
    fireEvent.click(rejectBtns[0]);

    // Modal dialog pops up asking for mandatory reason
    expect(screen.getByText(/Bắt buộc nhập lý do từ chối/i)).toBeInTheDocument();

    const confirmRejectBtn = screen.getByRole('button', { name: /Xác nhận từ chối/i });
    fireEvent.click(confirmRejectBtn);

    // Error shown because reason is empty
    expect(screen.getByText(/Bắt buộc nhập lý do từ chối tối thiểu 5 ký tự/i)).toBeInTheDocument();
    expect(handleDecision).not.toHaveBeenCalled();

    // Fill in valid reason
    const textarea = screen.getByPlaceholderText(/Nhập lý do từ chối/i);
    fireEvent.change(textarea, { target: { value: 'Nội dung không chuẩn hóa theo chuẩn RFC' } });
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(handleDecision).toHaveBeenCalledWith('ku-1', 'Reject', 'Nội dung không chuẩn hóa theo chuẩn RFC');
    });
  });

  it('renders ConflictResolutionModal with side-by-side comparison and 3 resolution choices (AC-E8-4)', () => {
    const sampleConflict: ConflictData = {
      id: 'conf-12345678',
      projectId: 'PRJ-TEST',
      unitAId: 'ku-cand',
      unitBId: 'ku-appr',
      conflictType: 'Contradiction',
      severity: 'Critical',
      description: 'Timeout value conflict',
      unitASubject: 'Timeout thanh toán',
      unitAContent: 'Timeout là 15m',
      unitBSubject: 'Timeout thanh toán',
      unitBContent: 'Timeout là 30m'
    };

    render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={vi.fn()}
        conflict={sampleConflict}
        onResolved={vi.fn()}
      />
    );

    expect(screen.getByText(/Xử lý Xung đột Tri thức/i)).toBeInTheDocument();
    expect(screen.getByText(/Timeout là 15m/i)).toBeInTheDocument();
    expect(screen.getByText(/Timeout là 30m/i)).toBeInTheDocument();

    expect(screen.getByText(/1\. KEEP_NEW_SUPERSEDE_OLD/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. REJECT_NEW_PRESERVE_OLD/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. MERGE_SPECIFICATION/i)).toBeInTheDocument();
  });
});
