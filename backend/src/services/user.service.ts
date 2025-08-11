import { Role, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { userRepository } from '@/database/repositories';
import { PaginationOptions } from '@/database/types';
import { BadRequestError, ConflictError, createNotFoundError } from '@/middleware/errorHandler';
import { logBusinessEvent } from '@/middleware/logging';
import { config } from '@/config/env';

export interface UserFilters {
  role?: Role;
  isActive?: boolean;
  search?: string;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: Role;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: Role;
  isActive?: boolean;
}

export class UserService {
  static async list(filters: UserFilters, pagination: PaginationOptions) {
    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return await userRepository.findManyPaginated(
      {
        where,
        orderBy: [{ createdAt: 'desc' }],
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
      },
      pagination
    );
  }

  static async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw createNotFoundError('User', id);
    return user;
  }

  static async create(data: CreateUserData) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already in use');

    const hashed = await bcrypt.hash(data.password, config.security.bcryptRounds);

    const created = await userRepository.create({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      password: hashed,
      role: data.role ?? 'USER',
      isActive: true,
    } as any);

    logBusinessEvent('ADMIN_USER_CREATED', { userId: created.id, role: created.role });

    return created;
  }

  static async update(id: string, data: UpdateUserData, actorId: string) {
    const user = await userRepository.findById(id);
    if (!user) throw createNotFoundError('User', id);

    if (data.email && data.email !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && existing.id !== id) throw new ConflictError('Email already in use');
    }

    const updated = await userRepository.update(id, {
      email: data.email ?? undefined,
      firstName: data.firstName ?? undefined,
      lastName: data.lastName ?? undefined,
      role: data.role ?? undefined,
      isActive: data.isActive ?? undefined,
    } as any);

    logBusinessEvent('ADMIN_USER_UPDATED', { targetId: id, actorId, changes: data });
    return updated;
  }

  static async deactivate(id: string, actorId: string) {
    const user = await userRepository.findById(id);
    if (!user) throw createNotFoundError('User', id);
    if (!user.isActive) return user;
    const updated = await userRepository.update(id, { isActive: false } as any);
    logBusinessEvent('ADMIN_USER_DEACTIVATED', { targetId: id, actorId });
    return updated;
  }

  static async reactivate(id: string, actorId: string) {
    const user = await userRepository.findById(id);
    if (!user) throw createNotFoundError('User', id);
    if (user.isActive) return user;
    const updated = await userRepository.update(id, { isActive: true } as any);
    logBusinessEvent('ADMIN_USER_REACTIVATED', { targetId: id, actorId });
    return updated;
  }

  static async delete(id: string, actorId: string): Promise<void> {
    const user = await userRepository.findById(id);
    if (!user) throw createNotFoundError('User', id);
    try {
      await userRepository.delete(id);
      logBusinessEvent('ADMIN_USER_DELETED', { targetId: id, actorId });
    } catch (_e) {
      throw new BadRequestError('Cannot delete user with related records. Deactivate instead.');
    }
  }
}
