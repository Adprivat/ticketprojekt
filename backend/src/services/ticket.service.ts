import { Ticket, TicketStatus, Priority } from '@prisma/client';
import { ticketRepository, userRepository } from '../database/repositories';
import { TicketFilters } from '../database/repositories/ticket.repository';
import { PaginationOptions, TicketWithRelations } from '../database/types';
import { 
  NotFoundError, 
  BadRequestError,
  ForbiddenError,
  createNotFoundError,
  createAuthorizationError 
} from '../middleware/errorHandler';
import { logBusinessEvent } from '../middleware/logging';
import { NotificationService } from './notification.service';

/**
 * Ticket creation data
 */
export interface CreateTicketData {
  title: string;
  description: string;
  priority: Priority;
  createdBy: string;
}

/**
 * Ticket update data
 */
export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: Priority;
  assignedTo?: string | null;
}

/**
 * Ticket service for business logic
 */
export class TicketService {
  /**
   * Create a new ticket
   */
  static async createTicket(ticketData: CreateTicketData): Promise<TicketWithRelations> {
    const { title, description, priority, createdBy } = ticketData;

    try {
      // Verify creator exists and is active
      const creator = await userRepository.findById(createdBy);
      if (!creator || !creator.isActive) {
        throw createNotFoundError('Creator user', createdBy);
      }

      // Create ticket
      const ticket = await ticketRepository.create({
        title,
        description,
        priority,
        status: 'OPEN', // Default status
        creator: { connect: { id: createdBy } },
      });

      logBusinessEvent('TICKET_CREATED', {
        ticketId: ticket.id,
        createdBy,
        title,
        priority,
      });

      // Return ticket with relations
      const ticketWithRelations = await ticketRepository.findByIdWithRelations(ticket.id);
      if (!ticketWithRelations) {
        throw new Error('Failed to retrieve created ticket');
      }

      // Send notifications for ticket creation
      await NotificationService.notifyTicketCreated(ticketWithRelations as any, creator);

      return ticketWithRelations;

    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logBusinessEvent('TICKET_CREATION_ERROR', {
        createdBy,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to create ticket');
    }
  }

  /**
   * Get ticket by ID
   */
  static async getTicketById(ticketId: string, userId?: string, userRole?: string): Promise<TicketWithRelations> {
    try {
      const ticket = await ticketRepository.findByIdWithRelations(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Check access permissions if user context is provided
      if (userId && userRole) {
        const hasAccess = this.checkTicketAccess(ticket as any, userId, userRole);
        if (!hasAccess) {
          throw createAuthorizationError('Access denied to this ticket');
        }
      }

      return ticket;

    } catch (error: unknown) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new BadRequestError('Failed to retrieve ticket');
    }
  }

  /**
   * Get tickets with filters and pagination
   */
  static async getTickets(
    filters: TicketFilters,
    pagination: PaginationOptions,
    userId?: string,
    userRole?: string
  ) {
    try {
      // Apply user-specific filters based on role
      const adjustedFilters = this.applyUserFilters(filters, userId, userRole);

      const result = await ticketRepository.findWithFilters(
        adjustedFilters,
        pagination,
        {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        }
      );

      return result;

    } catch (error: unknown) {
      logBusinessEvent('TICKET_RETRIEVAL_ERROR', {
        userId,
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to retrieve tickets');
    }
  }

  /**
   * Update ticket
   */
  static async updateTicket(
    ticketId: string,
    updateData: UpdateTicketData,
    userId: string,
    userRole: string
  ): Promise<TicketWithRelations> {
    try {
      // Get existing ticket
      const existingTicket = await ticketRepository.findById(ticketId);
      if (!existingTicket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Check permissions
      const canUpdate = this.checkUpdatePermissions(existingTicket, userId, userRole, updateData);
      if (!canUpdate) {
        throw createAuthorizationError('Insufficient permissions to update this ticket');
      }

      // Validate assignee if provided
      if (updateData.assignedTo !== undefined) {
        if (updateData.assignedTo && updateData.assignedTo !== null) {
          const assignee = await userRepository.findById(updateData.assignedTo);
          if (!assignee || !assignee.isActive) {
            throw createNotFoundError('Assignee user', updateData.assignedTo);
          }
          // Only agents and admins can be assigned tickets
          if (assignee.role === 'USER') {
            throw new BadRequestError('Only agents and admins can be assigned tickets');
          }
        }
      }

      // Store previous assignee for notifications
      const previousAssignee = existingTicket.assignedTo ? 
        await userRepository.findById(existingTicket.assignedTo) : undefined;

      // Update ticket
      const updatedTicket = await ticketRepository.update(ticketId, updateData);

      logBusinessEvent('TICKET_UPDATED', {
        ticketId,
        updatedBy: userId,
        changes: updateData,
      });

      // Return updated ticket with relations
      const ticketWithRelations = await ticketRepository.findByIdWithRelations(ticketId);
      if (!ticketWithRelations) {
        throw new Error('Failed to retrieve updated ticket');
      }

      // Get user who made the update
      const updatedByUser = await userRepository.findById(userId);
      if (!updatedByUser) {
        throw new Error('Failed to retrieve user who updated ticket');
      }

      // Send notifications based on what was updated
      if (updateData.assignedTo !== undefined) {
        await NotificationService.notifyTicketAssigned(
          ticketWithRelations as any, 
          updatedByUser, 
          (previousAssignee ?? undefined)
        );
      }

      if (updateData.status !== undefined && updateData.status !== existingTicket.status) {
        await NotificationService.notifyTicketStatusChanged(
          ticketWithRelations as any,
          updatedByUser,
          existingTicket.status,
          updateData.status
        );
      }

      return ticketWithRelations;

    } catch (error: unknown) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError || error instanceof BadRequestError) {
        throw error;
      }
      logBusinessEvent('TICKET_UPDATE_ERROR', {
        ticketId,
        updatedBy: userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to update ticket');
    }
  }

  /**
   * Delete ticket
   */
  static async deleteTicket(ticketId: string, userId: string, userRole: string): Promise<void> {
    try {
      // Get existing ticket
      const existingTicket = await ticketRepository.findById(ticketId);
      if (!existingTicket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Check permissions - only admins or ticket creators can delete
      const canDelete = userRole === 'ADMIN' || existingTicket.createdBy === userId;
      if (!canDelete) {
        throw createAuthorizationError('Only admins or ticket creators can delete tickets');
      }

      // Delete ticket (comments will be cascade deleted)
      await ticketRepository.delete(ticketId);

      logBusinessEvent('TICKET_DELETED', {
        ticketId,
        deletedBy: userId,
        originalCreator: existingTicket.createdBy,
      });

    } catch (error: unknown) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('TICKET_DELETION_ERROR', {
        ticketId,
        deletedBy: userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to delete ticket');
    }
  }

  /**
   * Get tickets assigned to user
   */
  static async getAssignedTickets(
    userId: string,
    pagination: PaginationOptions,
    status?: TicketStatus
  ) {
    try {
      return await ticketRepository.findAssignedToUser(userId, pagination, status);
    } catch (error: unknown) {
      logBusinessEvent('ASSIGNED_TICKETS_RETRIEVAL_ERROR', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to retrieve assigned tickets');
    }
  }

  /**
   * Get tickets created by user
   */
  static async getCreatedTickets(
    userId: string,
    pagination: PaginationOptions,
    status?: TicketStatus
  ) {
    try {
      return await ticketRepository.findCreatedByUser(userId, pagination, status);
    } catch (error: unknown) {
      logBusinessEvent('CREATED_TICKETS_RETRIEVAL_ERROR', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to retrieve created tickets');
    }
  }

  /**
   * Get ticket statistics
   */
  static async getTicketStatistics() {
    try {
      return await ticketRepository.getStatistics();
    } catch (error: unknown) {
      logBusinessEvent('TICKET_STATISTICS_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to retrieve ticket statistics');
    }
  }

  /**
   * Get stale tickets (old open tickets)
   */
  static async getStaleTickets(daysOld: number = 7) {
    try {
      return await ticketRepository.findStaleTickets(daysOld);
    } catch (error: unknown) {
      logBusinessEvent('STALE_TICKETS_RETRIEVAL_ERROR', {
        daysOld,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError('Failed to retrieve stale tickets');
    }
  }

  /**
   * Check if user has access to ticket
   */
  private static checkTicketAccess(ticket: Ticket, userId: string, userRole: string): boolean {
    // Admins and agents can access all tickets
    if (userRole === 'ADMIN' || userRole === 'AGENT') {
      return true;
    }

    // Users can access tickets they created or are assigned to
    return ticket.createdBy === userId || ticket.assignedTo === userId;
  }

  /**
   * Check update permissions
   */
  private static checkUpdatePermissions(
    ticket: Ticket,
    userId: string,
    userRole: string,
    updateData: UpdateTicketData
  ): boolean {
    // Admins can update anything
    if (userRole === 'ADMIN') {
      return true;
    }

    // Agents can update most fields
    if (userRole === 'AGENT') {
      return true;
    }

    // Users can only update their own tickets and limited fields
    if (ticket.createdBy === userId) {
      // Users can only update title, description, and priority
      const allowedFields = ['title', 'description', 'priority'];
      const updateFields = Object.keys(updateData);
      return updateFields.every(field => allowedFields.includes(field));
    }

    return false;
  }

  /**
   * Apply user-specific filters based on role
   */
  private static applyUserFilters(
    filters: TicketFilters,
    userId?: string,
    userRole?: string
  ) {
    // If no user context, return filters as-is
    if (!userId || !userRole) {
      return filters;
    }

    // Admins and agents can see all tickets
    if (userRole === 'ADMIN' || userRole === 'AGENT') {
      return filters;
    }

    // Users can only see tickets they created or are assigned to
    // This is handled at the database level by adding OR conditions
    return {
      ...filters,
      // Add user-specific filter (this would need to be implemented in the repository)
    };
  }
}