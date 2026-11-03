import React, { useState, useMemo } from 'react';
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
  FolderPlus,
  FolderDot,
  Eye,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  FileText,
  User,
  Calendar,
  Link2,
  Search,
  BookOpen,
  ListFilter,
  FileCheck2,
  ChevronRight
} from 'lucide-react';
import { DocumentModal } from './DocumentModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { ProjectModal } from './ProjectModal';
import { MarkdownPreviewModal } from './MarkdownPreviewModal';
import { DocumentReaderView } from './DocumentReaderView';
import { Button, Badge, Modal } from '../../common/components';
import { formatHashCode } from '../../common/utils/hash';

const CATEGORY_LABELS: Record<DocumentCategory, { vi: string; en: string; shortVi: string; shortEn: string }> = {
  '01_Project_Overview': {
    vi: '01. Tổng quan dự án',
    en: '01. Project Overview',
    shortVi: 'Tổng quan dự án',
    shortEn: 'Project Overview'
  },
  '02_Business_Requirements': {
    vi: '02. Yêu cầu nghiệp vụ (BRD)',
    en: '02. Business Requirements',
    shortVi: 'Yêu cầu nghiệp vụ (BRD)',
    shortEn: 'Business Requirements'
  },
  '03_System_Requirements': {
    vi: '03. Đặc tả hệ thống (SRS)',
    en: '03. System Requirements',
    shortVi: 'Đặc tả hệ thống (SRS)',
    shortEn: 'System Requirements'
  },
  '04_UI_UX': {
    vi: '04. Thiết kế UI / UX',
    en: '04. UI & UX Design',
    shortVi: 'Thiết kế UI / UX',
    shortEn: 'UI & UX Design'
  },
  '05_Technical_Documents': {
    vi: '05. Tài liệu kỹ thuật & API',
    en: '05. Technical & API Docs',
    shortVi: 'Tài liệu kỹ thuật & API',
    shortEn: 'Technical & API'
  },
  '06_QA': {
    vi: '06. Kế hoạch & Chiến lược QA',
    en: '06. QA & Test Strategy',
    shortVi: 'Kế hoạch QA',
    shortEn: 'QA Strategy'
  },
  '07_EVD_Evidence': {
    vi: '07. Hướng dẫn Bằng chứng (EVD)',
    en: '07. Evidence Guides (EVD)',
    shortVi: 'Bằng chứng (EVD)',
    shortEn: 'Evidence (EVD)'
  },
  '08_Change_History': {
    vi: '08. Lịch sử thay đổi',
    en: '08. Change History',
    shortVi: 'Lịch sử thay đổi',
    shortEn: 'Change History'
  }
};

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
  const { t, language } = useI18n();

  // Mode: 'reader' (Đọc tài liệu dự án) vs 'list' (Quản lý danh sách tải lên)
  const [viewMode, setViewMode] = useState<'reader' | 'list'>('reader');
  const [readingDocId, setReadingDocId] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');

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
  const projectDocs = useMemo(() => {
    return documents.filter(doc => (doc.projectId || 'PRJ-01') === activeProject.id);
  }, [documents, activeProject.id]);

  // Current document for reader mode
  const currentReadingDoc = useMemo(() => {
    if (readingDocId) {
      const found = projectDocs.find(d => d.id === readingDocId);
      if (found) return found;
    }
    return projectDocs[0] || null;
  }, [projectDocs, readingDocId]);

  const getCategoryLabel = (cat: DocumentCategory, short = false) => {
    const item = CATEGORY_LABELS[cat];
    if (!item) return cat;
    if (short) return language === 'vi' ? item.shortVi : item.shortEn;
    return language === 'vi' ? item.vi : item.en;
  };

  const categories: { key: DocumentCategory | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: language === 'vi' ? 'Tất cả tài liệu' : 'All Documents', count: projectDocs.length },
    ...(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map(key => ({
      key,
      label: getCategoryLabel(key, false),
      count: projectDocs.filter(d => d.category === key).length
    }))
  ];

  const filteredDocs = useMemo(() => {
    return projectDocs.filter(doc => {
      if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) return false;
      if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;
      if (localSearch.trim()) {
        const q = localSearch.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchId = doc.id.toLowerCase().includes(q);
        const matchDesc = doc.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchDesc) return false;
      }
      return true;
    });
  }, [projectDocs, selectedCategory, statusFilter, localSearch]);

  const getStatusBadge = (status: StatusLifecycle) => {
    switch (status) {
      case 'Approved':
        return (
          <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
            {language === 'vi' ? 'Đã duyệt' : 'Approved'}
          </Badge>
        );
      case 'In Review':
        return (
          <Badge variant="warning" icon={<Clock className="w-3 h-3" />}>
            {language === 'vi' ? 'Chờ duyệt' : 'In Review'}
          </Badge>
        );
      case 'Draft':
        return (
          <Badge variant="neutral">
            {language === 'vi' ? 'Bản nháp' : 'Draft'}
          </Badge>
        );
      case 'Deprecated':
        return (
          <Badge variant="danger" icon={<AlertTriangle className="w-3 h-3" />}>
            {language === 'vi' ? 'Ngưng dùng' : 'Deprecated'}
          </Badge>
        );
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

  const approvedCount = projectDocs.filter(d => d.status === 'Approved').length;
  const draftOrReviewCount = projectDocs.filter(d => d.status === 'Draft' || d.status === 'In Review').length;

  return (
    <div className="space-y-5">
      {/* 1. Unified Project Workspace Header & Mode Switcher */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Active Project Selector & Metrics */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-950/80 border border-slate-750 hover:border-indigo-500/50 text-white transition-all shadow-sm whitespace-nowrap"
              >
                <FolderDot className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-sm font-bold tracking-tight">{activeProject.name}</span>
                <span className="font-mono text-[11px] font-semibold text-indigo-300 bg-indigo-950/90 px-2 py-0.5 rounded-md border border-indigo-500/30">
                  {activeProject.key}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                      className="text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {t('actionCreate')}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto mt-1">
                    {projects.map((p) => {
                      const isSelected = activeProject.id === p.id;
                      const pCount = documents.filter(d => (d.projectId || 'PRJ-01') === p.id).length;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveProject(p);
                            setIsProjectDropdownOpen(false);
                            setReadingDocId(null);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                            isSelected
                              ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-semibold flex items-center justify-between gap-2">
                            <span className="truncate">{p.name}</span>
                            <span className="font-mono text-[10px] text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded shrink-0">
                              {p.key}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                            <span>{p.version} • {p.author?.split('(')[0]?.trim()}</span>
                            <span className="font-mono text-slate-300">{pCount} tài liệu</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-750 text-slate-300 font-medium">
                Tổng: <strong className="text-white font-mono">{projectDocs.length}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-medium">
                Đã duyệt: <strong className="font-mono">{approvedCount}</strong>
              </span>
              {draftOrReviewCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 font-medium">
                  Chờ duyệt: <strong className="font-mono">{draftOrReviewCount}</strong>
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-400 truncate max-w-2xl pl-0.5">
            {activeProject.description || 'Không gian đọc và quản trị tài liệu đặc tả dự án'}
          </p>
        </div>

        {/* Right: View Mode Toggle & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Mode Switcher: Đọc tài liệu (Reader) vs Quản lý (List) */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-750">
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'reader'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Đọc tài liệu' : 'Doc Reader'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Lịch sử tải lên' : 'Upload List'}</span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsProjectModalOpen(true)}
            icon={<FolderPlus className="w-4 h-4 text-emerald-400" />}
          >
            {language === 'vi' ? 'Dự án mới' : 'New Project'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsUploadModalOpen(true)}
            icon={<UploadCloud className="w-4 h-4" />}
          >
            {language === 'vi' ? 'Tải lên (.md, .zip)' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* 2. READER WORKSPACE MODE (Chỗ Đọc Tài Liệu Dự Án) */}
      {viewMode === 'reader' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Navigation Tree & Document List (3.5 cols) */}
          <div className="lg:col-span-3 space-y-3">
            {/* Search Document in Project */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={language === 'vi' ? 'Tìm tài liệu trong dự án...' : 'Search document...'}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Document Tree by Categories */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 max-h-[75vh] overflow-y-auto">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{language === 'vi' ? 'Mục lục tài liệu' : 'Documents'}</span>
                <span className="font-mono text-[10px] text-slate-500">{projectDocs.length} tệp</span>
              </div>

              {/* All / Category Filter Tabs */}
              <div className="flex flex-wrap gap-1 pb-1 border-b border-slate-800">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Tất cả ({projectDocs.length})
                </button>
                {categories.filter(c => c.key !== 'ALL' && c.count > 0).map(c => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCategory(c.key)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      selectedCategory === c.key
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {c.key.split('_')[1]} ({c.count})
                  </button>
                ))}
              </div>

              {/* Documents List */}
              <div className="space-y-1 pt-1">
                {filteredDocs.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 text-center">Không tìm thấy tài liệu phù hợp.</p>
                ) : (
                  filteredDocs.map(doc => {
                    const isSelected = currentReadingDoc?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setReadingDocId(doc.id)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-indigo-600/25 border border-indigo-500/50 text-white shadow-sm'
                            : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                        }`}
                      >
                        <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] font-bold text-indigo-300">{doc.id}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${doc.status === 'Approved' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          </div>
                          <div className="font-medium text-xs truncate mt-0.5" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                            <span className="truncate">{doc.category.split('_')[1]}</span>
                            <span className="font-mono">{doc.currentVersion}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Quick Upload CTA at bottom of tree */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-semibold text-indigo-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>+ Tải lên file .md hoặc .zip</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Reader Canvas (8.5 cols) */}
          <div className="lg:col-span-9">
            {currentReadingDoc ? (
              <DocumentReaderView
                document={currentReadingDoc}
                onEdit={(d) => {
                  setSelectedDoc(d);
                  setIsDocModalOpen(true);
                }}
                onDelete={(id) => setConfirmDeleteId(id)}
                onBackToList={() => setViewMode('list')}
              />
            ) : (
              /* Empty Workspace */
              <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-sm font-bold text-white">
                    {t('docNoDocsInProject')}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
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
            )}
          </div>
        </div>
      )}

      {/* 3. UPLOAD LIST & CARD MANAGEMENT MODE */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Sidebar: Standard 8 Folders */}
          <div className="lg:col-span-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{language === 'vi' ? 'Danh mục tài liệu' : 'Categories'}</span>
              <span className="font-mono text-[10px] text-slate-500">8 chuẩn</span>
            </div>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40 font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isSelected ? (
                      <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? 'bg-indigo-500 text-white font-bold'
                        : cat.count > 0
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-850 text-slate-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Area: Filter Bar & Document Cards */}
          <div className="lg:col-span-9 space-y-4">
            {/* Filter & Search Bar */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(
                  [
                    { key: 'ALL', label: language === 'vi' ? 'Tất cả' : 'All' },
                    { key: 'Approved', label: language === 'vi' ? 'Đã duyệt' : 'Approved' },
                    { key: 'In Review', label: language === 'vi' ? 'Chờ duyệt' : 'In Review' },
                    { key: 'Draft', label: language === 'vi' ? 'Bản nháp' : 'Draft' },
                    { key: 'Deprecated', label: language === 'vi' ? 'Ngưng dùng' : 'Deprecated' }
                  ] as const
                ).map(st => {
                  const active = statusFilter === st.key;
                  return (
                    <button
                      key={st.key}
                      onClick={() => setStatusFilter(st.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-850 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>

              {/* Quick Local Search */}
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    placeholder={language === 'vi' ? 'Lọc nhanh tên, mã DOC...' : 'Filter by title, ID...'}
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap hidden md:inline">
                  <strong className="text-slate-200">{filteredDocs.length}</strong> tài liệu
                </span>
              </div>
            </div>

            {/* Document Cards List */}
            {filteredDocs.length === 0 ? (
              <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FileText className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-sm font-bold text-white">
                    {t('docNoDocsInProject')}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
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
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map((doc) => {
                  const latestVersion = doc.versions?.[0];
                  const checksum = latestVersion?.checksum || '';
                  const shortChecksum = checksum
                    ? `${checksum.replace('sha256:', '').slice(0, 10)}...${checksum.slice(-6)}`
                    : '';

                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-3"
                    >
                      {/* Card Top Row: ID + Title + Status + Actions */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-950/90 px-2.5 py-0.5 rounded-lg border border-indigo-500/30 shrink-0">
                            {doc.id}
                          </span>
                          <h3
                            onClick={() => {
                              setReadingDocId(doc.id);
                              setViewMode('reader');
                            }}
                            title={doc.title}
                            className="text-sm font-bold text-white hover:text-indigo-300 cursor-pointer transition-colors truncate"
                          >
                            {doc.title}
                          </h3>
                          {getStatusBadge(doc.status)}
                          <span className="font-mono text-[11px] font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 shrink-0">
                            {doc.currentVersion}
                          </span>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canApprove() && doc.status !== 'Approved' && (
                            <button
                              type="button"
                              onClick={() => updateDocumentStatus(doc.id, 'Approved')}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === 'vi' ? 'Duyệt' : 'Approve'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setReadingDocId(doc.id);
                              setViewMode('reader');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-sm shadow-indigo-600/20"
                            title="Mở chế độ đọc tài liệu"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{language === 'vi' ? 'Đọc' : 'Read'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveVersionDoc(doc)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white transition-colors text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                            title={t('docVersionHistory')}
                          >
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            <span>{doc.versions?.length || 1} bản</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            className="p-1.5 rounded-xl bg-slate-850 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
                            title={t('actionDelete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Middle Row: Description */}
                      {doc.description && (
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                          {doc.description}
                        </p>
                      )}

                      {/* Card Bottom Row: Metadata & SHA-256 */}
                      <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <span className="inline-flex items-center gap-1.5 text-indigo-300 font-medium">
                            <Folder className="w-3.5 h-3.5 text-indigo-400" />
                            {getCategoryLabel(doc.category, true)}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            {doc.author}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {doc.updatedAt}
                          </span>

                          {doc.linkedRequirementsCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                              <Link2 className="w-3.5 h-3.5" />
                              {doc.linkedRequirementsCount} yêu cầu liên kết
                            </span>
                          )}
                        </div>

                        {/* SHA-256 Pill */}
                        {checksum && (
                          <button
                            type="button"
                            onClick={() => handleCopyChecksum(checksum)}
                            title={`Nhấp để sao chép mã toàn vẹn: ${checksum}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-950/80 border border-emerald-500/25 hover:border-emerald-500/50 text-emerald-300 font-mono text-[11px] transition-all whitespace-nowrap shrink-0"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-slate-400">SHA-256:</span>
                            <span>{shortChecksum}</span>
                            {copiedHash === checksum ? (
                              <Check className="w-3 h-3 text-emerald-400 ml-0.5" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400 hover:text-white ml-0.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {isDocModalOpen && (
        <DocumentModal
          document={selectedDoc}
          onClose={() => {
            setIsDocModalOpen(false);
            setSelectedDoc(null);
          }}
        />
      )}

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
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('docDeleteConfirm')} <br />
              Mã tài liệu: <span className="font-mono text-indigo-400 font-bold">{confirmDeleteId}</span>
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
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <h4 className="font-bold text-white text-sm">{activeVersionDoc.title}</h4>
              <p className="text-indigo-300 text-xs mt-1">{getCategoryLabel(activeVersionDoc.category, false)}</p>
            </div>

            <div className="space-y-2.5">
              {activeVersionDoc.versions.map((ver, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
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

                  <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 border-t border-slate-850">
                    <span>{t('docFileSize')}: {ver.fileSize}</span>
                    <div className="flex items-center gap-1.5 font-mono text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span title={ver.checksum}>
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
