import React, { useState, useRef } from 'react';
import { Modal, Button } from '../../common/components';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { documentsApi } from '../../common/services/api';
import { DocumentCategory } from '../../types';
import {
  UploadCloud,
  FileText,
  Archive,
  FileCode,
  X,
  AlertCircle,
  CheckCircle2,
  FolderDot
} from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { activeProject, reloadDocuments, currentUser } = useApp();
  const { t } = useI18n();

  const [files, setFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('AUTO');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories: { key: DocumentCategory; label: string }[] = [
    { key: '01_Project_Overview', label: '01 Project Overview' },
    { key: '02_Business_Requirements', label: '02 Business Requirements' },
    { key: '03_System_Requirements', label: '03 System Requirements' },
    { key: '04_UI_UX', label: '04 UI & UX Specs' },
    { key: '05_Technical_Documents', label: '05 Technical Docs & API' },
    { key: '06_QA', label: '06 QA & Test Strategy' },
    { key: '07_EVD_Evidence', label: '07 EVD / Evidence Guides' },
    { key: '08_Change_History', label: '08 Change History & Logs' }
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
  };

  const appendFiles = (newFiles: File[]) => {
    const validExtensions = ['.md', '.zip', '.txt', '.json', '.html', '.yaml', '.yml', '.docx', '.pdf'];
    const filtered = newFiles.filter(f => {
      const name = f.name.toLowerCase();
      return validExtensions.some(ext => name.endsWith(ext));
    });

    if (filtered.length < newFiles.length) {
      setError(t('uploadInvalidFiles', { exts: validExtensions.join(', ') }));
    } else {
      setError(null);
    }

    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const deduplicated = filtered.filter(f => !existingNames.has(f.name));
      return [...prev, ...deduplicated];
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.zip')) {
      return <Archive className="w-4 h-4 text-amber-400" />;
    }
    if (lower.endsWith('.md')) {
      return <FileCode className="w-4 h-4 text-sky-400" />;
    }
    return <FileText className="w-4 h-4 text-indigo-400" />;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError(t('uploadSelectFile'));
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('projectId', activeProject.id);
      formData.append('category', selectedCategory);
      formData.append('author', currentUser || 'Alex Nguyen');

      files.forEach(file => {
        formData.append('files', file);
      });

      const res = await documentsApi.upload(formData);
      await reloadDocuments(activeProject.id);

      setSuccessMessage(t('uploadSuccessCount', { count: res.totalUploaded }));
      setFiles([]);

      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || t('uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold text-white">{t('docUploadBatch')}</span>
            <p className="text-xs text-slate-400 mt-0.5">{t('docUploadSubtitle')}</p>
          </div>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Active Project Banner */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-750 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderDot className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('projectScope')}:</span>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{activeProject.name}</span>
                <span className="font-mono text-[10px] text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  {activeProject.key}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{activeProject.version}</span>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Category Choice */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>{t('uploadCategoryLabel')}</span>
            <span className="text-[10px] text-slate-400">{t('uploadZipAutoNotice')}</span>
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="AUTO">✨ {t('docCategoryAuto')}</option>
            {categories.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
              : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.zip,.txt,.json,.html,.yaml,.yml,.docx,.pdf"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              {t('docDropzoneText')}
            </p>
            <p className="text-[11px] text-slate-400">
              {t('docSupportedFormats')}
            </p>
          </div>
        </div>

        {/* Staged files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>{t('docStagedFiles')} ({files.length})</span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
              >
                {t('uploadClearAll')}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {getFileIcon(file.name)}
                    <span className="font-medium truncate">{file.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                      {formatSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isUploading}>
            {t('actionCancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            icon={isUploading ? undefined : <UploadCloud className="w-4 h-4" />}
          >
            {isUploading ? t('docUploading') : `${t('docStartUpload')} (${files.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
