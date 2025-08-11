import { Request, Response } from 'express';
import { StatusService } from '@/services/status.service';
import { asyncHandler } from '@/middleware/errorHandler';
import { TicketStatus } from '@prisma/client';

/**
 * Status controller for ticket status management
 */
export class StatusController {
  /**
   * Change ticket status
   */
  static changeTicketStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticketId } = req.params;
    const { status, reason, comment } = req.body;
    const changedBy = req.user!.id;

    const ticket = await StatusService.changeTicketStatus(
      ticketId,
      status as TicketStatus,
      changedBy,
      reason,
      comment
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get valid status transitions for a ticket
   */
  static getValidTransitions = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    const userRole = req.user!.role;

    if (!status) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_STATUS',
          message: 'Current status is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const validTransitions = StatusService.getValidTransitions(
      status as TicketStatus,
      userRole
    );

    res.json({
      success: true,
      data: {
        currentStatus: status,
        validTransitions,
        userRole,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get status transition requirements
   */
  static getTransitionRequirements = asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both from and to status parameters are required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const requirements = StatusService.getTransitionRequirements(
      from as TicketStatus,
      to as TicketStatus
    );

    if (!requirements) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Invalid status transition from ${from} to ${to}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: requirements,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Bulk change status for multiple tickets
   */
  static bulkChangeStatus = asyncHandler(async (req: Request, res: Response) => {
    const { ticketIds, status, reason } = req.body;
    const changedBy = req.user!.id;

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

    if (!status) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_STATUS',
          message: 'Status is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await StatusService.bulkChangeStatus(
      ticketIds,
      status as TicketStatus,
      changedBy,
      reason
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get status statistics
   */
  static getStatusStatistics = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await StatusService.getStatusStatistics();

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets by status
   */
  static getTicketsByStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.id;

    const tickets = await StatusService.getTicketsByStatus(
      status as TicketStatus,
      parseInt(page as string),
      parseInt(limit as string),
      userRole,
      userId
    );

    res.json({
      success: true,
      data: tickets,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Auto-close stale tickets
   */
  static autoCloseStaleTickets = asyncHandler(async (req: Request, res: Response) => {
    const { days = 30, reason = 'Auto-closed due to inactivity' } = req.body;
    const closedBy = req.user!.id;

    const result = await StatusService.autoCloseStaleTickets(
      parseInt(days as string),
      closedBy,
      reason
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get status workflow information
   */
  static getStatusWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const workflow = StatusService.getStatusWorkflow();

    res.json({
      success: true,
      data: workflow,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets requiring attention
   */
  static getTicketsRequiringAttention = asyncHandler(async (req: Request, res: Response) => {
    const tickets = await StatusService.getTicketsRequiringAttention();

    res.json({
      success: true,
      data: tickets,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Check if user can change status
   */
  static canChangeStatus = asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query;
    const userRole = req.user!.role;

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both from and to status parameters are required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const canChange = StatusService.canUserChangeStatus(
      userRole,
      from as TicketStatus,
      to as TicketStatus
    );

    res.json({
      success: true,
      data: {
        canChange,
        userRole,
        from,
        to,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get open tickets count
   */
  static getOpenTicketsCount = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await StatusService.getStatusStatistics();

    res.json({
      success: true,
      data: {
        count: statistics.open,
        percentage: statistics.statusDistribution.OPEN.percentage,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get in-progress tickets count
   */
  static getInProgressTicketsCount = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await StatusService.getStatusStatistics();

    res.json({
      success: true,
      data: {
        count: statistics.inProgress,
        percentage: statistics.statusDistribution.IN_PROGRESS.percentage,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get closed tickets count
   */
  static getClosedTicketsCount = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await StatusService.getStatusStatistics();

    res.json({
      success: true,
      data: {
        count: statistics.closed,
        percentage: statistics.statusDistribution.CLOSED.percentage,
      },
      timestamp: new Date().toISOString(),
    });
  });
}