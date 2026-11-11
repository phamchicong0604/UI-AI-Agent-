import { useEffect, useState } from 'react';
import { DocumentItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { documentsApi } from '../../common/services/api';
import { demoDocumentContents } from '../../data/mockData';

/**
 * Text of a document's current version, read through the version content API (E11-T1).
 * Without a backend connection only the bundled demo documents have text.
 * `unavailable` means the text could not be read (request failed, or no connection and no bundled text):
 * callers must say so instead of showing substitute text as if it were the document.
 */
export interface DocumentContentState {
  content: string;
  loading: boolean;
  unavailable: boolean;
}

export function useDocumentContent(doc: DocumentItem | null): DocumentContentState {
  const { backendConnected } = useApp();
  const [loaded, setLoaded] = useState<{ key: string; content: string; failed: boolean } | null>(null);
  const docId = doc?.id;
  const key = doc ? `${doc.id}@${doc.currentVersion}` : '';

  useEffect(() => {
    if (!docId || !backendConnected) return;
    const controller = new AbortController();
    documentsApi
      .getContent(docId, undefined, { signal: controller.signal })
      .then(res => setLoaded({ key, content: res.content || '', failed: false }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, content: '', failed: true });
      });
    return () => controller.abort();
  }, [docId, key, backendConnected]);

  if (!doc) return { content: '', loading: false, unavailable: false };
  if (!backendConnected) {
    const bundled = demoDocumentContents[doc.id];
    return { content: bundled || '', loading: false, unavailable: bundled === undefined };
  }
  return loaded?.key === key
    ? { content: loaded.content, loading: false, unavailable: loaded.failed }
    : { content: '', loading: true, unavailable: false };
}
