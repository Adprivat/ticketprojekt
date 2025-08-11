import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CommentSection } from '../CommentSection';
import { CommentsApi } from '../../../services/comments';

describe('CommentSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders comments in chronological order', async () => {
    vi.spyOn(CommentsApi, 'list').mockResolvedValue([
      { id: '2', content: 'second', ticketId: 't1', authorId: 'u1', createdAt: '2024-01-02T10:00:00Z', updatedAt: '2024-01-02T10:00:00Z' } as any,
      { id: '1', content: 'first', ticketId: 't1', authorId: 'u2', createdAt: '2024-01-01T10:00:00Z', updatedAt: '2024-01-01T10:00:00Z' } as any,
    ]);

    render(<CommentSection ticketId="t1" />);

  const nodes = await screen.findAllByText(/first|second/);
  expect(nodes[0]).toHaveTextContent('first');
  expect(nodes[1]).toHaveTextContent('second');
  });
});
