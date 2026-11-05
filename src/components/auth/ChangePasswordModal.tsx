import React, { useState } from 'react';
import { Modal, Button } from '../../common/components';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { authApi } from '../../common/services/api';
import { Lock, AlertCircle, CheckCircle2, LogOut, ShieldAlert } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  isRequired = false
}) => {
  const { authUser, setAuthUser, logout, syncWithBackend } = useApp();
  const { t } = useI18n();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError(t('loginPasswordRequired'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('changePasswordTooShort'));
      return;
    }

    if (newPassword === currentPassword) {
      setError(t('changePasswordSame'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePasswordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(t('changePasswordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Update authUser state to clear mustChangePassword
      if (authUser) {
        setAuthUser({
          ...authUser,
          mustChangePassword: false
        });
      }

      setTimeout(() => {
        onClose();
        syncWithBackend().catch(() => {});
      }, 900);
    } catch (err: any) {
      setError(err?.message || t('changePasswordError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isRequired ? () => {} : onClose}
      title={t('changePasswordModalTitle')}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isRequired && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">{t('changePasswordRequiredNotice')}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t('changePasswordCurrent')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('changePasswordCurrentPlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t('changePasswordNew')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('changePasswordNewPlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t('changePasswordConfirm')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('changePasswordConfirmPlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {isRequired ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              icon={<LogOut className="w-3.5 h-3.5 text-rose-400" />}
              className="text-rose-400 hover:text-rose-300"
            >
              {t('headerLogout')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
          )}

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isSubmitting ? t('changePasswordSubmitting') : t('changePasswordSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
