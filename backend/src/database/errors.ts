/**
 * Database-specific error classes
 */

export class DatabaseError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, code: string = 'DATABASE_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string = 'Database connection failed') {
    super(message, 'DATABASE_CONNECTION_ERROR', 503);
  }
}

export class DatabaseQueryError extends DatabaseError {
  constructor(message: string = 'Database query failed') {
    super(message, 'DATABASE_QUERY_ERROR', 500);
  }
}

export class DatabaseValidationError extends DatabaseError {
  constructor(message: string = 'Database validation failed') {
    super(message, 'DATABASE_VALIDATION_ERROR', 400);
  }
}

export class DatabaseConstraintError extends DatabaseError {
  constructor(message: string = 'Database constraint violation') {
    super(message, 'DATABASE_CONSTRAINT_ERROR', 409);
  }
}

export class RecordNotFoundError extends DatabaseError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(message, 'RECORD_NOT_FOUND', 404);
  }
}

export class DuplicateRecordError extends DatabaseError {
  constructor(resource: string, field?: string) {
    const message = field 
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    super(message, 'DUPLICATE_RECORD', 409);
  }
}

/**
 * Helper function to handle Prisma errors
 */
export const handlePrismaError = (error: any): DatabaseError => {
  // Handle known Prisma error codes
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      return new DuplicateRecordError('Record', field);
    
    case 'P2025':
      // Record not found
      return new RecordNotFoundError('Record');
    
    case 'P2003':
      // Foreign key constraint violation
      return new DatabaseConstraintError('Foreign key constraint violation');
    
    case 'P2004':
      // Constraint violation
      return new DatabaseConstraintError('Database constraint violation');
    
    case 'P1001':
      // Connection error
      return new DatabaseConnectionError('Cannot reach database server');
    
    case 'P1002':
      // Connection timeout
      return new DatabaseConnectionError('Database connection timeout');
    
    case 'P1008':
      // Operation timeout
      return new DatabaseQueryError('Database operation timeout');
    
    default:
      // Generic database error
      return new DatabaseError(error.message || 'Database operation failed');
  }
};

/**
 * Async wrapper for database operations with error handling
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Handle Prisma errors
    if (error.code && error.code.startsWith('P')) {
      throw handlePrismaError(error);
    }
    
    // Handle other database errors
    if (error instanceof DatabaseError) {
      throw error;
    }
    
    // Handle generic errors
    const message = context 
      ? `${context}: ${error.message}`
      : error.message;
    throw new DatabaseError(message);
  }
};