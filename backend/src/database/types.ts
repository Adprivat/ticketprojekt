import { Prisma, User } from '@prisma/client';

// Extended Prisma types with relations
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    createdTickets: true;
    assignedTickets: true;
    comments: true;
  };
}>;

export type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    creator: true;
    assignee: true;
    comments: {
      include: {
        author: true;
      };
    };
  };
}>;

export type CommentWithRelations = Prisma.CommentGetPayload<{
  include: {
    author: true;
    ticket: true;
  };
}>;

// Simplified types for API responses (without sensitive data)
export type PublicUser = Omit<User, 'password'>;

export type TicketWithDetails = Omit<TicketWithRelations, 'creator' | 'assignee'> & {
  creator: PublicUser;
  assignee: PublicUser | null;
  comments: (Omit<CommentWithRelations, 'author'> & {
    author: PublicUser;
  })[];
};

// Database query options
export interface FindManyOptions<T> {
  where?: T;
  orderBy?: any;
  skip?: number;
  take?: number;
  include?: any;
  select?: any;
}

// Common where clauses
export const CommonWhereClause = {
  activeUser: { isActive: true },
  openTickets: { status: 'OPEN' as const },
  inProgressTickets: { status: 'IN_PROGRESS' as const },
  closedTickets: { status: 'CLOSED' as const },
} as const;

// Pagination helpers
export interface PaginationOptions {
  page: number;
  limit: number;
}

export const calculatePagination = (page: number, limit: number) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const createPaginationResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});