import { Router } from 'express';
import { AssignmentController } from '../controllers/assignment.controller';
import {
  validateUuidParam,
  validate,
} from '../middleware/validation';
import {
  requireAuth,
  requireAgent,
  authorize,
} from '../middleware/auth';
import Joi from 'joi';

const router = Router();

/**
 * Assignment validation schemas
 */
const assignmentSchemas = {
  assign: Joi.object({
    assigneeId: Joi.string().uuid().required(),
    reason: Joi.string().max(500).optional(),
  }),

  reassign: Joi.object({
    assigneeId: Joi.string().uuid().required(),
    reason: Joi.string().max(500).optional(),
  }),

  unassign: Joi.object({
    reason: Joi.string().max(500).optional(),
  }),

  bulkAssign: Joi.object({
    ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
    assigneeId: Joi.string().uuid().required(),
    reason: Joi.string().max(500).optional(),
  }),
};

/**
 * Assignment routes
 */

// Get available assignees (agents and admins only)
router.get('/assignees', requireAgent, AssignmentController.getAvailableAssignees);

// Get assignee workloads (agents and admins only)
router.get('/workloads', requireAgent, AssignmentController.getAssigneeWorkloads);

// Get assignment statistics (agents and admins only)
router.get('/statistics', requireAgent, AssignmentController.getAssignmentStatistics);

// Get current user's assigned tickets
router.get('/my-tickets', requireAuth, AssignmentController.getMyAssignedTickets);

// Get specific user's assigned tickets (agents and admins only)
router.get(
  '/user/:userId/tickets',
  requireAgent,
  validateUuidParam,
  AssignmentController.getUserAssignedTickets
);

// Get assignment recommendations for a ticket (agents and admins only)
router.get(
  '/tickets/:id/recommendations',
  requireAgent,
  validateUuidParam,
  AssignmentController.getAssignmentRecommendations
);

// Assign ticket to user (agents and admins only)
router.post(
  '/tickets/:id/assign',
  requireAgent,
  validateUuidParam,
  validate({ body: assignmentSchemas.assign }),
  AssignmentController.assignTicket
);

// Unassign ticket (agents and admins only)
router.post(
  '/tickets/:id/unassign',
  requireAgent,
  validateUuidParam,
  validate({ body: assignmentSchemas.unassign }),
  AssignmentController.unassignTicket
);

// Reassign ticket to different user (agents and admins only)
router.post(
  '/tickets/:id/reassign',
  requireAgent,
  validateUuidParam,
  validate({ body: assignmentSchemas.reassign }),
  AssignmentController.reassignTicket
);

// Auto-assign ticket based on workload (agents and admins only)
router.post(
  '/tickets/:id/auto-assign',
  requireAgent,
  validateUuidParam,
  AssignmentController.autoAssignTicket
);

// Bulk assign multiple tickets (agents and admins only)
router.post(
  '/bulk-assign',
  requireAgent,
  validate({ body: assignmentSchemas.bulkAssign }),
  AssignmentController.bulkAssignTickets
);

export { router as assignmentRoutes };