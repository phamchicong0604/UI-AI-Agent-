import React, { useState, useMemo } from 'react';
import { DocumentItem, StatusLifecycle } from '../../types';
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
  Bookmark,
  Share2,
  ExternalLink,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  ListOrdered,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { Badge, Button } from '../../common/components';
import { formatHashCode } from '../../common/utils/hash';

interface DocumentReaderViewProps {
  document: DocumentItem;
  onBackToList?: () => void;
  onEdit?: (doc: DocumentItem) => void;
  onDelete?: (id: string) => void;
}

export const DocumentReaderView: React.FC<DocumentReaderViewProps> = ({
  document: doc,
  onBackToList,
  onEdit,
  onDelete
}) => {
  const { activeProject, canApprove, updateDocumentStatus, requirements, setActiveTab } = useApp();
  const { t, language } = useI18n();

  const [activeTab, setActiveReaderTab] = useState<'content' | 'requirements' | 'versions'>('content');
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  // Fallback rich markdown content if none stored
  const content = useMemo(() => {
    if (doc.contentMarkdown && doc.contentMarkdown.trim().length > 0) {
      return doc.contentMarkdown;
    }
    // Generate professional structured markdown specification
    return `# ${doc.title}

> **Dự án**: ${activeProject.name} (${activeProject.key})  
> **Mã tài liệu**: \`${doc.id}\` | **Phiên bản**: \`${doc.currentVersion}\` | **Trạng thái**: ${doc.status}  
> **Người biên soạn**: ${doc.author} | **Cập nhật lần cuối**: ${doc.updatedAt}

---

## 1. Tóm tắt Mục tiêu & Bối cảnh (Executive Summary)
${doc.description || 'Tài liệu này đóng vai trò là văn bản đặc tả chuẩn cho hệ thống, quy định các tiêu chuẩn kỹ thuật, quy tắc nghiệp vụ và tiêu chí chất lượng cho dự án.'}

Hệ thống yêu cầu mọi thành viên tham gia (BA, DEV, QA, PM) tuân thủ nghiêm ngặt các quy định được phê duyệt trong văn bản này. Mọi thay đổi đối với tài liệu đều phải trải qua quy trình đánh giá tác động và đóng dấu xác thực toàn vẹn bằng hàm băm mật mã học **SHA-256**.

## 2. Phạm vi & Đối tượng Áp dụng (Scope & Target Roles)
Tài liệu được phân loại thuộc danh mục chuẩn: **${doc.category}**.

| Vai trò | Trách nhiệm áp dụng | Yêu cầu truy vết |
| :--- | :--- | :--- |
| **Product Manager (PM)** | Giám sát phạm vi và các mốc bàn giao | Ký duyệt Baseline văn bản |
| **Business Analyst (BA)** | Phân rã quy tắc nghiệp vụ và Acceptance Criteria | Ánh xạ trực tiếp vào module Requirements |
| **Software Engineer (DEV)** | Triển khai mã nguồn theo đúng đặc tả kỹ thuật | Tuân thủ hợp đồng giao diện và API |
| **Quality Assurance (QA)** | Thiết kế ca kiểm thử bao phủ toàn bộ điều kiện nghiệm thu | Bắt buộc đính kèm bằng chứng EVD khi có sai khác |

## 3. Đặc tả Yêu cầu & Quy tắc Nghiệp vụ (Core Specifications)
### 3.1. Quy tắc Toàn vẹn & Phê duyệt
- **Quy tắc BR-AUTH-01**: Tài liệu chỉ trở thành căn cứ pháp lý chính thức khi chuyển sang trạng thái \`Approved\`.
- **Quy tắc BR-AUTH-02**: Không được phép tạo mã tự động hoặc nghiệm thu sản phẩm dựa trên các bản thảo (\`Draft\` hoặc \`In Review\`).
- **Quy tắc BR-SEC-01**: Tất cả các tệp đính kèm và nội dung văn bản đều được ký số băm SHA-256 bất biến.

### 3.2. Tiêu chuẩn Bàn giao Kỹ thuật
- Mã nguồn và tài liệu phải luôn được đồng bộ trong cùng một chu kỳ phát hành (Sprint / Milestone).
- Báo cáo kiểm thử phải đạt tỷ lệ bao phủ ma trận truy vết tối thiểu **95%** trước khi đưa ra quyết định Release Candidate.

## 4. Điều kiện Nghiệm thu (Acceptance Criteria)
- [x] **AC-01**: Xác thực danh tính người dùng và kiểm tra quyền hạn trước khi cho phép xem hoặc sửa đổi.
- [x] **AC-02**: Tự động tính toán mã băm SHA-256 ngay khi tài liệu được tải lên hoặc cập nhật phiên bản.
- [ ] **AC-03**: Hệ thống ghi vết kiểm toán chuỗi khối (Chained Audit Log) cho mọi hành động thay đổi trạng thái.
- [ ] **AC-04**: Hoàn tất ma trận liên kết giữa văn bản này và các ca kiểm thử tương ứng.

## 5. Phụ lục & Liên kết Tham chiếu (References)
- **Tài liệu liên quan**: Hệ thống quy tắc nghiệp vụ và hướng dẫn thu thập bằng chứng kiểm thử EVD.
- **Mã định danh lưu trữ**: \`${doc.id}-V${doc.currentVersion.replace('v', '')}\`
`;
  }, [doc, activeProject]);

  // Extract Table of Contents (Headings) from markdown
  const tableOfContents = useMemo(() => {
    const lines = content.split('\n');
    const headings: { id: string; text: string; level: number }[] = [];
    lines.forEach((line) => {
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
            {language === 'vi' ? 'Đã duyệt (Approved)' : 'Approved'}
          </Badge>
        );
      case 'In Review':
        return (
          <Badge variant="warning" icon={<Clock className="w-3.5 h-3.5" />}>
            {language === 'vi' ? 'Chờ xem xét (In Review)' : 'In Review'}
          </Badge>
        );
      case 'Draft':
        return (
          <Badge variant="neutral">
            {language === 'vi' ? 'Bản nháp (Draft)' : 'Draft'}
          </Badge>
        );
      case 'Deprecated':
        return (
          <Badge variant="danger" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            {language === 'vi' ? 'Ngưng dùng (Deprecated)' : 'Deprecated'}
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
            className="text-base font-bold text-indigo-300 pt-5 pb-1 border-b border-slate-800/60 mt-3 tracking-tight flex items-center gap-2"
          >
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
            className="text-sm font-semibold text-slate-200 pt-3 pb-0.5 mt-1"
          >
            {headingText}
          </h3>
        );
        return;
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={idx}
            className="my-3 pl-4 py-2 border-l-4 border-indigo-500 bg-indigo-500/10 rounded-r-xl text-xs text-indigo-200 leading-relaxed"
          >
            {trimmed.replace(/^>\s+/, '')}
          </blockquote>
        );
        return;
      }

      // Horizontal rule
      if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={idx} className="my-5 border-slate-800" />);
        return;
      }

      // Task Checkboxes (- [x] or - [ ])
      if (/^[-*]\s+\[[ xX]\]/.test(trimmed)) {
        const isChecked = /^[-*]\s+\[[xX]\]/.test(trimmed);
        const itemText = trimmed.replace(/^[-*]\s+\[[ xX]\]\s+/, '');
        elements.push(
          <div key={idx} className="flex items-start gap-2.5 my-1.5 text-xs text-slate-300">
            {isChecked ? (
              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            )}
            <span className={isChecked ? 'text-slate-200 font-medium' : 'text-slate-400'}>
              {itemText}
            </span>
          </div>
        );
        return;
      }

      // Unordered list
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={idx} className="ml-5 list-disc text-xs text-slate-300 my-1 leading-relaxed">
            {trimmed.replace(/^[-*]\s+/, '')}
          </li>
        );
        return;
      }

      // Numbered list
      if (/^\d+\.\s+/.test(trimmed)) {
        elements.push(
          <li key={idx} className="ml-5 list-decimal text-xs text-slate-300 my-1 leading-relaxed">
            {trimmed.replace(/^\d+\.\s+/, '')}
          </li>
        );
        return;
      }

      // Empty line
      if (trimmed === '') {
        elements.push(<div key={idx} className="h-2" />);
        return;
      }

      // Regular Paragraph
      elements.push(
        <p key={idx} className="text-xs text-slate-300 leading-relaxed my-1.5">
          {line}
        </p>
      );
    });

    if (inTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  return (
    <div className="space-y-4">
      {/* 1. Reader Navigation Top Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Breadcrumbs & Document Identity */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="flex items-center gap-1 text-slate-300 hover:text-indigo-400 transition-colors font-medium mr-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại</span>
              </button>
            )}
            <span className="font-semibold text-slate-200">{activeProject.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-indigo-300">{doc.category}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono text-indigo-400 font-bold">{doc.id}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <h1 className="text-lg font-bold text-white tracking-tight">{doc.title}</h1>
            {getStatusBadge(doc.status)}
            <span className="font-mono text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              {doc.currentVersion}
            </span>
          </div>
        </div>

        {/* Right: Actions Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Approve Button if role can approve */}
          {canApprove() && doc.status !== 'Approved' && (
            <Button
              variant="success"
              size="sm"
              onClick={() => updateDocumentStatus(doc.id, 'Approved')}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              {language === 'vi' ? 'Phê duyệt tài liệu' : 'Approve'}
            </Button>
          )}

          {/* Copy Markdown */}
          <Button
            variant="secondary"
            size="sm"
            onClick={copyMarkdownContent}
            icon={copiedContent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copiedContent ? 'Đã chép!' : 'Chép MD'}
          </Button>

          {/* Edit */}
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(doc)}
              icon={<Edit3 className="w-3.5 h-3.5 text-slate-300" />}
            >
              Sửa
            </Button>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="p-2 rounded-xl bg-slate-850 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
              title="Xóa tài liệu"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Metadata Strip & Checksum Bar */}
      <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Tác giả: <strong>{doc.author}</strong></span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Cập nhật: {doc.updatedAt}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5 text-indigo-300">
            <Link2 className="w-3.5 h-3.5" />
            <span>{linkedRequirements.length} Yêu cầu liên kết</span>
          </span>
        </div>

        {/* Checksum Button */}
        {checksum && (
          <button
            type="button"
            onClick={copyChecksum}
            title={`SHA-256 Checksum: ${checksum}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono hover:border-emerald-500/50 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>SHA-256: {formatHashCode(checksum)}</span>
            {copiedHash ? <Check className="w-3 h-3 text-emerald-400 ml-1" /> : <Copy className="w-3 h-3 text-slate-400 ml-1" />}
          </button>
        )}
      </div>

      {/* 3. Tab Switcher (Content / Linked Requirements / Version History) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveReaderTab('content')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'content'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Nội dung tài liệu</span>
        </button>

        <button
          onClick={() => setActiveReaderTab('requirements')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'requirements'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Yêu cầu liên kết ({linkedRequirements.length})</span>
        </button>

        <button
          onClick={() => setActiveReaderTab('versions')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'versions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Lịch sử phiên bản ({doc.versions?.length || 1})</span>
        </button>
      </div>

      {/* 4. Tab Body */}
      {activeTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Reading Canvas (9 cols) */}
          <div className="lg:col-span-9 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-1">
            {renderMarkdown(content)}
          </div>

          {/* Right Outline / Table of Contents (3 cols) */}
          <div className="lg:col-span-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 sticky top-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mục lục tài liệu</span>
            </div>

            {tableOfContents.length === 0 ? (
              <p className="text-xs text-slate-500">Tài liệu không có phân mục con.</p>
            ) : (
              <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
                {tableOfContents.map((h, idx) => (
                  <a
                    key={idx}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(h.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`block text-xs text-slate-400 hover:text-indigo-300 transition-colors py-1 truncate ${
                      h.level === 1 ? 'font-bold text-slate-200' : h.level === 2 ? 'pl-3 font-medium' : 'pl-6 text-[11px]'
                    }`}
                  >
                    {h.text}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Linked Requirements */}
      {activeTab === 'requirements' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Yêu cầu được phân tách từ {doc.id}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Các yêu cầu nghiệp vụ và kỹ thuật có trích dẫn trực tiếp từ văn bản này.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('requirements')}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Mở module Yêu cầu
            </Button>
          </div>

          {linkedRequirements.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs space-y-2">
              <p>Chưa có yêu cầu nào được liên kết với tài liệu này.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('requirements')}
              >
                + Tạo Yêu cầu liên kết mới
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedRequirements.map(req => (
                <div key={req.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-500/30">
                        {req.id}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{req.title}</h4>
                    </div>
                    <Badge variant={req.status === 'Approved' ? 'success' : 'warning'}>
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300">{req.description}</p>
                  {req.acceptanceCriteria && req.acceptanceCriteria.length > 0 && (
                    <div className="pt-2 border-t border-slate-850 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400">Điều kiện nghiệm thu (AC):</span>
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
            <h3 className="text-sm font-bold text-white">Lịch sử Phiên bản & Chữ ký Checksum</h3>
            <p className="text-xs text-slate-400 mt-0.5">Mọi thay đổi nội dung được băm SHA-256 để đảm bảo tính bất biến và tuân thủ kiểm toán.</p>
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
                  <span>Dung lượng: {ver.fileSize}</span>
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
