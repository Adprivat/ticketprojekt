import { Request, Response } from 'express';
import { AssignmentService } from '@/services/assignment.service';
import { asyncHandler } from '@/middleware/errorHandler';

/**
 * Assignment controller for ticket assignment operations
 */
export class AssignmentController {
  /**
   * Assign ticket to user
   */
  static assignTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticketId } = req.params;
    const { assigneeId, reason } = req.body;
    const assignedBy = req.user!.id;

    const ticket = await AssignmentService.assignTicket(
      ticketId,
      assigneeId,
      assignedBy,
      reason
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Unassign ticket
   */
  static unassignTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticketId } = req.params;
    const { reason } = req.body;
    const unassignedBy = req.user!.id;

    const ticket = await AssignmentService.unassignTicket(
      ticketId,
      unassignedBy,
      reason
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Reassign ticket to different user
   */
  static reassignTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticketId } = req.params;
    const { assigneeId, reason } = req.body;
    const reassignedBy = req.user!.id;

    const ticket = await AssignmentService.reassignTicket(
      ticketId,
      assigneeId,
      reassignedBy,
      reason
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Auto-assign ticket based on workload
   */
  static autoAssignTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticketId } = req.params;
    const assignedBy = req.user!.id;

    const ticket = await AssignmentService.autoAssignTicket(ticketId, assignedBy);

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get available assignees
   */
  static getAvailableAssignees = asyncHandler(async (req: Request, res: Response) => {
    const assignees = await AssignmentService.getAvailableAssignees();

    res.json({
      success: true,
      data: assignees.map(assignee => ({
        id: assignee.id,
        email: assignee.email,
        firstName: assignee.firstName,
        lastName: assignee.lastName,
        role: assignee.role,
        isActive: assignee.isActive,
      })),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get assignee workloads
   */
  static getAssigneeWorkloads = asyncHandler(async (req: Request, res: Response) => {
    const workloads = await AssignmentService.getAssigneeWorkloads();

    res.json({
      success: true,
      data: workloads,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get assignment recommendations for a ticket
   */
  static getAssignmentRecommendations = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticketId } = req.params;

    const recommendations = await AssignmentService.getAssignmentRecommendations(ticketId);

    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Bulk assign tickets
   */
  static bulkAssignTickets = asyncHandler(async (req: Request, res: Response) => {
    const { ticketIds, assigneeId, reason } = req.body;
    const assignedBy = req.user!.id;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'ticketIds must be a non-empty array',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!assigneeId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ASSIGNEE',
          message: 'assigneeId is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await AssignmentService.bulkAssignTickets(
      ticketIds,
      assigneeId,
      assignedBy,
      reason
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get assignment statistics
   */
  static getAssignmentStatistics = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await AssignmentService.getAssignmentStatistics();

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets assigned to specific user
   */
  static getUserAssignedTickets = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { status } = req.query;

    const tickets = await AssignmentService.getUserAssignedTickets(
      userId,
      status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
    );

    res.json({
      success: true,
      data: tickets,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get current user's assigned tickets
   */
  static getMyAssignedTickets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status } = req.query;

    const tickets = await AssignmentService.getUserAssignedTickets(
      userId,
      status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
    );

    res.json({
      success: true,
      data: tickets,
      timestamp: new Date().toISOString(),
    });
  });
}