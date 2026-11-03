import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { DocumentCategory, DocumentItem, StatusLifecycle } from '../../types';
import {
  Folder,
  FolderOpen,
  Plus,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  ShieldCheck,
  Hash,
  FolderPlus,
  FolderDot,
  Eye,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Layers,
  FileText
} from 'lucide-react';
import { DocumentModal } from './DocumentModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { ProjectModal } from './ProjectModal';
import { MarkdownPreviewModal } from './MarkdownPreviewModal';
import { Button, Badge, Card, Modal } from '../../common/components';
import { formatHashCode } from '../../common/utils/hash';

export const DocumentsView: React.FC = () => {
  const {
    documents,
    canApprove,
    updateDocumentStatus,
    activeProject,
    setActiveProject,
    projects,
    deleteDocument
  } = useApp();
  const { t } = useI18n();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Modals state
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [activeVersionDoc, setActiveVersionDoc] = useState<DocumentItem | null>(null);
  
  // Dropdowns & utilities
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter documents strictly by current active project
  const projectDocs = documents.filter(doc => (doc.projectId || 'PRJ-01') === activeProject.id);

  const categories: { key: DocumentCategory | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: t('actionAll'), count: projectDocs.length },
    { key: '01_Project_Overview', label: '01 Project Overview', count: projectDocs.filter(d => d.category === '01_Project_Overview').length },
    { key: '02_Business_Requirements', label: '02 Business Requirements', count: projectDocs.filter(d => d.category === '02_Business_Requirements').length },
    { key: '03_System_Requirements', label: '03 System Requirements', count: projectDocs.filter(d => d.category === '03_System_Requirements').length },
    { key: '04_UI_UX', label: '04 UI & UX Specs', count: projectDocs.filter(d => d.category === '04_UI_UX').length },
    { key: '05_Technical_Documents', label: '05 Technical Docs & API', count: projectDocs.filter(d => d.category === '05_Technical_Documents').length },
    { key: '06_QA', label: '06 QA & Test Strategy', count: projectDocs.filter(d => d.category === '06_QA').length },
    { key: '07_EVD_Evidence', label: '07 EVD / Evidence Guides', count: projectDocs.filter(d => d.category === '07_EVD_Evidence').length },
    { key: '08_Change_History', label: '08 Change History & Logs', count: projectDocs.filter(d => d.category === '08_Change_History').length }
  ];

  const filteredDocs = projectDocs.filter(doc => {
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

  const handleCopyChecksum = async (checksum: string) => {
    try {
      await navigator.clipboard.writeText(checksum);
      setCopiedHash(checksum);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    setConfirmDeleteId(null);
  };

  const approvedDocsCount = projectDocs.filter(d => d.status === 'Approved').length;

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">{t('docTitle')}</h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
              {activeProject.key}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t('docSubtitle')}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => setIsProjectModalOpen(true)}
            icon={<FolderPlus className="w-4 h-4 text-emerald-400" />}
          >
            {t('projectCreateNew')}
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsUploadModalOpen(true)}
            icon={<UploadCloud className="w-4 h-4" />}
          >
            {t('docUploadBatch')}
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setSelectedDoc(null);
              setIsDocModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('docUploadCreate')}
          </Button>
        </div>
      </div>

      {/* 2. Active Project Context Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Project Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-750 text-slate-100 hover:border-indigo-500/50 transition-all text-xs font-bold shadow-sm"
            >
              <FolderDot className="w-4 h-4 text-indigo-400" />
              <span>{activeProject.name}</span>
              <span className="font-mono text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-500/30">
                {activeProject.key}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isProjectDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 rounded-xl bg-slate-850 border border-slate-700 shadow-2xl p-2 z-50">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{t('projectSelect')} ({projects.length})</span>
                  <button
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      setIsProjectModalOpen(true);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t('actionCreate')}
                  </button>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto mt-1">
                  {projects.map((p) => {
                    const isSelected = activeProject.id === p.id;
                    const pCount = documents.filter(d => (d.projectId || 'PRJ-01') === p.id).length;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveProject(p);
                          setIsProjectDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="truncate">{p.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 ml-2">{p.key}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                          <span>{p.version} • {p.author?.split('(')[0]?.trim()}</span>
                          <span className="font-mono">{pCount} tài liệu</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:block text-xs text-slate-400 max-w-md truncate">
            {activeProject.description || 'Không gian quản trị tài liệu dự án'}
          </div>
        </div>

        {/* Project Metrics Pills */}
        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Tổng tài liệu:</span>
            <span className="font-bold text-white font-mono">{projectDocs.length}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300/80">Đã duyệt (Baseline):</span>
            <span className="font-bold text-emerald-300 font-mono">{approvedDocsCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: Left Folder Tree / Right Document Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Hierarchy List */}
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t('docStandardFolders')}</span>
            <span className="font-mono text-[10px]">{categories.length - 1} Folders</span>
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

          {/* Cards List or Empty State */}
          {filteredDocs.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <FileText className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-bold text-white">
                  {t('docNoDocsInProject')}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('docEmptyUploadCta')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  onClick={() => setIsUploadModalOpen(true)}
                  icon={<UploadCloud className="w-4 h-4" />}
                >
                  {t('docUploadBatch')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedDoc(null);
                    setIsDocModalOpen(true);
                  }}
                  icon={<Plus className="w-4 h-4" />}
                >
                  {t('docUploadCreate')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => {
                const latestVersion = doc.versions?.[0];
                const checksum = latestVersion?.checksum || '';
                return (
                  <Card key={doc.id} className="p-4 bg-slate-900 border-slate-800 hover:border-slate-700 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
                            {doc.id}
                          </span>
                          <h3 className="text-sm font-bold text-white tracking-tight">
                            {doc.title}
                          </h3>
                          {getStatusBadge(doc.status)}
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {doc.currentVersion}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {doc.description}
                        </p>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                          <span>{doc.author}</span>
                          <span>•</span>
                          <span>{doc.updatedAt}</span>
                          <span>•</span>
                          <span className="text-indigo-300 font-mono">{doc.category}</span>
                          {doc.linkedRequirementsCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 font-semibold">
                                {doc.linkedRequirementsCount} Yêu cầu liên kết
                              </span>
                            </>
                          )}
                        </div>

                        {/* Cryptographic SHA-256 Checksum Signature */}
                        {checksum && (
                          <div className="pt-2 flex items-center gap-2">
                            <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-2 max-w-full">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-slate-400 text-[10px]">SHA-256:</span>
                              <span className="truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={checksum}>
                                {checksum}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyChecksum(checksum)}
                                className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                                title="Sao chép SHA-256"
                              >
                                {copiedHash === checksum ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {/* Preview Markdown Button */}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-colors text-xs flex items-center gap-1 font-medium"
                            title={t('docViewContent')}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('docViewContent')}</span>
                          </button>

                          {/* Version History Button */}
                          <button
                            type="button"
                            onClick={() => setActiveVersionDoc(doc)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 transition-colors text-xs flex items-center gap-1 font-medium"
                            title={t('docVersionHistory')}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{doc.versions?.length || 1} {t('docVersions')}</span>
                          </button>

                          {/* Delete Document Button */}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                            title={t('actionDelete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Approval transition if pending */}
                        {canApprove() && doc.status !== 'Approved' && (
                          <button
                            type="button"
                            onClick={() => updateDocumentStatus(doc.id, 'Approved')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-[11px] font-semibold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {t('actionApprove')}
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Modals */}
      {/* Create Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

      {/* Upload Documents (.md, .zip) Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* Manual Document Create / Edit Modal */}
      {isDocModalOpen && (
        <DocumentModal
          document={selectedDoc}
          onClose={() => {
            setIsDocModalOpen(false);
            setSelectedDoc(null);
          }}
        />
      )}

      {/* Markdown Preview Modal */}
      <MarkdownPreviewModal
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmDeleteId(null)}
          title="Xác nhận xóa tài liệu"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              {t('docDeleteConfirm')} <br />
              <span className="font-mono text-indigo-400 font-bold">{confirmDeleteId}</span>
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                {t('actionCancel')}
              </Button>
              <Button variant="danger" onClick={() => handleDelete(confirmDeleteId)}>
                {t('actionDelete')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Version History Modal */}
      {activeVersionDoc && (
        <Modal
          isOpen={true}
          onClose={() => setActiveVersionDoc(null)}
          title={
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              <span>{t('docVersionHistory')}: {activeVersionDoc.id}</span>
            </div>
          }
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <h4 className="font-bold text-white">{activeVersionDoc.title}</h4>
              <p className="text-slate-400 text-[11px] mt-0.5">{activeVersionDoc.category}</p>
            </div>

            <div className="space-y-2">
              {activeVersionDoc.versions.map((ver, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800">
                        {ver.version}
                      </span>
                      {getStatusBadge(ver.status)}
                      <span className="text-slate-400 text-[11px]">{ver.updatedAt}</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">{ver.author}</span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {ver.changeSummary}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-850">
                    <span>{t('docFileSize')}: {ver.fileSize}</span>
                    <div className="flex items-center gap-1.5 font-mono text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]" title={ver.checksum}>
                        {formatHashCode(ver.checksum)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" onClick={() => setActiveVersionDoc(null)}>
                {t('actionClose')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
