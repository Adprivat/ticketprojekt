import { Prisma, Ticket, TicketStatus, Priority } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { TicketWithRelations, PaginationOptions } from '@/database/types';

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  assignedTo?: string;
  createdBy?: string;
  search?: string;
}

export class TicketRepository extends BaseRepository<
  Ticket,
  Prisma.TicketCreateInput,
  Prisma.TicketUpdateInput,
  Prisma.TicketWhereInput
> {
  protected modelName = 'ticket';

  protected getModel() {
    return this.prisma.ticket;
  }

  // Get ticket with all relations
  async findByIdWithRelations(id: string): Promise<TicketWithRelations | null> {
    return await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: true,
        assignee: true,
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // Find tickets with filters and pagination
  async findWithFilters(
    filters: TicketFilters = {},
    pagination: PaginationOptions,
    include: any = {}
  ) {
    const where: Prisma.TicketWhereInput = {};

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    if (filters.search) {
      // Note: StringFilter.mode is only available in newer Prisma versions. If not available, omit it.
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return await this.findManyPaginated(
      {
        where,
        include,
        orderBy: { createdAt: 'desc' },
      },
      pagination
    );
  }

  // Get tickets assigned to a user
  async findAssignedToUser(
    userId: string,
    pagination: PaginationOptions,
    status?: TicketStatus
  ) {
    const where: Prisma.TicketWhereInput = { assignedTo: userId };
    if (status) {
      where.status = status;
    }

    return await this.findManyPaginated(
      {
        where,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      },
      pagination
    );
  }

  // Get tickets created by a user
  async findCreatedByUser(
    userId: string,
    pagination: PaginationOptions,
    status?: TicketStatus
  ) {
    const where: Prisma.TicketWhereInput = { createdBy: userId };
    if (status) {
      where.status = status;
    }

    return await this.findManyPaginated(
      {
        where,
        include: {
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      pagination
    );
  }

  // Update ticket status
  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return await this.update(id, {
      status,
      updatedAt: new Date(),
    } as Prisma.TicketUpdateInput);
  }

  // Assign ticket to user
  async assignToUser(id: string, assigneeId: string): Promise<Ticket> {
    return await this.update(id, {
      assignee: { connect: { id: assigneeId } },
      updatedAt: new Date(),
    } as Prisma.TicketUpdateInput);
  }

  // Unassign ticket
  async unassign(id: string): Promise<Ticket> {
    return await this.update(id, {
      assignee: { disconnect: true },
      updatedAt: new Date(),
    } as Prisma.TicketUpdateInput);
  }

  // Get ticket statistics
  async getStatistics() {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      closedTickets,
      unassignedTickets,
    ] = await Promise.all([
      this.count(),
      this.count({ status: 'OPEN' }),
      this.count({ status: 'IN_PROGRESS' }),
      this.count({ status: 'CLOSED' }),
      this.count({ assignedTo: null } as any),
    ]);

    return {
      total: totalTickets,
      open: openTickets,
      inProgress: inProgressTickets,
      closed: closedTickets,
      unassigned: unassignedTickets,
    };
  }

  // Get tickets that need attention (old open tickets)
  async findStaleTickets(daysOld: number = 7): Promise<TicketWithRelations[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.prisma.ticket.findMany({
      where: {
        status: 'OPEN',
        createdAt: {
          lt: cutoffDate,
        },
      },
      include: {
        creator: true,
        assignee: true,
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Tickets in progress older than N days with full relations
  async findInProgressOlderThan(daysOld: number = 14): Promise<TicketWithRelations[]> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    return await this.prisma.ticket.findMany({
      where: {
        status: 'IN_PROGRESS',
        updatedAt: { lt: cutoff },
      },
      include: {
        creator: true,
        assignee: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  // In-progress tickets without assignee with full relations
  async findInProgressUnassigned(): Promise<TicketWithRelations[]> {
    return await this.prisma.ticket.findMany({
      where: {
        status: 'IN_PROGRESS',
        assignedTo: null,
      },
      include: {
        creator: true,
        assignee: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}