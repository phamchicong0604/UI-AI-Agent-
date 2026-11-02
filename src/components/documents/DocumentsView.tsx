import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { DocumentCategory, DocumentItem, StatusLifecycle } from '../../types';
import {
  Folder,
  FolderOpen,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { DocumentModal } from './DocumentModal';
import { Button, Badge, Card, Modal } from '../../common/components';
import { formatHashCode } from '../../common/utils/hash';

export const DocumentsView: React.FC = () => {
  const { documents, canApprove, updateDocumentStatus } = useApp();
  const { t } = useI18n();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeVersionDoc, setActiveVersionDoc] = useState<DocumentItem | null>(null);

  const categories: { key: DocumentCategory | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: t('actionAll'), count: documents.length },
    { key: '01_Project_Overview', label: '01 Project Overview', count: documents.filter(d => d.category === '01_Project_Overview').length },
    { key: '02_Business_Requirements', label: '02 Business Requirements', count: documents.filter(d => d.category === '02_Business_Requirements').length },
    { key: '03_System_Requirements', label: '03 System Requirements', count: documents.filter(d => d.category === '03_System_Requirements').length },
    { key: '04_UI_UX', label: '04 UI & UX Specs', count: documents.filter(d => d.category === '04_UI_UX').length },
    { key: '05_Technical_Documents', label: '05 Technical Docs & API', count: documents.filter(d => d.category === '05_Technical_Documents').length },
    { key: '06_QA', label: '06 QA & Test Strategy', count: documents.filter(d => d.category === '06_QA').length },
    { key: '07_EVD_Evidence', label: '07 EVD / Evidence Guides', count: documents.filter(d => d.category === '07_EVD_Evidence').length },
    { key: '08_Change_History', label: '08 Change History & Logs', count: documents.filter(d => d.category === '08_Change_History').length }
  ];

  const filteredDocs = documents.filter(doc => {
    if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) return false;
    if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: StatusLifecycle) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>{t('statusApproved')}</Badge>;
      case 'In Review':
        return <Badge variant="warning" icon={<Clock className="w-3 h-3" />}>{t('statusInReview')}</Badge>;
      case 'Draft':
        return <Badge variant="neutral">{t('statusDraft')}</Badge>;
      case 'Deprecated':
        return <Badge variant="danger" icon={<AlertTriangle className="w-3 h-3" />}>{t('statusDeprecated')}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{t('docTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('docSubtitle')}</p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setSelectedDoc(null);
            setIsModalOpen(true);
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          {t('docUploadCreate')}
        </Button>
      </div>

      {/* Main Layout: Left Folder Tree / Right Document Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Hierarchy List */}
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t('docStandardFolders')}</span>
            <span className="font-mono text-[10px]">8 Folders</span>
          </div>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {isSelected ? (
                    <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{cat.label}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Document Cards Table / Grid */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">{t('docStatusFilter')}</span>
              {(['ALL', 'Approved', 'In Review', 'Draft', 'Deprecated'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st === 'ALL' ? t('actionAll') : st}
                </button>
              ))}
            </div>

            <div className="text-slate-400 text-xs">
              {t('docShowingCount', { count: filteredDocs.length })}
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {filteredDocs.map((doc) => (
              <Card
                key={doc.id}
                className="space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                        {doc.id}
                      </span>
                      <h3 className="font-semibold text-white text-sm hover:text-indigo-400 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedDoc(doc);
                          setIsModalOpen(true);
                        }}
                      >
                        {doc.title}
                      </h3>
                      <span className="font-mono text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {doc.currentVersion}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{doc.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(doc.status)}
                  </div>
                </div>

                {/* Metadata & Version info with SHA-256 Checksum preview */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-4">
                    <span>Folder: <strong className="text-slate-300 font-medium">{doc.category}</strong></span>
                    <span>Author: <strong className="text-slate-300 font-medium">{doc.author}</strong></span>
                    <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                      <Hash className="w-3 h-3 text-emerald-400" />
                      {formatHashCode(doc.versions[0]?.checksum || '', true)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveVersionDoc(doc)}
                      icon={<History className="w-3.5 h-3.5 text-indigo-400" />}
                    >
                      {doc.versions.length} {t('docVersions')}
                    </Button>

                    {canApprove() && doc.status !== 'Approved' && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => updateDocumentStatus(doc.id, 'Approved')}
                      >
                        {t('actionApprove')} {doc.currentVersion}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Warning banner if not approved */}
                {doc.status !== 'Approved' && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-[11px] text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{t('docRuleWarning')}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Version History Modal with Real SHA-256 Checksum Inspection */}
      {activeVersionDoc && (
        <Modal
          isOpen={true}
          onClose={() => setActiveVersionDoc(null)}
          title={`${t('docVersionHistory')}: ${activeVersionDoc.title}`}
          icon={<History className="w-5 h-5 text-indigo-400" />}
          maxWidth="2xl"
          footer={
            <Button variant="secondary" onClick={() => setActiveVersionDoc(null)}>
              {t('actionClose')}
            </Button>
          }
        >
          <div className="space-y-3">
            {activeVersionDoc.versions.map((ver, idx) => (
              <div key={ver.version} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30">
                      {ver.version}
                    </span>
                    {idx === 0 && (
                      <Badge variant="success">Current</Badge>
                    )}
                    <span className="text-xs text-slate-300 font-medium">By {ver.author}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{ver.updatedAt}</span>
                </div>
                <p className="text-xs text-slate-300">{ver.changeSummary}</p>
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-slate-850">
                  <span>{t('docFileSize')}: {ver.fileSize}</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {ver.checksum}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Document Create/Edit Modal */}
      {isModalOpen && (
        <DocumentModal
          document={selectedDoc}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
