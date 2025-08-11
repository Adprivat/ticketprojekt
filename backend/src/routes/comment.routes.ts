import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import {
  validateCommentCreate,
  validateCommentUpdate,
  validateUuidParam,
  validatePagination,
  validate,
  validateTicketIdParam,
} from '../middleware/validation';
import {
  requireAuth,
  requireAgent,
  requireCommentAccess,
} from '../middleware/auth';
import Joi from 'joi';

const router = Router();

/**
 * Comment validation schemas
 */
const commentSchemas = {
  bulkDelete: Joi.object({
    commentIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
  }),

  search: Joi.object({
    q: Joi.string().min(1).max(255).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),
};

/**
 * Comment routes
 */

// Get recent comments (agents and admins only)
router.get('/recent', requireAgent, CommentController.getRecentComments);

// Get comment statistics (agents and admins only)
router.get('/statistics', requireAgent, CommentController.getCommentStatistics);

// Search comments (agents and admins only)
router.get(
  '/search',
  requireAgent,
  validate({ query: commentSchemas.search }),
  CommentController.searchComments
);

// Get current user's comments
router.get('/my-comments', requireAuth, validatePagination, CommentController.getMyComments);

// Get comments by specific author (agents and admins only)
router.get(
  '/author/:authorId',
  requireAgent,
  validateUuidParam,
  validatePagination,
  CommentController.getCommentsByAuthor
);

// Bulk delete comments (admins only)
router.delete(
  '/bulk-delete',
  requireAuth, // Will be restricted to admins in the service
  validate({ body: commentSchemas.bulkDelete }),
  CommentController.bulkDeleteComments
);

// Get all comments for a ticket
router.get(
  '/ticket/:ticketId',
  requireAuth,
  validateTicketIdParam,
  validatePagination,
  CommentController.getTicketComments
);

// Create comment for a ticket
router.post(
  '/ticket/:ticketId',
  requireAuth,
  validateTicketIdParam,
  validateCommentCreate,
  CommentController.createComment
);

// Get comment count for a ticket
router.get(
  '/ticket/:ticketId/count',
  requireAuth,
  validateTicketIdParam,
  CommentController.getTicketCommentCount
);

// Get comment by ID (with access control)
router.get('/:id', requireCommentAccess, validateUuidParam, CommentController.getCommentById);

// Update comment (with access control)
router.put(
  '/:id',
  requireCommentAccess,
  validateCommentUpdate,
  CommentController.updateComment
);

// Delete comment (with access control)
router.delete('/:id', requireCommentAccess, validateUuidParam, CommentController.deleteComment);

// Check if user can edit comment
router.get('/:id/can-edit', requireAuth, validateUuidParam, CommentController.canEditComment);

export { router as commentRoutes };