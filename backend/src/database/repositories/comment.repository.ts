import { Prisma, Comment } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { CommentWithRelations, PaginationOptions } from '@/database/types';

export class CommentRepository extends BaseRepository<
  Comment,
  Prisma.CommentCreateInput,
  Prisma.CommentUpdateInput,
  Prisma.CommentWhereInput
> {
  protected modelName = 'comment';

  protected getModel() {
    return this.prisma.comment;
  }

  // Get comment with relations
  async findByIdWithRelations(id: string): Promise<CommentWithRelations | null> {
    return await this.prisma.comment.findUnique({
      where: { id },
      include: {
        author: true,
        ticket: true,
      },
    });
  }

  // Get all comments for a ticket
  async findByTicketId(ticketId: string): Promise<CommentWithRelations[]> {
    return await this.prisma.comment.findMany({
      where: { ticketId },
      include: {
        author: true,
        ticket: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Get comments for a ticket with pagination
  async findByTicketIdPaginated(
    ticketId: string,
    pagination: PaginationOptions
  ) {
    return await this.findManyPaginated(
      {
        where: { ticketId },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      pagination
    );
  }

  // Get comments by author
  async findByAuthorId(
    authorId: string,
    pagination: PaginationOptions
  ) {
    return await this.findManyPaginated(
      {
        where: { authorId },
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      pagination
    );
  }

  // Create comment for ticket
  async createForTicket(
    ticketId: string,
    authorId: string,
    content: string
  ): Promise<CommentWithRelations> {
    const comment = await this.create({
      content,
      ticket: { connect: { id: ticketId } },
      author: { connect: { id: authorId } },
    });

    // Return comment with relations
    return (await this.findByIdWithRelations(comment.id)) as CommentWithRelations;
  }

  // Update comment content
  async updateContent(id: string, content: string): Promise<CommentWithRelations> {
    await this.update(id, {
      content,
      updatedAt: new Date(),
    });

    return (await this.findByIdWithRelations(id)) as CommentWithRelations;
  }

  // Check if user can edit comment (author or admin)
  async canUserEditComment(commentId: string, userId: string, userRole: string): Promise<boolean> {
    const comment = await this.findById(commentId);
    if (!comment) return false;

    // Author can always edit their own comments
    if (comment.authorId === userId) return true;

    // Admins can edit any comment
    if (userRole === 'ADMIN') return true;

    return false;
  }

  // Get recent comments for dashboard
  async findRecentComments(limit: number = 10) {
    return await this.findMany({
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        ticket: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get comment count for a ticket
  async countByTicketId(ticketId: string): Promise<number> {
    return await this.count({ ticketId } as any);
  }

  // Delete all comments for a ticket (used when ticket is deleted)
  async deleteByTicketId(ticketId: string): Promise<void> {
    await this.prisma.comment.deleteMany({
      where: { ticketId },
    });
  }

  // Search comments by content
  async searchComments(
    searchTerm: string,
    pagination: PaginationOptions
  ) {
    return await this.findManyPaginated(
      {
        where: {
          content: {
            contains: searchTerm,
          },
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      pagination
    );
  }
}