import React, { useState } from 'react';
import { Modal, Button } from '../../common/components';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { LogIn, Lock, User, Briefcase, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, projects, activeProject } = useApp();
  const { t } = useI18n();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(activeProject?.id || 'PRJ-01');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError(t('loginUsernameRequired'));
      return;
    }
    if (!password) {
      setError(t('loginPasswordRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password, selectedProjectId);
      onClose();
      setPassword('');
    } catch (err: any) {
      setError(err?.message || t('loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('loginModalTitle')} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t('loginUsername')}
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('loginUsernamePlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t('loginPassword')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('loginPasswordPlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t('loginProjectWorkspace')}
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key || p.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-700/60">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting} icon={<LogIn className="w-4 h-4" />}>
            {isSubmitting ? t('loginSubmitting') : t('loginSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
