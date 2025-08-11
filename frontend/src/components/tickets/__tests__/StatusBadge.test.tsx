import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders label', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText(/IN PROGRESS/i)).toBeInTheDocument();
  });
});
