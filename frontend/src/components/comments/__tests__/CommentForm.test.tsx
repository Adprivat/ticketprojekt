import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CommentForm } from '../CommentForm';

describe('CommentForm', () => {
  it('validates required content', async () => {
    const onSubmit = vi.fn();
    render(<CommentForm onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole('button', { name: /add comment/i }));
  // Matches the schema message from CommentForm
  expect(await screen.findByText(/comment cannot be empty/i)).toBeInTheDocument();
  });
});
