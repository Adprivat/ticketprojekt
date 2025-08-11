import { PrismaClient } from '@prisma/client';
import { prisma } from '../connection';
import { withErrorHandling } from '../errors';
import { PaginationOptions, calculatePagination, createPaginationResponse } from '../types';

export abstract class BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  protected prisma: PrismaClient;
  protected abstract modelName: string;

  constructor() {
    this.prisma = prisma;
  }

  // Get the Prisma model delegate
  protected abstract getModel(): any;

  // Create a new record
  async create(data: CreateInput): Promise<T> {
    return withErrorHandling(async () => {
      return await this.getModel().create({ data });
    }, `Create ${this.modelName}`);
  }

  // Find a record by ID
  async findById(id: string, include?: any): Promise<T | null> {
    return withErrorHandling(async () => {
      return await this.getModel().findUnique({
        where: { id },
        include,
      });
    }, `Find ${this.modelName} by ID`);
  }

  // Find many records with options
  async findMany(options: any = {}): Promise<T[]> {
    return withErrorHandling(async () => {
      return await this.getModel().findMany(options);
    }, `Find many ${this.modelName}`);
  }

  // Update a record by ID
  async update(id: string, data: UpdateInput, include?: any): Promise<T> {
    return withErrorHandling(async () => {
      return await this.getModel().update({
        where: { id },
        data,
        include,
      });
    }, `Update ${this.modelName}`);
  }

  // Delete a record by ID
  async delete(id: string): Promise<T> {
    return withErrorHandling(async () => {
      return await this.getModel().delete({
        where: { id },
      });
    }, `Delete ${this.modelName}`);
  }

  // Check if a record exists
  async exists(where: WhereInput): Promise<boolean> {
    return withErrorHandling(async () => {
      const count = await this.getModel().count({ where });
      return count > 0;
    }, `Check ${this.modelName} exists`);
  }

  // Count records
  async count(where?: WhereInput): Promise<number> {
    return withErrorHandling(async () => {
      return await this.getModel().count({ where });
    }, `Count ${this.modelName}`);
  }

  // Find first record matching criteria
  async findFirst(options: any): Promise<T | null> {
    return withErrorHandling(async () => {
      return await this.getModel().findFirst(options);
    }, `Find first ${this.modelName}`);
  }

  // Upsert (create or update)
  async upsert(
    where: WhereInput,
    create: CreateInput,
    update: UpdateInput,
    include?: any
  ): Promise<T> {
    return withErrorHandling(async () => {
      return await this.getModel().upsert({
        where,
        create,
        update,
        include,
      });
    }, `Upsert ${this.modelName}`);
  }

  // Find many with pagination and return data + pagination meta
  async findManyPaginated(options: any = {}, pagination: PaginationOptions) {
    return withErrorHandling(async () => {
      const { where, orderBy, include, select } = options || {};
      const { skip, take } = calculatePagination(pagination.page, pagination.limit);

      const [total, items] = await Promise.all([
        this.getModel().count({ where }),
        this.getModel().findMany({ where, orderBy, include, select, skip, take }),
      ]);

      return createPaginationResponse(items, total, pagination.page, pagination.limit);
    }, `Find many ${this.modelName} with pagination`);
  }
}