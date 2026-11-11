import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DocumentItem } from '../types';
import { documentsApi } from '../common/services/api';
import { initialDocuments, demoDocumentContents } from '../data/mockData';
import { MarkdownPreviewModal } from '../components/documents/MarkdownPreviewModal';

const appState = { backendConnected: true };
vi.mock('../context/AppContext', () => ({
  useApp: () => appState
}));

describe('Document content is read through the version API (E11-T1)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  // A stray copy of the text on the document record must never be what is shown
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
    contentMarkdown: 'Stale copy on the document record',
    tags: [],
    linkedRequirementsCount: 0,
    versions: []
  } as DocumentItem;

  beforeEach(() => {
    appState.backendConnected = true;
    fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: { documentId: 'DOC-77', versionId: 'DOC-77-v1.2', versionNo: 'v1.2', content: 'Text of version 1.2' } })
    } as any);
    globalThis.fetch = fetchMock as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('documentsApi.getContent() calls GET /documents/:id/content', async () => {
    const result = await documentsApi.getContent('DOC-77');
    expect(result.content).toBe('Text of version 1.2');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/documents\/DOC-77\/content$/);

    await documentsApi.getContent('DOC-77', 'v1.0');
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/documents\/DOC-77\/content\?version=v1\.0$/);
  });

  it('the preview shows the text returned by the version API', async () => {
    render(<MarkdownPreviewModal isOpen={true} document={doc} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Text of version 1.2')).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/documents\/DOC-77\/content$/);
    expect(screen.queryByText('Stale copy on the document record')).not.toBeInTheDocument();
    expect(screen.queryByText('Short description')).not.toBeInTheDocument();
  });

  it('the preview falls back to the description when the version has no text', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: { documentId: 'DOC-77', versionId: null, versionNo: null, content: '' } })
    } as any);
    render(<MarkdownPreviewModal isOpen={true} document={doc} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Short description')).toBeInTheDocument());
    expect(screen.queryByText('Stale copy on the document record')).not.toBeInTheDocument();
  });

  it('without a backend the demo text is used and no request is made', () => {
    appState.backendConnected = false;
    const demoDoc = initialDocuments.find(d => d.id === 'DOC-03')!;
    render(<MarkdownPreviewModal isOpen={true} document={demoDoc} onClose={vi.fn()} />);

    expect(screen.getByText('Software Requirements Specification (SRS) - Evidence Lifecycle', { selector: 'h1' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('demo document records carry no text of their own', () => {
    expect(Object.keys(demoDocumentContents).length).toBeGreaterThan(0);
    for (const d of initialDocuments) {
      expect(d).not.toHaveProperty('contentMarkdown');
      expect(d).not.toHaveProperty('demoContent');
    }
  });
});
