import { Comment } from '@prisma/client';
import { commentRepository, ticketRepository, userRepository } from '@/database/repositories';
import { CommentWithRelations, PaginationOptions } from '@/database/types';
import { 
  NotFoundError, 
  BadRequestError,
  ForbiddenError,
  createNotFoundError,
  createAuthorizationError 
} from '@/middleware/errorHandler';
import { logBusinessEvent } from '@/middleware/logging';
import { NotificationService } from './notification.service';

/**
 * Comment creation data
 */
export interface CreateCommentData {
  content: string;
  ticketId: string;
  authorId: string;
}

/**
 * Comment update data
 */
export interface UpdateCommentData {
  content: string;
}

/**
 * Comment statistics
 */
export interface CommentStatistics {
  totalComments: number;
  commentsToday: number;
  commentsThisWeek: number;
  commentsThisMonth: number;
  averageCommentsPerTicket: number;
  topCommenters: {
    userId: string;
    userName: string;
    commentCount: number;
  }[];
}

/**
 * Comment service for business logic
 */
export class CommentService {
  /**
   * Create a new comment
   */
  static async createComment(commentData: CreateCommentData): Promise<CommentWithRelations> {
    const { content, ticketId, authorId } = commentData;

    try {
      // Verify ticket exists
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Verify author exists and is active
      const author = await userRepository.findById(authorId);
      if (!author || !author.isActive) {
        throw createNotFoundError('Author user', authorId);
      }

      // Check if user has access to the ticket
      const hasAccess = this.checkTicketAccess(ticket, authorId, author.role);
      if (!hasAccess) {
        throw createAuthorizationError('Access denied to this ticket');
      }

      // Validate content is not empty after trimming
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        throw new BadRequestError('Comment content cannot be empty');
      }

      // Create comment
      const comment = await commentRepository.createForTicket(ticketId, authorId, trimmedContent);

      logBusinessEvent('COMMENT_CREATED', {
        commentId: comment.id,
        ticketId,
        authorId,
        contentLength: trimmedContent.length,
      });

      // Get ticket with relations for notifications
      const ticketWithRelations = await ticketRepository.findByIdWithRelations(ticketId);
      if (ticketWithRelations) {
        await NotificationService.notifyCommentAdded(
          ticketWithRelations,
          comment,
          author
        );
      }

      return comment;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('COMMENT_CREATION_ERROR', {
        ticketId,
        authorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to create comment');
    }
  }

  /**
   * Get comment by ID
   */
  static async getCommentById(
    commentId: string, 
    userId?: string, 
    userRole?: string
  ): Promise<CommentWithRelations> {
    try {
      const comment = await commentRepository.findByIdWithRelations(commentId);
      if (!comment) {
        throw createNotFoundError('Comment', commentId);
      }

      // Check access permissions if user context is provided
      if (userId && userRole) {
        const hasAccess = this.checkCommentAccess(comment, userId, userRole);
        if (!hasAccess) {
          throw createAuthorizationError('Access denied to this comment');
        }
      }

      return comment;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new BadRequestError('Failed to retrieve comment');
    }
  }

  /**
   * Get comments for a ticket
   */
  static async getTicketComments(
    ticketId: string,
    pagination: PaginationOptions,
    userId?: string,
    userRole?: string
  ) {
    try {
      // Verify ticket exists and user has access
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      if (userId && userRole) {
        const hasAccess = this.checkTicketAccess(ticket, userId, userRole);
        if (!hasAccess) {
          throw createAuthorizationError('Access denied to this ticket');
        }
      }

      // Get comments with pagination
      const result = await commentRepository.findByTicketIdPaginated(ticketId, pagination);

      return result;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('TICKET_COMMENTS_RETRIEVAL_ERROR', {
        ticketId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to retrieve ticket comments');
    }
  }

  /**
   * Update comment
   */
  static async updateComment(
    commentId: string,
    updateData: UpdateCommentData,
    userId: string,
    userRole: string
  ): Promise<CommentWithRelations> {
    try {
      // Get existing comment
      const existingComment = await commentRepository.findByIdWithRelations(commentId);
      if (!existingComment) {
        throw createNotFoundError('Comment', commentId);
      }

      // Check permissions
      const canUpdate = this.checkUpdatePermissions(existingComment, userId, userRole);
      if (!canUpdate) {
        throw createAuthorizationError('Insufficient permissions to update this comment');
      }

      // Validate content
      const trimmedContent = updateData.content.trim();
      if (!trimmedContent) {
        throw new BadRequestError('Comment content cannot be empty');
      }

      // Update comment
      const updatedComment = await commentRepository.updateContent(commentId, trimmedContent);

      logBusinessEvent('COMMENT_UPDATED', {
        commentId,
        updatedBy: userId,
        ticketId: existingComment.ticketId,
        contentLength: trimmedContent.length,
      });

      return updatedComment;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError || error instanceof BadRequestError) {
        throw error;
      }
      logBusinessEvent('COMMENT_UPDATE_ERROR', {
        commentId,
        updatedBy: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to update comment');
    }
  }

  /**
   * Delete comment
   */
  static async deleteComment(commentId: string, userId: string, userRole: string): Promise<void> {
    try {
      // Get existing comment
      const existingComment = await commentRepository.findByIdWithRelations(commentId);
      if (!existingComment) {
        throw createNotFoundError('Comment', commentId);
      }

      // Check permissions - only admins or comment authors can delete
      const canDelete = userRole === 'ADMIN' || existingComment.authorId === userId;
      if (!canDelete) {
        throw createAuthorizationError('Only admins or comment authors can delete comments');
      }

      // Delete comment
      await commentRepository.delete(commentId);

      logBusinessEvent('COMMENT_DELETED', {
        commentId,
        deletedBy: userId,
        originalAuthor: existingComment.authorId,
        ticketId: existingComment.ticketId,
      });

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('COMMENT_DELETION_ERROR', {
        commentId,
        deletedBy: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to delete comment');
    }
  }

  /**
   * Get comments by author
   */
  static async getCommentsByAuthor(
    authorId: string,
    pagination: PaginationOptions,
    requestingUserId?: string,
    requestingUserRole?: string
  ) {
    try {
      // Check if requesting user can view these comments
      if (requestingUserId && requestingUserRole) {
        const canView = requestingUserRole === 'ADMIN' || 
                       requestingUserRole === 'AGENT' || 
                       requestingUserId === authorId;
        if (!canView) {
          throw createAuthorizationError('Access denied to view these comments');
        }
      }

      // Verify author exists
      const author = await userRepository.findById(authorId);
      if (!author) {
        throw createNotFoundError('Author user', authorId);
      }

      const result = await commentRepository.findByAuthorId(authorId, pagination);

      return result;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('AUTHOR_COMMENTS_RETRIEVAL_ERROR', {
        authorId,
        requestingUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to retrieve author comments');
    }
  }

  /**
   * Search comments
   */
  static async searchComments(
    searchTerm: string,
    pagination: PaginationOptions,
    userId?: string,
    userRole?: string
  ) {
    try {
      // Only agents and admins can search all comments
      if (userId && userRole && userRole === 'USER') {
        throw createAuthorizationError('Only agents and admins can search comments');
      }

      if (!searchTerm.trim()) {
        throw new BadRequestError('Search term cannot be empty');
      }

      const result = await commentRepository.searchComments(searchTerm.trim(), pagination);

      return result;

    } catch (error) {
      if (error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('COMMENT_SEARCH_ERROR', {
        searchTerm,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to search comments');
    }
  }

  /**
   * Get recent comments
   */
  static async getRecentComments(limit: number = 10, userRole?: string) {
    try {
      // Only agents and admins can view recent comments across all tickets
      if (userRole && userRole === 'USER') {
        throw createAuthorizationError('Only agents and admins can view recent comments');
      }

      const comments = await commentRepository.findRecentComments(limit);

      return comments;

    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('RECENT_COMMENTS_RETRIEVAL_ERROR', {
        limit,
        userRole,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to retrieve recent comments');
    }
  }

  /**
   * Get comment statistics
   */
  static async getCommentStatistics(): Promise<CommentStatistics> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalComments,
        totalTickets,
        commentsToday,
        commentsThisWeek,
        commentsThisMonth,
      ] = await Promise.all([
        commentRepository.count(),
        ticketRepository.count(),
        commentRepository.count({
          createdAt: { gte: today },
        }),
        commentRepository.count({
          createdAt: { gte: weekAgo },
        }),
        commentRepository.count({
          createdAt: { gte: monthAgo },
        }),
      ]);

      const averageCommentsPerTicket = totalTickets > 0 ? 
        Math.round((totalComments / totalTickets) * 100) / 100 : 0;

      // TODO: Implement top commenters query
      // This would require a more complex aggregation query
      const topCommenters: CommentStatistics['topCommenters'] = [];

      return {
        totalComments,
        commentsToday,
        commentsThisWeek,
        commentsThisMonth,
        averageCommentsPerTicket,
        topCommenters,
      };

    } catch (error) {
      logBusinessEvent('COMMENT_STATISTICS_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to retrieve comment statistics');
    }
  }

  /**
   * Bulk delete comments (admin only)
   */
  static async bulkDeleteComments(
    commentIds: string[],
    deletedBy: string,
    userRole: string
  ): Promise<{ successful: string[]; failed: { commentId: string; error: string }[] }> {
    // Only admins can bulk delete
    if (userRole !== 'ADMIN') {
      throw createAuthorizationError('Only admins can bulk delete comments');
    }

    const successful: string[] = [];
    const failed: { commentId: string; error: string }[] = [];

    for (const commentId of commentIds) {
      try {
        await this.deleteComment(commentId, deletedBy, userRole);
        successful.push(commentId);
      } catch (error) {
        failed.push({
          commentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logBusinessEvent('BULK_COMMENT_DELETION_COMPLETED', {
      totalComments: commentIds.length,
      successful: successful.length,
      failed: failed.length,
      deletedBy,
    });

    return { successful, failed };
  }

  /**
   * Check if user has access to ticket (for commenting)
   */
  private static checkTicketAccess(ticket: any, userId: string, userRole: string): boolean {
    // Admins and agents can access all tickets
    if (userRole === 'ADMIN' || userRole === 'AGENT') {
      return true;
    }

    // Users can access tickets they created or are assigned to
    return ticket.createdBy === userId || ticket.assignedTo === userId;
  }

  /**
   * Check if user has access to comment
   */
  private static checkCommentAccess(comment: CommentWithRelations, userId: string, userRole: string): boolean {
    // Admins can access all comments
    if (userRole === 'ADMIN') {
      return true;
    }

    // Check access to the ticket this comment belongs to
    if (comment.ticket) {
      return this.checkTicketAccess(comment.ticket, userId, userRole);
    }

    return false;
  }

  /**
   * Check update permissions for comment
   */
  private static checkUpdatePermissions(comment: CommentWithRelations, userId: string, userRole: string): boolean {
    // Admins can update any comment
    if (userRole === 'ADMIN') {
      return true;
    }

    // Authors can update their own comments
    if (comment.authorId === userId) {
      return true;
    }

    return false;
  }

  /**
   * Get comment count for a ticket
   */
  static async getTicketCommentCount(ticketId: string): Promise<number> {
    try {
      return await commentRepository.countByTicketId(ticketId);
    } catch (error) {
      logBusinessEvent('COMMENT_COUNT_ERROR', {
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to get comment count');
    }
  }

  /**
   * Check if user can edit comment
   */
  static async canUserEditComment(commentId: string, userId: string, userRole: string): Promise<boolean> {
    try {
      return await commentRepository.canUserEditComment(commentId, userId, userRole);
    } catch (error) {
      return false;
    }
  }
}