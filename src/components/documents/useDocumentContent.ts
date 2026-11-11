import { useEffect, useState } from 'react';
import { DocumentItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { documentsApi } from '../../common/services/api';
import { demoDocumentContents } from '../../data/mockData';

/**
 * Text of a document's current version, read through the version content API (E11-T1).
 * Without a backend connection only the bundled demo documents have text.
 */
export function useDocumentContent(doc: DocumentItem | null): { content: string; loading: boolean } {
  const { backendConnected } = useApp();
  const [loaded, setLoaded] = useState<{ key: string; content: string } | null>(null);
  const docId = doc?.id;
  const key = doc ? `${doc.id}@${doc.currentVersion}` : '';

  useEffect(() => {
    if (!docId || !backendConnected) return;
    const controller = new AbortController();
    documentsApi
      .getContent(docId, undefined, { signal: controller.signal })
      .then(res => setLoaded({ key, content: res.content || '' }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, content: '' });
      });
    return () => controller.abort();
  }, [docId, key, backendConnected]);

  if (!doc) return { content: '', loading: false };
  if (!backendConnected) return { content: demoDocumentContents[doc.id] || '', loading: false };
  return loaded?.key === key ? { content: loaded.content, loading: false } : { content: '', loading: true };
}
