import { Prisma, User, Role } from '@prisma/client';
import { BaseRepository } from './base.repository';

// Define types locally for now
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereInput
> {
  protected modelName = 'user';

  protected getModel() {
    return this.prisma.user;
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    return await this.findFirst({
      where: { email },
    });
  }

  // Find user by email (public data only)
  async findByEmailPublic(email: string): Promise<PublicUser | null> {
    const user = await this.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user as PublicUser | null;
  }

  // Get user with all relations
  async findByIdWithRelations(id: string): Promise<any | null> {
    return await this.findById(id, {
      createdTickets: {
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
      },
      assignedTickets: {
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
      },
      comments: {
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    });
  }

  // Get all active users (for assignment dropdown)
  async findActiveUsers(): Promise<PublicUser[]> {
    const users = await this.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });
    return users as PublicUser[];
  }

  // Get users by role
  async findByRole(role: string): Promise<PublicUser[]> {
    const users = await this.findMany({
      where: { role, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });
    return users as PublicUser[];
  }

  // Check if email is available
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const where: Prisma.UserWhereInput = { email };
    if (excludeUserId) {
      where.id = { not: excludeUserId };
    }
    
    const existingUser = await this.findFirst({ where });
    return !existingUser;
  }

  // Deactivate user (soft delete)
  async deactivate(id: string): Promise<User> {
    return await this.update(id, { isActive: false });
  }

  // Reactivate user
  async reactivate(id: string): Promise<User> {
    return await this.update(id, { isActive: true });
  }
}