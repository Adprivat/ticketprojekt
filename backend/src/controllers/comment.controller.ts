import { Request, Response } from 'express';
import { CommentService } from '@/services/comment.service';
import { asyncHandler } from '@/middleware/errorHandler';

/**
 * Comment controller
 */
export class CommentController {
  /**
   * Create a new comment for a ticket
   */
  static createComment = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const { content } = req.body;
    const authorId = req.user!.id;

    const comment = await CommentService.createComment({
      content,
      ticketId,
      authorId,
    });

    res.status(201).json({
      success: true,
      data: comment,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get all comments for a ticket
   */
  static getTicketComments = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const {
      page = 1,
      limit = 20,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await CommentService.getTicketComments(
      ticketId,
      pagination,
      req.user?.id,
      req.user?.role
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get comment by ID
   */
  static getCommentById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const comment = await CommentService.getCommentById(
      id,
      req.user?.id,
      req.user?.role
    );

    res.json({
      success: true,
      data: comment,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Update comment
   */
  static updateComment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const comment = await CommentService.updateComment(
      id,
      { content },
      userId,
      userRole
    );

    res.json({
      success: true,
      data: comment,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Delete comment
   */
  static deleteComment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    await CommentService.deleteComment(id, userId, userRole);

    res.json({
      success: true,
      data: {
        message: 'Comment deleted successfully',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get comments by author
   */
  static getCommentsByAuthor = asyncHandler(async (req: Request, res: Response) => {
    const { authorId } = req.params;
    const {
      page = 1,
      limit = 10,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await CommentService.getCommentsByAuthor(
      authorId,
      pagination,
      req.user?.id,
      req.user?.role
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get current user's comments
   */
  static getMyComments = asyncHandler(async (req: Request, res: Response) => {
    const authorId = req.user!.id;
    const {
      page = 1,
      limit = 10,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await CommentService.getCommentsByAuthor(
      authorId,
      pagination,
      req.user?.id,
      req.user?.role
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Search comments
   */
  static searchComments = asyncHandler(async (req: Request, res: Response) => {
    const { q: searchTerm } = req.query;
    const {
      page = 1,
      limit = 10,
    } = req.query;

    if (!searchTerm) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SEARCH_TERM',
          message: 'Search term is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await CommentService.searchComments(
      searchTerm as string,
      pagination,
      req.user?.id,
      req.user?.role
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get recent comments
   */
  static getRecentComments = asyncHandler(async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;

    const comments = await CommentService.getRecentComments(
      parseInt(limit as string),
      req.user?.role
    );

    res.json({
      success: true,
      data: comments,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get comment statistics
   */
  static getCommentStatistics = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await CommentService.getCommentStatistics();

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get comment count for a ticket
   */
  static getTicketCommentCount = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;

    const count = await CommentService.getTicketCommentCount(ticketId);

    res.json({
      success: true,
      data: {
        ticketId,
        commentCount: count,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Bulk delete comments
   */
  static bulkDeleteComments = asyncHandler(async (req: Request, res: Response) => {
    const { commentIds } = req.body;
    const deletedBy = req.user!.id;
    const userRole = req.user!.role;

    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'commentIds must be a non-empty array',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await CommentService.bulkDeleteComments(
      commentIds,
      deletedBy,
      userRole
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Check if user can edit comment
   */
  static canEditComment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const canEdit = await CommentService.canUserEditComment(id, userId, userRole);

    res.json({
      success: true,
      data: {
        commentId: id,
        canEdit,
        userId,
        userRole,
      },
      timestamp: new Date().toISOString(),
    });
  });
}