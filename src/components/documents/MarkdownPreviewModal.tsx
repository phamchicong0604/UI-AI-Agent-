import React, { useState } from 'react';
import { Modal, Button, Badge } from '../../common/components';
import { DocumentItem } from '../../types';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  FileText,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { formatHashCode } from '../../common/utils/hash';

interface MarkdownPreviewModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MarkdownPreviewModal: React.FC<MarkdownPreviewModalProps> = ({
  document,
  isOpen,
  onClose
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!document) return null;

  const content = document.contentMarkdown || document.description || t('docNoContentFallback');
  const latestVersion = document.versions?.[0];
  const checksum = latestVersion?.checksum || '';

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const copyChecksum = async () => {
    try {
      await navigator.clipboard.writeText(checksum);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {}
  };

  // Simple and safe markdown line formatter
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-2 font-sans text-xs text-slate-200 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-base font-bold text-white pt-2 pb-1 border-b border-slate-750">
                {trimmed.replace(/^#\s+/, '')}
              </h1>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-sm font-bold text-indigo-300 pt-2 pb-0.5">
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-xs font-bold text-slate-100 pt-1">
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-slate-300">
                {trimmed.replace(/^[-*]\s+/, '')}
              </li>
            );
          }
          if (trimmed.startsWith('```')) {
            return (
              <div key={idx} className="font-mono text-[11px] text-amber-300/80 bg-slate-950 p-1.5 rounded border border-slate-800">
                {trimmed}
              </div>
            );
          }
          if (trimmed === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return <p key={idx} className="text-slate-300">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-indigo-400 font-semibold">{document.id}</span>
              <span className="text-base font-bold text-white">{document.title}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{document.category}</p>
          </div>
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Metadata bar */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-750 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{document.author}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{document.updatedAt}</span>
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {document.currentVersion}
            </span>
          </div>

          <Badge variant={document.status === 'Approved' ? 'success' : document.status === 'In Review' ? 'warning' : 'neutral'}>
            {document.status}
          </Badge>
        </div>

        {/* SHA-256 Checksum banner */}
        {checksum && (
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-semibold">{t('docChecksum')}:</span>
              <span className="font-mono text-[11px] text-emerald-300 truncate" title={checksum}>
                {checksum}
              </span>
            </div>
            <button
              type="button"
              onClick={copyChecksum}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-850 transition-colors shrink-0"
              title="Copy SHA-256"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Markdown Content Area */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 max-h-[50vh] overflow-y-auto">
          {renderFormattedMarkdown(content)}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={copyContent}
            icon={copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? t('docCopied') : t('docCopyMarkdown')}
          </Button>

          <Button type="button" variant="primary" onClick={onClose}>
            {t('actionClose')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
