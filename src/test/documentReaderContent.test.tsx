import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DocumentItem } from '../types';
import { initialDocuments } from '../data/mockData';
import { DocumentReaderView } from '../components/documents/DocumentReaderView';
import { MarkdownPreviewModal } from '../components/documents/MarkdownPreviewModal';

const appState = {
  backendConnected: true,
  activeProject: { id: 'PRJ-01', name: 'AI-Ready QA', key: 'AIQA' },
  canApprove: () => false,
  updateDocumentStatus: vi.fn(),
  requirements: [],
  setActiveTab: vi.fn()
};
vi.mock('../context/AppContext', () => ({
  useApp: () => appState
}));

// Text that only the generated placeholder template contains
const TEMPLATE_MARKER = /BR-AUTH-01/;

describe('The reader never shows substitute text when the document text cannot be read', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let clipboardWrite: ReturnType<typeof vi.fn>;

  const doc = {
    id: 'DOC-77',
    projectId: 'PRJ-01',
    title: 'Payment rules',
    category: '02_Business_Requirements',
    currentVersion: 'v1.2',
    status: 'Draft',
    author: 'BA Team',
    updatedAt: '2026-11-04',
    description: 'Short description',
    tags: [],
    linkedRequirementsCount: 0,
    versions: []
  } as DocumentItem;

  const respond = (status: number, data?: unknown) =>
    ({ status, ok: status < 400, json: async () => (status < 400 ? { success: true, data } : { success: false, error: 'denied' }) }) as any;

  const copyButton = () => screen.getByRole('button', { name: /^(Chép MD|Copy MD)$/ });

  beforeEach(() => {
    appState.backendConnected = true;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;
    clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboardWrite }, configurable: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const expectUnavailable = async () => {
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(TEMPLATE_MARKER)).not.toBeInTheDocument();
    expect(copyButton()).toBeDisabled();
    fireEvent.click(copyButton());
    expect(clipboardWrite).not.toHaveBeenCalled();
  };

  it.each([
    ['403', () => fetchMock.mockResolvedValue(respond(403))],
    ['500', () => fetchMock.mockResolvedValue(respond(500))],
    ['a network error', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))]
  ])('shows an error, not the template, when the content request ends in %s', async (_label, arrange) => {
    arrange();
    render(<DocumentReaderView document={doc} />);
    await expectUnavailable();
  });

  it('shows an error, not the template, without a backend for a document that has no bundled text', async () => {
    appState.backendConnected = false;
    render(<DocumentReaderView document={doc} />);
    await expectUnavailable();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the version text and lets it be copied when the request succeeds', async () => {
    fetchMock.mockResolvedValue(respond(200, { documentId: 'DOC-77', versionId: 'DOC-77-v1.2', versionNo: 'v1.2', content: 'Text of version 1.2' }));
    render(<DocumentReaderView document={doc} />);

    await waitFor(() => expect(screen.getByText('Text of version 1.2')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(TEMPLATE_MARKER)).not.toBeInTheDocument();
    fireEvent.click(copyButton());
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Text of version 1.2'));
  });

  it('does not copy the loading text while the request is pending', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<DocumentReaderView document={doc} />);

    expect(copyButton()).toBeDisabled();
    fireEvent.click(copyButton());
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('still shows bundled demo text without a backend', () => {
    appState.backendConnected = false;
    const demoDoc = initialDocuments.find(d => d.id === 'DOC-03')!;
    render(<DocumentReaderView document={demoDoc} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Evidence Lifecycle/).length).toBeGreaterThan(0);
  });

  it('the preview says the text is unavailable instead of showing the description as the document', async () => {
    fetchMock.mockResolvedValue(respond(500));
    render(<MarkdownPreviewModal isOpen={true} document={doc} onClose={vi.fn()} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Short description')).not.toBeInTheDocument());
    const copy = screen.getAllByRole('button').find(b => /copy|chép/i.test(b.textContent || ''))!;
    expect(copy).toBeDisabled();
  });
});
