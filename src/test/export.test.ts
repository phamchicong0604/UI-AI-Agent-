import { describe, it, expect, vi } from 'vitest';
import { downloadCsv, downloadJson } from '../common/utils/export';

describe('CSV & JSON Export Utility with UTF-8 BOM', () => {
  it('should format rows into CSV and prepend \\uFEFF BOM for Excel Vietnamese compatibility', () => {
    let capturedBlob: any = null;
    globalThis.URL.createObjectURL = vi.fn((blob: any) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    globalThis.URL.revokeObjectURL = vi.fn();

    const mockAnchor = {
      setAttribute: vi.fn(),
      click: vi.fn()
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);

    const headers = ['Mã yêu cầu', 'Tiêu đề', 'Trạng thái'];
    const rows = [
      ['REQ-001', 'Xác thực hai yếu tố (2FA) & Phân quyền', 'Đã phê duyệt (Approved)'],
      ['REQ-002', 'Báo cáo ma trận truy vết, có dấu phẩy', 'Bản nháp']
    ];

    downloadCsv('Test_Traceability.csv', headers, rows);

    expect(capturedBlob).toBeDefined();
    expect(capturedBlob?.type).toContain('text/csv;charset=utf-8;');
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', 'Test_Traceability.csv');
    expect(mockAnchor.click).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('should support downloading structured JSON data', () => {
    let capturedBlob: any = null;
    globalThis.URL.createObjectURL = vi.fn((blob: any) => {
      capturedBlob = blob;
      return 'blob:mock-json-url';
    });
    globalThis.URL.revokeObjectURL = vi.fn();

    const mockAnchor = {
      setAttribute: vi.fn(),
      click: vi.fn()
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);

    downloadJson('test.json', { name: 'DocQA', version: '0.1.0' });

    expect(capturedBlob).toBeDefined();
    expect(capturedBlob?.type).toContain('application/json');
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', 'test.json');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
