import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import {
  validateTicketCreate,
  validateTicketUpdate,
  validateTicketAssign,
  validateTicketStatus,
  validateUuidParam,
  validatePagination,
  validateSearch,
} from '../middleware/validation';
import {
  requireAuth,
  requireAgent,
  requireTicketAccess,
  authorize,
} from '../middleware/auth';

const router = Router();

/**
 * Ticket routes
 */

// Create ticket (authenticated users)
router.post('/', requireAuth, validateTicketCreate, TicketController.createTicket);

// Get all tickets with filters (authenticated users)
router.get('/', requireAuth, validateSearch, TicketController.getTickets);

// Get ticket statistics (agents and admins only)
router.get('/statistics', requireAgent, TicketController.getTicketStatistics);

// Get stale tickets (agents and admins only)
router.get('/stale', requireAgent, TicketController.getStaleTickets);

// Get current user's assigned tickets
router.get('/assigned/me', requireAuth, validatePagination, TicketController.getMyAssignedTickets);

// Get current user's created tickets
router.get('/created/me', requireAuth, validatePagination, TicketController.getMyCreatedTickets);

// Get specific user's assigned tickets (agents and admins only)
router.get(
  '/assigned/:userId',
  requireAgent,
  validateUuidParam,
  validatePagination,
  TicketController.getUserAssignedTickets
);

// Get specific user's created tickets (agents and admins only)
router.get(
  '/created/:userId',
  requireAgent,
  validateUuidParam,
  validatePagination,
  TicketController.getUserCreatedTickets
);

// Get ticket by ID (with access control)
router.get('/:id', requireTicketAccess, validateUuidParam, TicketController.getTicketById);

// Update ticket (with access control)
router.put(
  '/:id',
  requireTicketAccess,
  validateTicketUpdate,
  TicketController.updateTicket
);

// Delete ticket (with access control)
router.delete('/:id', requireTicketAccess, validateUuidParam, TicketController.deleteTicket);

// Assign ticket (agents and admins only)
router.post(
  '/:id/assign',
  requireAgent,
  validateTicketAssign,
  TicketController.assignTicket
);

// Unassign ticket (agents and admins only)
router.post('/:id/unassign', requireAgent, validateUuidParam, TicketController.unassignTicket);

// Update ticket status (agents and admins only)
router.patch(
  '/:id/status',
  requireAgent,
  validateTicketStatus,
  TicketController.updateTicketStatus
);

export { router as ticketRoutes };