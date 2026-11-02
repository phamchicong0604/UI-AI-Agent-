import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../common/components/Button';
import { Badge } from '../common/components/Badge';

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
