import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocumentCategory, DocumentItem, StatusLifecycle } from '../../types';
import { getDefaultDocumentMarkdown } from './documentTemplate';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  FileText,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  User,
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Bookmark,
  Share2,
  ExternalLink,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  ListOrdered,
  Layers,
  ArrowLeft,
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  Home,
  Tag
} from 'lucide-react';
import { Badge, Button } from '../../common/components';
import { ClassificationBadges } from './ClassificationBadges';
import { formatHashCode } from '../../common/utils/hash';

interface DocumentReaderViewProps {
  document: DocumentItem;
  allProjectDocs?: DocumentItem[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  onSelectDoc?: (docId: string) => void;
  onBackToList?: () => void;
  onEdit?: (doc: DocumentItem) => void;
  onDelete?: (id: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const CATEGORY_KEYS = [
  '01_Project_Overview',
  '02_Business_Requirements',
  '03_System_Requirements',
  '04_UI_UX',
  '05_Technical_Documents',
  '06_QA',
  '07_EVD_Evidence',
  '08_Change_History'
];

export const DocumentReaderView: React.FC<DocumentReaderViewProps> = ({
  document: doc,
  allProjectDocs = [],
  selectedCategory = 'ALL',
  onSelectCategory,
  onSelectDoc,
  onBackToList,
  onEdit,
  onDelete,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  const { activeProject, canApprove, updateDocumentStatus, requirements, setActiveTab } = useApp();
  const { t, language } = useI18n();

  const [activeTab, setActiveReaderTab] = useState<'content' | 'requirements' | 'versions'>('content');
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  // In-reader category dropdown & doc dropdown
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);

  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const docPickerRef = useRef<HTMLDivElement>(null);

  const getCategoryDisplayName = (catKey: string) => {
    switch (catKey) {
      case 'ALL': return t('allDocuments');
      case '01_Project_Overview': return t('cat01_overview');
      case '02_Business_Requirements': return t('cat02_brd');
      case '03_System_Requirements': return t('cat03_srs');
      case '04_UI_UX': return t('cat04_uiux');
      case '05_Technical_Documents': return t('cat05_tech');
      case '06_QA': return t('cat06_qa');
      case '07_EVD_Evidence': return t('cat07_evd');
      case '08_Change_History': return t('cat08_change');
      default: return catKey;
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target as Node)) {
        setIsCategoryPickerOpen(false);
      }
      if (docPickerRef.current && !docPickerRef.current.contains(e.target as Node)) {
        setIsDocPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Previous and Next documents in the project sequence
  const currentIndex = useMemo(() => {
    return allProjectDocs.findIndex(d => d.id === doc.id);
  }, [allProjectDocs, doc.id]);

  const prevDoc = currentIndex > 0 ? allProjectDocs[currentIndex - 1] : null;
  const nextDoc = currentIndex >= 0 && currentIndex < allProjectDocs.length - 1 ? allProjectDocs[currentIndex + 1] : null;

  // Documents in the same category
  const sameCategoryDocs = useMemo(() => {
    return allProjectDocs.filter(d => d.category === doc.category);
  }, [allProjectDocs, doc.category]);

  // Fallback rich markdown content if none stored
  const content = useMemo(() => {
    if (doc.contentMarkdown && doc.contentMarkdown.trim().length > 0) {
      return doc.contentMarkdown;
    }
    return getDefaultDocumentMarkdown(doc, activeProject, language);
  }, [doc, activeProject, language]);

  // Extract Table of Contents (Headings) from markdown
  const tableOfContents = useMemo(() => {
    const lines = content.split('\n');
    const headings: { id: string; text: string; level: number }[] = [];
    lines.forEach((line: string) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        headings.push({ id, text, level });
      }
    });
    return headings;
  }, [content]);

  // Linked requirements
  const linkedRequirements = useMemo(() => {
    return requirements.filter(r => 
      r.sourceReferences?.some(ref => ref.documentId === doc.id) ||
      r.description?.includes(doc.id) ||
      r.title?.includes(doc.id)
    );
  }, [requirements, doc.id]);

  const latestVersion = doc.versions?.[0];
  const checksum = latestVersion?.checksum || '';

  const copyChecksum = async () => {
    if (!checksum) return;
    try {
      await navigator.clipboard.writeText(checksum);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {}
  };

  const copyMarkdownContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    } catch {}
  };

  const getStatusBadge = (status: StatusLifecycle) => {
    switch (status) {
      case 'Approved':
        return (
          <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            {t('docStatusApproved')}
          </Badge>
        );
      case 'In Review':
        return (
          <Badge variant="warning" icon={<Clock className="w-3.5 h-3.5" />}>
            {t('docStatusInReview')}
          </Badge>
        );
      case 'Draft':
        return (
          <Badge variant="neutral">
            {t('docStatusDraft')}
          </Badge>
        );
      case 'Deprecated':
        return (
          <Badge variant="danger" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            {t('docStatusDeprecated')}
          </Badge>
        );
      default:
        return null;
    }
  };

  // Safe and clean Markdown Parser / Renderer
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    let inTable = false;
    let tableRows: string[][] = [];

    const elements: React.ReactNode[] = [];

    const flushTable = (keyPrefix: number) => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(1).filter(row => !row.every(c => /^:?-+:?$/.test(c.trim())));
        elements.push(
          <div key={`table-${keyPrefix}`} className="my-4 overflow-x-auto rounded-xl border border-slate-750">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-750 text-slate-200">
                  {header.map((col, idx) => (
                    <th key={idx} className="p-3 font-semibold">
                      {col.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                {body.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 text-slate-300">
                        {cell.trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table line
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cols = trimmed.slice(1, -1).split('|');
        tableRows.push(cols);
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        const headingText = trimmed.replace(/^#\s+/, '');
        const headingId = headingText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        elements.push(
          <h1
            key={idx}
            id={headingId}
            className="text-xl font-extrabold text-white pt-5 pb-2 border-b border-slate-750 mt-2 tracking-tight flex items-center gap-2"
          >
            <span className="text-indigo-400">#</span>
            <span>{headingText}</span>
          </h1>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        const headingText = trimmed.replace(/^##\s+/, '');
        const headingId = headingText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        elements.push(
          <h2
            key={idx}
            id={headingId}
            className="text-base font-bold text-slate-100 pt-5 pb-1 border-b border-slate-800 mt-4 tracking-tight flex items-center gap-2"
          >
            <span className="text-indigo-400 text-sm">##</span>
            <span>{headingText}</span>
          </h2>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        const headingText = trimmed.replace(/^###\s+/, '');
        const headingId = headingText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        elements.push(
          <h3
            key={idx}
            id={headingId}
            className="text-sm font-semibold text-indigo-200 pt-3 mt-2 flex items-center gap-1.5"
          >
            <span className="text-indigo-400 text-xs">###</span>
            <span>{headingText}</span>
          </h3>
        );
        return;
      }

      // Blockquotes
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        elements.push(
          <div
            key={idx}
            className="my-2 pl-3.5 py-1.5 border-l-2 border-indigo-500 bg-indigo-950/20 text-xs text-slate-300 rounded-r-lg font-mono"
          >
            {quoteText}
          </div>
        );
        return;
      }

      // Checkboxes
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        const isChecked = trimmed.startsWith('- [x]');
        const taskText = trimmed.replace(/^- \[( |x)\]\s*/, '');
        elements.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 py-1">
            {isChecked ? (
              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            )}
            <span className={isChecked ? 'line-through text-slate-400' : ''}>
              {taskText}
            </span>
          </div>
        );
        return;
      }

      // Bullet lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listText = trimmed.replace(/^[-*]\s+/, '');
        elements.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 py-0.5 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
            <span className="leading-relaxed">{listText}</span>
          </div>
        );
        return;
      }

      // Horizontal separator
      if (trimmed === '---') {
        elements.push(<hr key={idx} className="my-4 border-slate-800" />);
        return;
      }

      // Regular Paragraph
      if (trimmed.length > 0) {
        elements.push(
          <p key={idx} className="text-xs text-slate-300 leading-relaxed py-1">
            {trimmed}
          </p>
        );
      }
    });

    if (inTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  const getCategoryLabel = (cat: string) => {
    return getCategoryDisplayName(cat);
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP DEDICATED BACK & BREADCRUMB NAVIGATION BAR */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-30">
        {/* Left: Back Button & Clickable Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
          {/* Prominent Back Button */}
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm hover:border-indigo-500/50 transition-all group shrink-0"
              title={t('docReaderBackTitle')}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t('docReaderBack')}</span>
            </button>
          )}

          {/* Sidebar Toggle Button (Zen Mode) */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 text-xs transition-colors shrink-0"
              title={isSidebarCollapsed ? t('docReaderToggleSidebarCollapsed') : t('docReaderToggleSidebarExpanded')}
            >
              {isSidebarCollapsed ? <PanelLeft className="w-3.5 h-3.5 text-indigo-400" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="flex items-center gap-1.5 text-slate-400 py-0.5 flex-wrap">
            {/* Breadcrumb 1: Project */}
            <span className="font-semibold text-slate-300 flex items-center gap-1 shrink-0">
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeProject.name}</span>
            </span>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

            {/* Breadcrumb 2: Interactive Category Dropdown Picker */}
            <div className="relative shrink-0" ref={categoryPickerRef}>
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
                title={t('docReaderSwitchCategoryTitle')}
              >
                <span>{getCategoryLabel(doc.category)}</span>
                <ChevronDown className={`w-3 h-3 text-indigo-400 transition-transform ${isCategoryPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoryPickerOpen && (
                <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-slate-850 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                    {t('docReaderSwitchCategory')}
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {CATEGORY_KEYS.map((catKey) => {
                      const count = allProjectDocs.filter(d => d.category === catKey).length;
                      const isCurrent = doc.category === catKey;
                      return (
                        <button
                          key={catKey}
                          onClick={() => {
                            if (onSelectCategory) onSelectCategory(catKey);
                            const firstDocInCat = allProjectDocs.find(d => d.category === catKey);
                            if (firstDocInCat && onSelectDoc) {
                              onSelectDoc(firstDocInCat.id);
                            }
                            setIsCategoryPickerOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-indigo-600/30 text-indigo-200 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{getCategoryDisplayName(catKey)}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded ml-1 shrink-0">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

            {/* Breadcrumb 3: Interactive Document Dropdown Picker */}
            <div className="relative shrink-0" ref={docPickerRef}>
              <button
                type="button"
                onClick={() => setIsDocPickerOpen(!isDocPickerOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 text-xs font-mono font-bold transition-colors"
                title={t('docReaderSameCategoryTitle')}
              >
                <span>{doc.id}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isDocPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDocPickerOpen && (
                <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-slate-850 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                    {t('docReaderSameCategory')} ({sameCategoryDocs.length})
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {sameCategoryDocs.map((d) => {
                      const isCurrent = d.id === doc.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => {
                            if (onSelectDoc) onSelectDoc(d.id);
                            setIsDocPickerOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg text-xs transition-colors ${
                            isCurrent
                              ? 'bg-indigo-600/30 text-indigo-200 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="font-bold text-indigo-300">{d.id}</span>
                            <span>{d.currentVersion}</span>
                          </div>
                          <div className="text-xs truncate font-sans text-slate-200 mt-0.5">
                            {d.title}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick In-Reader Prev / Next Navigation & Article Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Previous / Next Document Buttons */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => prevDoc && onSelectDoc && onSelectDoc(prevDoc.id)}
              disabled={!prevDoc}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title={prevDoc ? t('docReaderPrevDocTitle', { id: prevDoc.id, title: prevDoc.title }) : t('docReaderFirstDocTitle')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('docReaderPrevDoc')}</span>
            </button>

            <span className="text-[10px] text-slate-500 font-mono px-1 select-none">
              {currentIndex + 1}/{allProjectDocs.length}
            </span>

            <button
              type="button"
              onClick={() => nextDoc && onSelectDoc && onSelectDoc(nextDoc.id)}
              disabled={!nextDoc}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title={nextDoc ? t('docReaderNextDocTitle', { id: nextDoc.id, title: nextDoc.title }) : t('docReaderLastDocTitle')}
            >
              <span className="hidden sm:inline">{t('docReaderNextDoc')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Approve Button if role can approve */}
          {canApprove() && doc.status !== 'Approved' && (
            <Button
              variant="success"
              size="sm"
              onClick={() => updateDocumentStatus(doc.id, 'Approved')}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              {t('actionApprove')}
            </Button>
          )}

          {/* Copy Markdown */}
          <Button
            variant="secondary"
            size="sm"
            onClick={copyMarkdownContent}
            icon={copiedContent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copiedContent ? t('docReaderCopiedMd') : t('docReaderCopyMd')}
          </Button>

          {/* Edit */}
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(doc)}
              icon={<Edit3 className="w-3.5 h-3.5 text-slate-300" />}
            >
              {t('docReaderEdit')}
            </Button>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="p-2 rounded-xl bg-slate-850 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
              title={t('docReaderDeleteTitle')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. DOCUMENT IDENTITY TITLE & METADATA BAR */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">{doc.title}</h1>
              {getStatusBadge(doc.status)}
              <ClassificationBadges doc={doc} />
              <span className="font-mono text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {doc.currentVersion}
              </span>
            </div>
            {doc.description && (
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                {doc.description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata Strip & SHA-256 Checksum Pill */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('docReaderAuthor')} <strong className="text-white">{doc.author}</strong></span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('docReaderUpdated')} <strong className="text-white">{doc.updatedAt}</strong></span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-indigo-300">
              <Link2 className="w-3.5 h-3.5" />
              <span>{t('docReaderLinkedReqsCount', { count: linkedRequirements.length })}</span>
            </span>
          </div>

          {/* Cryptographic SHA-256 Checksum Badge */}
          {checksum && (
            <div
              onClick={copyChecksum}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white cursor-pointer transition-colors font-mono text-[11px]"
              title={t('docReaderCopyShaTitle')}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">SHA-256:</span>
              <span className="text-emerald-300 font-bold">{formatHashCode(checksum, true)}</span>
              {copiedHash ? (
                <Check className="w-3 h-3 text-emerald-400 ml-1" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500 ml-1" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. TABS SWITCHER */}
      <div className="flex items-center gap-1 border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveReaderTab('content')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
            activeTab === 'content'
              ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t('docReaderTabContent')}</span>
        </button>

        <button
          onClick={() => setActiveReaderTab('requirements')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
            activeTab === 'requirements'
              ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>{t('docReaderTabReqs')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {linkedRequirements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveReaderTab('versions')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
            activeTab === 'versions'
              ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t('docReaderTabVersions')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {doc.versions?.length || 1}
          </span>
        </button>
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {/* Tab: Document Content with Sticky Table of Contents */}
      {activeTab === 'content' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Markdown Content Canvas (9 cols) */}
          <div className="xl:col-span-9 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2 text-slate-200 min-h-[500px]">
            {renderMarkdown(content)}

            {/* In-Article Bottom Navigation (Previous & Next Document) */}
            <div className="mt-12 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prevDoc ? (
                <button
                  type="button"
                  onClick={() => onSelectDoc && onSelectDoc(prevDoc.id)}
                  className="p-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group"
                >
                  <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 group-hover:text-indigo-400">
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>{t('docReaderPrevDocHeader')}</span>
                  </span>
                  <div className="font-bold text-xs sm:text-sm text-white mt-1.5 group-hover:text-indigo-300 line-clamp-1">
                    {prevDoc.title}
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 mt-1 block">
                    {prevDoc.id} • {getCategoryLabel(prevDoc.category)}
                  </span>
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800/60 text-slate-600 text-xs flex items-center">
                  <span>{t('docReaderFirstDoc')}</span>
                </div>
              )}

              {nextDoc ? (
                <button
                  type="button"
                  onClick={() => onSelectDoc && onSelectDoc(nextDoc.id)}
                  className="p-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-right transition-all group"
                >
                  <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-end gap-1 group-hover:text-indigo-400">
                    <span>{t('docReaderNextDocHeader')}</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <div className="font-bold text-xs sm:text-sm text-white mt-1.5 group-hover:text-indigo-300 line-clamp-1">
                    {nextDoc.title}
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 mt-1 block">
                    {nextDoc.id} • {getCategoryLabel(nextDoc.category)}
                  </span>
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800/60 text-slate-600 text-xs flex items-center justify-end">
                  <span>{t('docReaderLastDoc')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Table of Contents Sticky Aside (3 cols) */}
          <div className="xl:col-span-3 sticky top-4 space-y-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-800">
                <Bookmark className="w-4 h-4 text-indigo-400" />
                <span>{t('docReaderToc')}</span>
              </div>

              {tableOfContents.length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t('docReaderTocEmpty')}</p>
              ) : (
                <nav className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                  {tableOfContents.map((h, idx) => (
                    <a
                      key={idx}
                      href={`#${h.id}`}
                      className={`block py-1 text-xs transition-colors truncate ${
                        h.level === 1
                          ? 'font-bold text-slate-200 hover:text-indigo-400 pl-0'
                          : h.level === 2
                          ? 'text-slate-400 hover:text-slate-200 pl-3'
                          : 'text-slate-500 hover:text-slate-300 pl-6 text-[11px]'
                      }`}
                      title={h.text}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              )}
            </div>

            {/* Quick Actions Helper */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block">{t('docReaderQuickActions')}</span>
              <button
                onClick={copyMarkdownContent}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 flex items-center justify-between transition-colors"
              >
                <span>{t('docReaderCopyAllMd')}</span>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {onBackToList && (
                <button
                  onClick={onBackToList}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-850 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 flex items-center justify-between transition-colors"
                >
                  <span>{t('docReaderSwitchToFiles')}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Linked Requirements */}
      {activeTab === 'requirements' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">{t('docReaderReqsTracedTitle')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('docReaderReqsTracedDesc', { id: doc.id })}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('requirements')}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              {t('docReaderViewMatrix')}
            </Button>
          </div>

          {linkedRequirements.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              {t('docReaderNoLinkedReqs')}
            </div>
          ) : (
            <div className="space-y-3">
              {linkedRequirements.map(req => (
                <div key={req.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{req.id}</span>
                      <span className="font-semibold text-xs text-white">{req.title}</span>
                    </div>
                    <Badge variant={req.status === 'Approved' ? 'success' : 'warning'}>
                      {req.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {req.description}
                  </p>

                  {req.acceptanceCriteria && req.acceptanceCriteria.length > 0 && (
                    <div className="pt-2 border-t border-slate-850 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400">{t('docReaderAcLabel')}</span>
                      {req.acceptanceCriteria.map(ac => (
                        <div key={ac.id} className="flex items-center gap-2 text-xs text-slate-300">
                          {ac.completed ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span>{ac.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Version History */}
      {activeTab === 'versions' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">{t('docReaderVersionsTitle')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('docReaderVersionsDesc')}</p>
          </div>

          <div className="space-y-3">
            {doc.versions?.map((ver, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded">
                      {ver.version}
                    </span>
                    {getStatusBadge(ver.status)}
                    <span className="text-xs text-slate-400">{ver.updatedAt}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{ver.author}</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {ver.changeSummary}
                </p>

                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>{t('docReaderFileSize')}: {ver.fileSize}</span>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{ver.checksum}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
