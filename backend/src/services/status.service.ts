import { TicketStatus, Ticket } from '@prisma/client';
import { ticketRepository, userRepository } from '@/database/repositories';
import { TicketWithRelations } from '@/database/types';
import { 
  NotFoundError, 
  BadRequestError,
  ForbiddenError,
  createNotFoundError,
  createAuthorizationError 
} from '@/middleware/errorHandler';
import { logBusinessEvent } from '@/middleware/logging';

/**
 * Status transition rules
 */
export interface StatusTransition {
  from: TicketStatus;
  to: TicketStatus;
  allowedRoles: string[];
  requiresAssignment?: boolean;
  requiresComment?: boolean;
  autoActions?: string[];
}

/**
 * Status change history entry
 */
export interface StatusChangeHistory {
  ticketId: string;
  previousStatus: TicketStatus;
  newStatus: TicketStatus;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  comment?: string;
}

/**
 * Status statistics
 */
export interface StatusStatistics {
  open: number;
  inProgress: number;
  closed: number;
  total: number;
  averageTimeToClose?: number;
  averageTimeToStart?: number;
  statusDistribution: {
    [key in TicketStatus]: {
      count: number;
      percentage: number;
    };
  };
}

/**
 * Status workflow configuration
 */
const STATUS_TRANSITIONS: StatusTransition[] = [
  // From OPEN
  {
    from: 'OPEN',
    to: 'IN_PROGRESS',
    allowedRoles: ['AGENT', 'ADMIN'],
    requiresAssignment: true,
    autoActions: ['notify_creator'],
  },
  {
    from: 'OPEN',
    to: 'CLOSED',
    allowedRoles: ['AGENT', 'ADMIN'],
    requiresComment: true,
    autoActions: ['notify_creator'],
  },

  // From IN_PROGRESS
  {
    from: 'IN_PROGRESS',
    to: 'OPEN',
    allowedRoles: ['AGENT', 'ADMIN'],
    requiresComment: true,
    autoActions: ['notify_creator'],
  },
  {
    from: 'IN_PROGRESS',
    to: 'CLOSED',
    allowedRoles: ['AGENT', 'ADMIN'],
    requiresComment: true,
    autoActions: ['notify_creator', 'notify_assignee'],
  },

  // From CLOSED
  {
    from: 'CLOSED',
    to: 'OPEN',
    allowedRoles: ['AGENT', 'ADMIN'],
    requiresComment: true,
    autoActions: ['notify_assignee'],
  },
  {
    from: 'CLOSED',
    to: 'IN_PROGRESS',
    allowedRoles: ['AGENT', 'ADMIN'],
    requiresAssignment: true,
    requiresComment: true,
    autoActions: ['notify_creator', 'notify_assignee'],
  },
];

/**
 * Status service for advanced ticket status management
 */
