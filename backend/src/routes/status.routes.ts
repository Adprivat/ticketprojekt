import { Router } from 'express';
import { StatusController } from '../controllers/status.controller';
import {
  validateUuidParam,
  validate,
} from '../middleware/validation';
import {
  requireAuth,
  requireAgent,
} from '../middleware/auth';
import Joi from 'joi';

const router = Router();

/**
 * Status validation schemas
 */
const statusSchemas = {
  changeStatus: Joi.object({
    status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'CLOSED').required(),
    reason: Joi.string().max(500).optional(),
    comment: Joi.string().max(2000).optional(),
  }),

  bulkChangeStatus: Joi.object({
    ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
    status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'CLOSED').required(),
    reason: Joi.string().max(500).optional(),
  }),

  autoCloseStale: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30),
    reason: Joi.string().max(500).default('Auto-closed due to inactivity'),
  }),

  statusQuery: Joi.object({
    status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'CLOSED').required(),
  }),

  transitionQuery: Joi.object({
    from: Joi.string().valid('OPEN', 'IN_PROGRESS', 'CLOSED').required(),
    to: Joi.string().valid('OPEN', 'IN_PROGRESS', 'CLOSED').required(),
  }),
};

/**
 * Status routes
 */

// Get status workflow information (authenticated users)
router.get('/workflow', requireAuth, StatusController.getStatusWorkflow);

// Get status statistics (agents and admins only)
router.get('/statistics', requireAgent, StatusController.getStatusStatistics);

// Get tickets requiring attention (agents and admins only)
router.get('/attention', requireAgent, StatusController.getTicketsRequiringAttention);

// Get valid transitions for current status (authenticated users)
router.get(
  '/transitions',
  requireAuth,
  validate({ query: statusSchemas.statusQuery }),
  StatusController.getValidTransitions
);

// Get transition requirements (authenticated users)
router.get(
  '/transition-requirements',
  requireAuth,
  validate({ query: statusSchemas.transitionQuery }),
  StatusController.getTransitionRequirements
);

// Check if user can change status (authenticated users)
router.get(
  '/can-change',
  requireAuth,
  validate({ query: statusSchemas.transitionQuery }),
  StatusController.canChangeStatus
);

// Get tickets by status (authenticated users)
router.get(
  '/:status/tickets',
  requireAuth,
  StatusController.getTicketsByStatus
);

// Get open tickets count (authenticated users)
router.get('/open/count', requireAuth, StatusController.getOpenTicketsCount);

// Get in-progress tickets count (authenticated users)
router.get('/in-progress/count', requireAuth, StatusController.getInProgressTicketsCount);

// Get closed tickets count (authenticated users)
router.get('/closed/count', requireAuth, StatusController.getClosedTicketsCount);

// Change ticket status (agents and admins only)
router.patch(
  '/tickets/:id',
  requireAgent,
  validateUuidParam,
  validate({ body: statusSchemas.changeStatus }),
  StatusController.changeTicketStatus
);

// Bulk change status for multiple tickets (agents and admins only)
router.patch(
  '/bulk-change',
  requireAgent,
  validate({ body: statusSchemas.bulkChangeStatus }),
  StatusController.bulkChangeStatus
);

// Auto-close stale tickets (admins only)
router.post(
  '/auto-close-stale',
  requireAuth, // Could be restricted to admins only
  validate({ body: statusSchemas.autoCloseStale }),
  StatusController.autoCloseStaleTickets
);

export { router as statusRoutes };