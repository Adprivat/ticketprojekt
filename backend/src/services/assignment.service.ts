import { User, Ticket, Role } from '@prisma/client';
import { ticketRepository, userRepository } from '@/database/repositories';
import { TicketWithRelations, PublicUser } from '@/database/types';
import { 
  NotFoundError, 
  BadRequestError,
  ForbiddenError,
  createNotFoundError,
  createAuthorizationError 
} from '@/middleware/errorHandler';
import { logBusinessEvent } from '@/middleware/logging';
import { NotificationService } from './notification.service';

/**
 * Assignment history entry
 */
export interface AssignmentHistory {
  ticketId: string;
  previousAssignee: string | null;
  newAssignee: string | null;
  assignedBy: string;
  assignedAt: Date;
  reason?: string;
}

/**
 * Assignment statistics
 */
export interface AssignmentStats {
  totalAssigned: number;
  assignedByUser: number;
  assignedByAgent: number;
  assignedByAdmin: number;
  unassigned: number;
  averageAssignmentTime?: number;
}

/**
 * Workload information for assignees
 */
export interface AssigneeWorkload {
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
  openTickets: number;
  inProgressTickets: number;
  totalActiveTickets: number;
  averageResolutionTime?: number;
  isAvailable: boolean;
}

/**
 * Assignment recommendation
 */
export interface AssignmentRecommendation {
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
  score: number;
  reasons: string[];
  currentWorkload: number;
}

/**
 * Assignment service for advanced ticket assignment functionality
 */