export class StatusService {
  /**
   * Change ticket status with validation and workflow enforcement
   */
  static async changeTicketStatus(
    ticketId: string,
    newStatus: TicketStatus,
    changedBy: string,
    reason?: string,
    comment?: string
  ): Promise<TicketWithRelations> {
    try {
      // Get current ticket
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Get user who is changing status
      const user = await userRepository.findById(changedBy);
      if (!user || !user.isActive) {
        throw createNotFoundError('User', changedBy);
      }

      const currentStatus = ticket.status;

      // Check if status change is needed
      if (currentStatus === newStatus) {
        throw new BadRequestError(`Ticket is already in ${newStatus} status`);
      }

      // Validate status transition
      const transition = this.validateStatusTransition(currentStatus, newStatus, user.role);
      if (!transition) {
        throw new BadRequestError(
          `Invalid status transition from ${currentStatus} to ${newStatus} for role ${user.role}`
        );
      }

      // Check transition requirements
      await this.checkTransitionRequirements(ticket, transition, comment);

      // Update ticket status
      const updatedTicket = await ticketRepository.update(ticketId, {
        status: newStatus,
        updatedAt: new Date(),
      });

      // Log status change
      logBusinessEvent('TICKET_STATUS_CHANGED', {
        ticketId,
        previousStatus: currentStatus,
        newStatus,
        changedBy,
        reason,
        comment,
      });

      // Execute auto actions
      await this.executeAutoActions(ticket, transition, changedBy);

      // Get updated ticket with relations
      const ticketWithRelations = await ticketRepository.findByIdWithRelations(ticketId);
      if (!ticketWithRelations) {
        throw new Error('Failed to retrieve updated ticket');
      }

      return ticketWithRelations;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('STATUS_CHANGE_ERROR', {
        ticketId,
        newStatus,
        changedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to change ticket status');
    }
  }

  /**
   * Get valid status transitions for a ticket
   */
  static getValidTransitions(currentStatus: TicketStatus, userRole: string): TicketStatus[] {
    return STATUS_TRANSITIONS
      .filter(transition => 
        transition.from === currentStatus && 
        transition.allowedRoles.includes(userRole)
      )
      .map(transition => transition.to);
  }

  /**
   * Get status transition requirements
   */
  static getTransitionRequirements(
    fromStatus: TicketStatus, 
    toStatus: TicketStatus
  ): StatusTransition | null {
    return STATUS_TRANSITIONS.find(
      transition => transition.from === fromStatus && transition.to === toStatus
    ) || null;
  }

  /**
   * Bulk status change for multiple tickets
   */
  static async bulkChangeStatus(
    ticketIds: string[],
    newStatus: TicketStatus,
    changedBy: string,
    reason?: string
  ): Promise<{ successful: string[]; failed: { ticketId: string; error: string }[] }> {
    const successful: string[] = [];
    const failed: { ticketId: string; error: string }[] = [];

    for (const ticketId of ticketIds) {
      try {
        await this.changeTicketStatus(ticketId, newStatus, changedBy, reason);
        successful.push(ticketId);
      } catch (error) {
        failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logBusinessEvent('BULK_STATUS_CHANGE_COMPLETED', {
      totalTickets: ticketIds.length,
      successful: successful.length,
      failed: failed.length,
      newStatus,
      changedBy,
    });

    return { successful, failed };
  }

  /**
   * Get status statistics
   */
  static async getStatusStatistics(): Promise<StatusStatistics> {
    try {
      const [open, inProgress, closed, total] = await Promise.all([
        ticketRepository.count({ status: 'OPEN' }),
        ticketRepository.count({ status: 'IN_PROGRESS' }),
        ticketRepository.count({ status: 'CLOSED' }),
        ticketRepository.count(),
      ]);

      const statusDistribution = {
        OPEN: {
          count: open,
          percentage: total > 0 ? Math.round((open / total) * 100) : 0,
        },
        IN_PROGRESS: {
          count: inProgress,
          percentage: total > 0 ? Math.round((inProgress / total) * 100) : 0,
        },
        CLOSED: {
          count: closed,
          percentage: total > 0 ? Math.round((closed / total) * 100) : 0,
        },
      };

      return {
        open,
        inProgress,
        closed,
        total,
        statusDistribution,
        // TODO: Calculate timing metrics from status change history
        // averageTimeToClose,
        // averageTimeToStart,
      };

    } catch (error) {
      logBusinessEvent('STATUS_STATISTICS_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve status statistics');
    }
  }

  /**
   * Get tickets by status with pagination
   */
  static async getTicketsByStatus(
    status: TicketStatus,
    page: number = 1,
    limit: number = 10,
    userRole?: string,
    userId?: string
  ) {
    try {
      const pagination = { page, limit };
      const filters = { status };

      // Apply user-specific filters if needed
      if (userRole === 'USER' && userId) {
        // Users can only see their own tickets or assigned tickets
        return await ticketRepository.findMany({
          where: {
            status,
            OR: [
              { createdBy: userId },
              { assignedTo: userId },
            ],
          },
          include: {
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
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        });
      }

      // Agents and admins can see all tickets
      return await ticketRepository.findWithFilters(filters, pagination, {
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
      });

    } catch (error) {
      logBusinessEvent('GET_TICKETS_BY_STATUS_ERROR', { status, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve tickets by status');
    }
  }

  /**
   * Auto-close stale tickets
   */
  static async autoCloseStaleTickets(
    daysOld: number = 30,
    closedBy: string,
    reason: string = 'Auto-closed due to inactivity'
  ): Promise<{ closedTickets: string[]; errors: string[] }> {
    try {
      const staleTickets = await ticketRepository.findStaleTickets(daysOld);
      const closedTickets: string[] = [];
      const errors: string[] = [];

      for (const ticket of staleTickets) {
        try {
          await this.changeTicketStatus(
            ticket.id,
            'CLOSED',
            closedBy,
            reason,
            `Auto-closed after ${daysOld} days of inactivity`
          );
          closedTickets.push(ticket.id);
        } catch (error) {
          errors.push(`Failed to close ticket ${ticket.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      logBusinessEvent('AUTO_CLOSE_STALE_TICKETS', {
        daysOld,
        totalStale: staleTickets.length,
        closed: closedTickets.length,
        errors: errors.length,
        closedBy,
      });

      return { closedTickets, errors };

    } catch (error) {
      logBusinessEvent('AUTO_CLOSE_STALE_TICKETS_ERROR', { daysOld, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to auto-close stale tickets');
    }
  }

  /**
   * Validate status transition
   */
  private static validateStatusTransition(
    fromStatus: TicketStatus,
    toStatus: TicketStatus,
    userRole: string
  ): StatusTransition | null {
    return STATUS_TRANSITIONS.find(
      transition =>
        transition.from === fromStatus &&
        transition.to === toStatus &&
        transition.allowedRoles.includes(userRole)
    ) || null;
  }

  /**
   * Check transition requirements
   */
  private static async checkTransitionRequirements(
    ticket: Ticket,
    transition: StatusTransition,
    comment?: string
  ): Promise<void> {
    // Check if assignment is required
    if (transition.requiresAssignment && !ticket.assignedTo) {
      throw new BadRequestError(
        `Ticket must be assigned before changing status to ${transition.to}`
      );
    }

    // Check if comment is required
    if (transition.requiresComment && !comment) {
      throw new BadRequestError(
        `Comment is required when changing status from ${transition.from} to ${transition.to}`
      );
    }
  }

  /**
   * Execute auto actions for status transitions
   */
  private static async executeAutoActions(
    ticket: Ticket,
    transition: StatusTransition,
    changedBy: string
  ): Promise<void> {
    if (!transition.autoActions) return;

    for (const action of transition.autoActions) {
      try {
        switch (action) {
          case 'notify_creator':
            // TODO: Implement notification to ticket creator
            logBusinessEvent('AUTO_ACTION_NOTIFY_CREATOR', {
              ticketId: ticket.id,
              creatorId: ticket.createdBy,
              newStatus: transition.to,
            });
            break;

          case 'notify_assignee':
            if (ticket.assignedTo) {
              // TODO: Implement notification to assignee
              logBusinessEvent('AUTO_ACTION_NOTIFY_ASSIGNEE', {
                ticketId: ticket.id,
                assigneeId: ticket.assignedTo,
                newStatus: transition.to,
              });
            }
            break;

          default:
            logBusinessEvent('UNKNOWN_AUTO_ACTION', { action, ticketId: ticket.id });
        }
      } catch (error) {
        logBusinessEvent('AUTO_ACTION_ERROR', {
          action,
          ticketId: ticket.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Check if user can change ticket status
   */
  static canUserChangeStatus(
    userRole: string,
    fromStatus: TicketStatus,
    toStatus: TicketStatus
  ): boolean {
    const transition = this.validateStatusTransition(fromStatus, toStatus, userRole);
    return transition !== null;
  }

  /**
   * Get status workflow information
   */
  static getStatusWorkflow(): {
    statuses: TicketStatus[];
    transitions: StatusTransition[];
    workflow: { [key in TicketStatus]: TicketStatus[] };
  } {
    const statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
    
    const workflow = statuses.reduce((acc, status) => {
      acc[status] = STATUS_TRANSITIONS
        .filter(t => t.from === status)
        .map(t => t.to);
      return acc;
    }, {} as { [key in TicketStatus]: TicketStatus[] });

    return {
      statuses,
      transitions: STATUS_TRANSITIONS,
      workflow,
    };
  }

  /**
   * Get tickets requiring status attention
   */
  static async getTicketsRequiringAttention(): Promise<{
    staleOpen: TicketWithRelations[];
    longInProgress: TicketWithRelations[];
    unassignedInProgress: TicketWithRelations[];
  }> {
    try {
      const [staleOpen, longInProgress, unassignedInProgress] = await Promise.all([
        ticketRepository.findStaleTickets(7),
        ticketRepository.findInProgressOlderThan(14),
        ticketRepository.findInProgressUnassigned(),
      ]);

      return {
        staleOpen,
        longInProgress,
        unassignedInProgress,
      };

    } catch (error) {
      logBusinessEvent('GET_ATTENTION_TICKETS_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve tickets requiring attention');
    }
  }
}