import React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Badge } from '../../common/components';
import { DocumentCategory, DocumentItem } from '../../types';
import { useI18n } from '../../common/i18n/I18nContext';
import type { TranslationKey } from '../../common/i18n/I18nContext';

export const CATEGORY_SHORT_LABEL_KEYS: Record<DocumentCategory, TranslationKey> = {
  '01_Project_Overview': 'cat01_short',
  '02_Business_Requirements': 'cat02_short',
  '03_System_Requirements': 'cat03_short',
  '04_UI_UX': 'cat04_short',
  '05_Technical_Documents': 'cat05_short',
  '06_QA': 'cat06_short',
  '07_EVD_Evidence': 'cat07_short',
  '08_Change_History': 'cat08_short'
};

interface ClassificationBadgesProps {
  doc: Pick<DocumentItem, 'category' | 'classification' | 'secondaryCategories' | 'needsHumanReview'>;
  /** Also show the scorer's suggested category when it differs from the current one (Review Queue) */
  showSuggestion?: boolean;
}

/**
 * Classification result of the upload pipeline (M0-T3): "needs confirmation" badge for Ambiguous documents,
 * secondary category tags, and optionally the suggested category.
 */
export const ClassificationBadges: React.FC<ClassificationBadgesProps> = ({ doc, showSuggestion = false }) => {
  const { t } = useI18n();
  const label = (category: DocumentCategory) =>
    CATEGORY_SHORT_LABEL_KEYS[category] ? t(CATEGORY_SHORT_LABEL_KEYS[category]) : category;

  const secondary = (doc.secondaryCategories || []).filter(c => c !== doc.category);
  const suggested = doc.classification?.suggestedCategory;
  const hasSuggestion = showSuggestion && !!suggested && suggested !== doc.category;

  if (!doc.needsHumanReview && secondary.length === 0 && !hasSuggestion) return null;

  return (
    <>
      {doc.needsHumanReview && (
        <Badge variant="warning" icon={<AlertTriangle className="w-3 h-3" />}>
          {t('classificationNeedsConfirmation')}
        </Badge>
      )}
      {secondary.map(category => (
        <Badge key={category} variant="purple">
          {t('classificationSecondaryTag', { category: label(category) })}
        </Badge>
      ))}
      {hasSuggestion && (
        <Badge variant="info" icon={<Sparkles className="w-3 h-3" />}>
          {t('classificationSuggested', { category: label(suggested!) })}
        </Badge>
      )}
    </>
  );
};
