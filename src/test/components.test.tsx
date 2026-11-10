import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../common/components/Button';
import { Badge } from '../common/components/Badge';
import { ClassificationBadges } from '../components/documents/ClassificationBadges';
import { vi as viLocale } from '../locales/vi';

describe('Common UI Components (Button & Badge)', () => {
  it('should render Button with text and respond to click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Lưu thay đổi</Button>);

    const btn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should disable Button when disabled prop is passed', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Không thể nhấp</Button>);

    const btn = screen.getByRole('button', { name: /Không thể nhấp/i });
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render Badge with correct variant classes', () => {
    const { rerender } = render(<Badge variant="success">Pass</Badge>);
    expect(screen.getByText('Pass')).toHaveClass('text-emerald-400');

    rerender(<Badge variant="danger">Fail</Badge>);
    expect(screen.getByText('Fail')).toHaveClass('text-rose-300');

    rerender(<Badge variant="info">In Review</Badge>);
    expect(screen.getByText('In Review')).toHaveClass('text-indigo-300');

    rerender(<Badge variant="cyan">Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('text-cyan-300');
  });
});

describe('ClassificationBadges (M0-T3)', () => {
  // useI18n falls back to the Vietnamese dictionary outside an I18nProvider
  const needsConfirmation = viLocale.classificationNeedsConfirmation;

  it('shows the "needs confirmation" badge for an Ambiguous document', () => {
    render(
      <ClassificationBadges
        doc={{
          category: '01_Project_Overview',
          needsHumanReview: true,
          secondaryCategories: [],
          classification: {
            suggestedCategory: '01_Project_Overview',
            score: 0.1,
            isAmbiguous: true,
            versionNo: 'v1.0',
            classifiedAt: '2026-11-10T00:00:00.000Z'
          }
        }}
      />
    );

    expect(screen.getByText(needsConfirmation)).toHaveClass('text-amber-300');
  });

  it('shows secondary category tags and the suggestion, but no ambiguous badge, for a confident document', () => {
    render(
      <ClassificationBadges
        showSuggestion
        doc={{
          category: '04_UI_UX',
          needsHumanReview: false,
          secondaryCategories: ['02_Business_Requirements'],
          classification: {
            suggestedCategory: '06_QA',
            score: 0.9,
            isAmbiguous: false,
            versionNo: 'v1.0',
            classifiedAt: '2026-11-10T00:00:00.000Z'
          }
        }}
      />
    );

    expect(screen.queryByText(needsConfirmation)).not.toBeInTheDocument();
    expect(
      screen.getByText(viLocale.classificationSecondaryTag.replace('{category}', viLocale.cat02_short))
    ).toBeInTheDocument();
    expect(
      screen.getByText(viLocale.classificationSuggested.replace('{category}', viLocale.cat06_short))
    ).toBeInTheDocument();
  });

  it('renders nothing when the document has no classification data', () => {
    const { container } = render(<ClassificationBadges doc={{ category: '06_QA' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
