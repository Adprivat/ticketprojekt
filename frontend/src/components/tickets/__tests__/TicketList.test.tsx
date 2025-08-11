import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TicketList } from '../TicketList';

const rows = [
  { id: '1', title: 'A', description: 'd', status: 'OPEN', priority: 'LOW', createdBy: 'u1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

describe('TicketList', () => {
  it('renders rows', () => {
    render(
      <TicketList
        rows={rows as any}
        rowCount={1}
        page={1}
        pageSize={10}
        loading={false}
        onPaginationChange={() => {}}
        onRowClick={() => {}}
      />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
