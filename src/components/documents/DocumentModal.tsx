import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { DocumentCategory, DocumentItem, StatusLifecycle } from '../../types';
import { Upload, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Modal, Button, Input } from '../../common/components';
import { syncSha256 } from '../../common/utils/hash';
import { getCurrentTimestamp } from '../../common/utils/date';

interface DocumentModalProps {
  document: DocumentItem | null;
  onClose: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ document, onClose }) => {
  const { addDocument, currentUser, documents, activeProject } = useApp();
  const { t } = useI18n();

  const [title, setTitle] = useState(document ? document.title : '');
  const [category, setCategory] = useState<DocumentCategory>(
    document ? document.category : '02_Business_Requirements'
  );
  const [version, setVersion] = useState(document ? document.currentVersion : 'v1.0');
  const [status, setStatus] = useState<StatusLifecycle>(document ? document.status : 'Draft');
  const [description, setDescription] = useState(document ? document.description : '');
  const [changeSummary, setChangeSummary] = useState('');
  const [tags, setTags] = useState(document ? document.tags.join(', ') : 'BRD, Spec');

  const categories: DocumentCategory[] = [
    '01_Project_Overview',
    '02_Business_Requirements',
    '03_System_Requirements',
    '04_UI_UX',
    '05_Technical_Documents',
    '06_QA',
    '07_EVD_Evidence',
    '08_Change_History'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const nextId = document ? document.id : `DOC-0${documents.length + 1}`;
    const timestamp = getCurrentTimestamp();

    // Cryptographic SHA-256 hash calculation for document version integrity
    const hashPayload = `${nextId}|${title}|${category}|${version}|${description}|${timestamp}`;
    const calculatedChecksum = `sha256:${syncSha256(hashPayload)}`;

    const newDoc: DocumentItem = {
      id: nextId,
      projectId: document ? document.projectId : (activeProject?.id || 'PRJ-01'),
      title,
      category,
      currentVersion: version,
      status,
      author: currentUser,
      updatedAt: timestamp,
      description,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      linkedRequirementsCount: document ? document.linkedRequirementsCount : 0,
      versions: [
        {
          version,
          updatedAt: timestamp,
          author: currentUser,
          status,
          changeSummary: changeSummary || 'Initial document creation with SHA-256 verification.',
          fileSize: '1.5 MB',
          checksum: calculatedChecksum
        },
        ...(document ? document.versions : [])
      ]
    };

    addDocument(newDoc);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={document ? `${t('actionEdit')}: ${document.id}` : t('docUploadCreate')}
      icon={<Upload className="w-5 h-5 text-indigo-400" />}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <Input
          label="Document Title *"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. SRS - Interbank Transfer Specifications"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Standard Folder Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Version Tag *</label>
            <input
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.0"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusLifecycle)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="Draft">{t('statusDraft')}</option>
              <option value="In Review">{t('statusInReview')}</option>
              <option value="Approved">{t('statusApproved')}</option>
              <option value="Deprecated">{t('statusDeprecated')}</option>
            </select>
          </div>

          <Input
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="BRD, Security, Auth"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Description / Scope Summary</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Outline what requirements or technical decisions this document governs..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <Input
          label="Change Summary / Commit Note"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="e.g. Added section 3.4 for multi-factor auth rules"
        />

        {/* SHA-256 Checksum Notice */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            SHA-256 Integrity Checksum
          </span>
          <span className="text-slate-400">Auto-calculated upon save</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            {t('actionCancel')}
          </Button>
          <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
            {t('actionSave')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
