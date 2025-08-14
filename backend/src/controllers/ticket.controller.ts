import { Request, Response } from 'express';
import { TicketService } from '@/services/ticket.service';
import { asyncHandler } from '@/middleware/errorHandler';
import { TicketStatus, Priority } from '@prisma/client';

/**
 * Ticket controller
 */
export class TicketController {
  /**
   * Create a new ticket
   */
  static createTicket = asyncHandler(async (req: Request, res: Response) => {
    const { title, description, priority } = req.body;
    const createdBy = req.user!.id;

    const ticket = await TicketService.createTicket({
      title,
      description,
      priority: priority as Priority,
      createdBy,
    });

    res.status(201).json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get all tickets with filters and pagination
   */
  static getTickets = asyncHandler(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      priority,
      assignedTo,
      createdBy,
  search,
  q,
    } = req.query;

    const filters = {
      status: status as TicketStatus,
      priority: priority as Priority,
      assignedTo: assignedTo as string,
      createdBy: createdBy as string,
      // prefer `search` param, fallback to `q`
      search: (search || q) as string,
    };

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await TicketService.getTickets(
      filters,
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
   * Get ticket by ID
   */
  static getTicketById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const ticket = await TicketService.getTicketById(
      id,
      req.user?.id,
      req.user?.role
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Update ticket
   */
  static updateTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const ticket = await TicketService.updateTicket(id, updateData, userId, userRole);

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Delete ticket
   */
  static deleteTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    await TicketService.deleteTicket(id, userId, userRole);

    res.json({
      success: true,
      data: {
        message: 'Ticket deleted successfully',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets assigned to current user
   */
  static getMyAssignedTickets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const {
      page = 1,
      limit = 10,
      status,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await TicketService.getAssignedTickets(
      userId,
      pagination,
      status as TicketStatus
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets created by current user
   */
  static getMyCreatedTickets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const {
      page = 1,
      limit = 10,
      status,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await TicketService.getCreatedTickets(
      userId,
      pagination,
      status as TicketStatus
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets assigned to specific user (admin/agent only)
   */
  static getUserAssignedTickets = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await TicketService.getAssignedTickets(
      userId,
      pagination,
      status as TicketStatus
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get tickets created by specific user (admin/agent only)
   */
  static getUserCreatedTickets = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await TicketService.getCreatedTickets(
      userId,
      pagination,
      status as TicketStatus
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get ticket statistics (admin/agent only)
   */
  static getTicketStatistics = asyncHandler(async (req: Request, res: Response) => {
    const statistics = await TicketService.getTicketStatistics();

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get stale tickets (admin/agent only)
   */
  static getStaleTickets = asyncHandler(async (req: Request, res: Response) => {
    const { days = 7 } = req.query;
    const daysOld = parseInt(days as string);

    const staleTickets = await TicketService.getStaleTickets(daysOld);

    res.json({
      success: true,
      data: staleTickets,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Assign ticket to user
   */
  static assignTicket = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const ticket = await TicketService.updateTicket(
      id,
      { assignedTo },
      userId,
      userRole
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
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const ticket = await TicketService.updateTicket(
      id,
      { assignedTo: null },
      userId,
      userRole
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Update ticket status
   */
  static updateTicketStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const ticket = await TicketService.updateTicket(
      id,
      { status: status as TicketStatus },
      userId,
      userRole
    );

    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  });
}