export class AssignmentService {
  /**
   * Assign ticket to user with validation and notifications
   */
  static async assignTicket(
    ticketId: string,
    assigneeId: string,
    assignedBy: string,
    reason?: string
  ): Promise<TicketWithRelations> {
    try {
      // Validate ticket exists
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Validate assignee exists and is eligible
      const assignee = await userRepository.findById(assigneeId);
      if (!assignee || !assignee.isActive) {
        throw createNotFoundError('Assignee user', assigneeId);
      }

      // Only agents and admins can be assigned tickets
      if (assignee.role === 'USER') {
        throw new BadRequestError('Only agents and admins can be assigned tickets');
      }

      // Validate assigner has permission
      const assigner = await userRepository.findById(assignedBy);
      if (!assigner || !assigner.isActive) {
        throw createNotFoundError('Assigner user', assignedBy);
      }

      if (assigner.role === 'USER') {
        throw createAuthorizationError('Only agents and admins can assign tickets');
      }

      const previousAssignee = ticket.assignedTo;

      // Update ticket assignment using relation helper
      await ticketRepository.assignToUser(ticketId, assigneeId);

      // Log assignment event
      logBusinessEvent('TICKET_ASSIGNED', {
        ticketId,
        previousAssignee,
        newAssignee: assigneeId,
        assignedBy,
        reason,
      });

      // Get updated ticket with relations (inkl. creator & assignee)
      const ticketWithRelations = await ticketRepository.findByIdWithRelations(ticketId);
      if (!ticketWithRelations) {
        throw new Error('Failed to retrieve updated ticket');
      }

      // Prepare previous assignee user (falls vorhanden) für Notification
      let previousAssigneeUser: any | undefined;
      if (previousAssignee) {
        previousAssigneeUser = await userRepository.findById(previousAssignee);
      }

      // Trigger Notifications (gleiche Logik wie updateTicket)
      try {
        await NotificationService.notifyTicketAssigned(
          ticketWithRelations as any,
          assigner as any,
          previousAssigneeUser as any
        );
      } catch (notifyErr) {
        logBusinessEvent('ASSIGNMENT_NOTIFICATION_ERROR', {
          ticketId,
          assigneeId,
          assignedBy,
          error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
        });
      }

      return ticketWithRelations;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error;
      }
      logBusinessEvent('TICKET_ASSIGNMENT_ERROR', {
        ticketId,
        assigneeId,
        assignedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to assign ticket');
    }
  }

  /**
   * Unassign ticket
   */
  static async unassignTicket(
    ticketId: string,
    unassignedBy: string,
    reason?: string
  ): Promise<TicketWithRelations> {
    try {
      // Validate ticket exists
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      if (!ticket.assignedTo) {
        throw new BadRequestError('Ticket is not currently assigned');
      }

      // Validate unassigner has permission
      const unassigner = await userRepository.findById(unassignedBy);
      if (!unassigner || !unassigner.isActive) {
        throw createNotFoundError('Unassigner user', unassignedBy);
      }

      if (unassigner.role === 'USER') {
        throw createAuthorizationError('Only agents and admins can unassign tickets');
      }

      const previousAssignee = ticket.assignedTo;

      // Update ticket to unassign using relation helper
      await ticketRepository.unassign(ticketId);

      // Log unassignment event
      logBusinessEvent('TICKET_UNASSIGNED', {
        ticketId,
        previousAssignee,
        unassignedBy,
        reason,
      });

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
      logBusinessEvent('TICKET_UNASSIGNMENT_ERROR', {
        ticketId,
        unassignedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestError('Failed to unassign ticket');
    }
  }

  /**
   * Reassign ticket from one user to another
   */
  static async reassignTicket(
    ticketId: string,
    newAssigneeId: string,
    reassignedBy: string,
    reason?: string
  ): Promise<TicketWithRelations> {
    try {
      // Get current ticket
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      const previousAssignee = ticket.assignedTo;

      // Use assign method which handles all validation
      const updatedTicket = await this.assignTicket(ticketId, newAssigneeId, reassignedBy, reason);

      // Log reassignment event
      logBusinessEvent('TICKET_REASSIGNED', {
        ticketId,
        previousAssignee,
        newAssignee: newAssigneeId,
        reassignedBy,
        reason,
      });

      return updatedTicket;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new BadRequestError('Failed to reassign ticket');
    }
  }

  /**
   * Get available assignees (agents and admins)
   */
  static async getAvailableAssignees(): Promise<PublicUser[]> {
    try {
      const agents = await userRepository.findByRole('AGENT');
      const admins = await userRepository.findByRole('ADMIN');
      return [...agents, ...admins].filter(user => user.isActive) as PublicUser[];
    } catch (error) {
      logBusinessEvent('GET_ASSIGNEES_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve available assignees');
    }
  }

  /**
   * Get workload for all assignees
   */
  static async getAssigneeWorkloads(): Promise<AssigneeWorkload[]> {
    try {
      const assignees = await this.getAvailableAssignees();
      const workloads: AssigneeWorkload[] = [];

      for (const assignee of assignees) {
        const [openTickets, inProgressTickets] = await Promise.all([
          ticketRepository.count({ assignedTo: assignee.id, status: 'OPEN' }),
          ticketRepository.count({ assignedTo: assignee.id, status: 'IN_PROGRESS' }),
        ]);

        const totalActiveTickets = openTickets + inProgressTickets;

        workloads.push({
          userId: assignee.id,
          user: {
            id: assignee.id,
            email: assignee.email,
            firstName: assignee.firstName,
            lastName: assignee.lastName,
            role: assignee.role,
          },
          openTickets,
          inProgressTickets,
          totalActiveTickets,
          isAvailable: totalActiveTickets < 10, // Configurable threshold
        });
      }

      // Sort by workload (ascending)
      return workloads.sort((a, b) => a.totalActiveTickets - b.totalActiveTickets);

    } catch (error) {
      logBusinessEvent('GET_WORKLOADS_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve assignee workloads');
    }
  }

  /**
   * Get assignment recommendations for a ticket
   */
  static async getAssignmentRecommendations(ticketId: string): Promise<AssignmentRecommendation[]> {
    try {
      // Get ticket details
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        throw createNotFoundError('Ticket', ticketId);
      }

      // Get workloads
      const workloads = await this.getAssigneeWorkloads();
      
      const recommendations: AssignmentRecommendation[] = workloads.map(workload => {
        const reasons: string[] = [];
        let score = 100; // Base score

        // Adjust score based on current workload
        if (workload.totalActiveTickets === 0) {
          reasons.push('No current active tickets');
          score += 20;
        } else if (workload.totalActiveTickets < 3) {
          reasons.push('Low workload');
          score += 10;
        } else if (workload.totalActiveTickets > 7) {
          reasons.push('High workload');
          score -= 20;
        }

        // Prefer agents for regular tickets, admins for high priority
        if (ticket.priority === 'URGENT' || ticket.priority === 'HIGH') {
          if (workload.user.role === 'ADMIN') {
            reasons.push('Admin role suitable for high priority');
            score += 15;
          }
        } else {
          if (workload.user.role === 'AGENT') {
            reasons.push('Agent role suitable for regular tickets');
            score += 5;
          }
        }

        // Availability bonus
        if (workload.isAvailable) {
          reasons.push('Currently available');
          score += 10;
        } else {
          reasons.push('High workload - may be overloaded');
          score -= 30;
        }

        return {
          userId: workload.userId,
          user: workload.user,
          score: Math.max(0, score), // Ensure non-negative score
          reasons,
          currentWorkload: workload.totalActiveTickets,
        };
      });

      // Sort by score (descending)
      return recommendations.sort((a, b) => b.score - a.score);

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logBusinessEvent('GET_RECOMMENDATIONS_ERROR', { ticketId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to get assignment recommendations');
    }
  }

  /**
   * Auto-assign ticket based on workload and availability
   */
  static async autoAssignTicket(
    ticketId: string,
    assignedBy: string
  ): Promise<TicketWithRelations> {
    try {
      const recommendations = await this.getAssignmentRecommendations(ticketId);
      
      if (recommendations.length === 0) {
        throw new BadRequestError('No available assignees found');
      }

      // Get the best recommendation
      const bestAssignee = recommendations[0];
      
      if (bestAssignee.score < 50) {
        throw new BadRequestError('No suitable assignees available (all overloaded)');
      }

      // Assign to the best candidate
      const result = await this.assignTicket(
        ticketId,
        bestAssignee.userId,
        assignedBy,
        `Auto-assigned based on workload and availability (score: ${bestAssignee.score})`
      );

      logBusinessEvent('TICKET_AUTO_ASSIGNED', {
        ticketId,
        assigneeId: bestAssignee.userId,
        assignedBy,
        score: bestAssignee.score,
        reasons: bestAssignee.reasons,
      });

      return result;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      logBusinessEvent('AUTO_ASSIGNMENT_ERROR', { ticketId, assignedBy, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to auto-assign ticket');
    }
  }

  /**
   * Bulk assign multiple tickets
   */
  static async bulkAssignTickets(
    ticketIds: string[],
    assigneeId: string,
    assignedBy: string,
    reason?: string
  ): Promise<{ successful: string[]; failed: { ticketId: string; error: string }[] }> {
    const successful: string[] = [];
    const failed: { ticketId: string; error: string }[] = [];

    for (const ticketId of ticketIds) {
      try {
        await this.assignTicket(ticketId, assigneeId, assignedBy, reason);
        successful.push(ticketId);
      } catch (error) {
        failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logBusinessEvent('BULK_ASSIGNMENT_COMPLETED', {
      totalTickets: ticketIds.length,
      successful: successful.length,
      failed: failed.length,
      assigneeId,
      assignedBy,
    });

    return { successful, failed };
  }

  /**
   * Get assignment statistics
   */
  static async getAssignmentStatistics(): Promise<AssignmentStats> {
    try {
      const [
        totalAssigned,
        unassigned,
        // In a real app, you'd track assignment history in a separate table
      ] = await Promise.all([
        ticketRepository.count({ assignedTo: { not: null } }),
        ticketRepository.count({ assignedTo: null }),
      ]);

      return {
        totalAssigned,
        assignedByUser: 0, // Would need assignment history table
        assignedByAgent: 0, // Would need assignment history table
        assignedByAdmin: 0, // Would need assignment history table
        unassigned,
      };

    } catch (error) {
      logBusinessEvent('ASSIGNMENT_STATISTICS_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve assignment statistics');
    }
  }

  /**
   * Check if user can be assigned tickets
   */
  static canUserBeAssigned(user: User): boolean {
    return user.isActive && (user.role === 'AGENT' || user.role === 'ADMIN');
  }

  /**
   * Check if user can assign tickets
   */
  static canUserAssignTickets(user: User): boolean {
    return user.isActive && (user.role === 'AGENT' || user.role === 'ADMIN');
  }

  /**
   * Get tickets assigned to user with status filter
   */
  static async getUserAssignedTickets(
    userId: string,
    status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
  ): Promise<TicketWithRelations[]> {
    try {
      const whereClause: any = { assignedTo: userId };
      if (status) {
        whereClause.status = status;
      }

      const result = await ticketRepository.findMany({
        where: whereClause,
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
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return result as unknown as TicketWithRelations[];

    } catch (error) {
      logBusinessEvent('GET_USER_ASSIGNED_TICKETS_ERROR', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new BadRequestError('Failed to retrieve assigned tickets');
    }
  }
}