import React, { useState } from 'react';
import { Modal, Button } from '../../common/components';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { FolderPlus, AlertCircle, Check } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const { createProject, currentUser, projects } = useApp();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [version, setVersion] = useState('v1.0.0');
  const [author, setAuthor] = useState(currentUser || 'Alex Nguyen (Lead Architect)');
  const [membersCount, setMembersCount] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanKey = key.trim().toUpperCase();

    if (!cleanName) {
      setError(t('projectNameRequired'));
      return;
    }
    if (!cleanKey) {
      setError(t('projectKeyRequired'));
      return;
    }
    if (!/^[A-Z0-9_-]{2,10}$/.test(cleanKey)) {
      setError(t('projectKeyFormat'));
      return;
    }
    if (projects.some(p => p.key === cleanKey)) {
      setError(t('projectKeyExists', { key: cleanKey }));
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createProject({
        name: cleanName,
        key: cleanKey,
        version: version.trim() || 'v1.0.0',
        author: author.trim() || currentUser,
        membersCount: Number(membersCount) || 1,
        description: description.trim()
      });

      // Reset form
      setName('');
      setKey('');
      setDescription('');
      setVersion('v1.0.0');
      onCreated?.(created.id);
      onClose();
    } catch (err: any) {
      setError(err.message || t('projectCreateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold text-white">{t('projectCreateNew')}</span>
            <p className="text-xs text-slate-400 mt-0.5">{t('projectCreateDesc')}</p>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>{t('projectName')} <span className="text-red-400">*</span></span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              // Auto suggest Key if not filled
              if (!key) {
                const words = e.target.value.split(/\s+/).filter(Boolean);
                if (words.length >= 2) {
                  setKey(words.map(w => w[0]).join('').slice(0, 5).toUpperCase());
                }
              }
            }}
            placeholder={t('projectNamePlaceholder')}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t('projectKey')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="VD: DOCQA, FCB, OMS"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs font-mono text-indigo-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400">{t('projectKeyDesc')}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t('projectVersion')}
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.0.0"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t('projectAuthor')}
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Alex Nguyen (Lead Architect)"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t('projectMembers')}
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={membersCount}
              onChange={(e) => setMembersCount(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            {t('projectDesc')}
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('projectDescPlaceholder')}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('actionCancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={isSubmitting ? undefined : <Check className="w-4 h-4" />}
          >
            {isSubmitting ? t('projectCreateSubmitting') : t('actionCreate')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
