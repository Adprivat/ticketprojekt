import { Request, Response, NextFunction } from 'express';
import { DatabaseError } from '../database/errors';
import { logger } from './logging';
import { config } from '../config/env';

/**
 * Custom application error class
 */
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * HTTP error classes
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', code: string = 'VALIDATION_ERROR') {
    super(message, 422, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
    super(message, 500, code);
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
}

/**
 * Format error response
 */
const formatErrorResponse = (error: any, req: Request): ErrorResponse => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    },
    timestamp: new Date().toISOString(),
  };

  // Add stack trace in development
  if (config.env === 'development') {
    response.error.stack = error.stack;
  }

  // Add additional details for specific error types
  if (error.details) {
    response.error.details = error.details;
  }

  return response;
};

/**
 * Handle different types of errors
 */
const handleError = (error: any, req: Request): { statusCode: number; response: ErrorResponse } => {
  let statusCode = 500;
  let processedError = error;

  // Handle custom application errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
  }
  // Handle database errors
  else if (error instanceof DatabaseError) {
    statusCode = error.statusCode;
    processedError = {
      ...error,
      code: error.code,
      message: error.message,
    };
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    processedError = {
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
    };
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    processedError = {
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
    };
  }
  // Handle validation errors from Joi
  else if (error.name === 'ValidationError' && error.details) {
    statusCode = 400;
    processedError = {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.details.map((detail: any) => detail.message),
    };
  }
  // Handle multer errors (file upload)
  else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    processedError = {
      code: 'FILE_TOO_LARGE',
      message: 'File size exceeds the allowed limit',
    };
  }
  else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    processedError = {
      code: 'UNEXPECTED_FILE',
      message: 'Unexpected file field',
    };
  }
  // Handle syntax errors
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    processedError = {
      code: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
    };
  }
  // Handle generic errors
  else {
    processedError = {
      code: 'INTERNAL_ERROR',
      message: config.env === 'production' 
        ? 'An unexpected error occurred' 
        : error.message || 'An unexpected error occurred',
      stack: error.stack,
    };
  }

  return {
    statusCode,
    response: formatErrorResponse(processedError, req),
  };
};

/**
 * Global error handling middleware
 */
export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error('Unhandled Error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: config.env === 'development' ? req.body : '[REDACTED]',
    },
    timestamp: new Date().toISOString(),
  });

  // Handle the error
  const { statusCode, response } = handleError(error, req);

  // Send error response
  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.url} not found`);
  next(error);
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error helper
 */
export const createValidationError = (message: string, details?: any) => {
  const error = new ValidationError(message);
  if (details) {
    (error as any).details = details;
  }
  return error;
};

/**
 * Database error helper
 */
export const createDatabaseError = (message: string, code: string = 'DATABASE_ERROR') => {
  return new DatabaseError(message, code);
};

/**
 * Authentication error helpers
 */
export const createAuthError = (message: string = 'Authentication failed') => {
  return new UnauthorizedError(message, 'AUTH_FAILED');
};

export const createTokenError = (message: string = 'Invalid or expired token') => {
  return new UnauthorizedError(message, 'INVALID_TOKEN');
};

/**
 * Authorization error helper
 */
export const createAuthorizationError = (message: string = 'Insufficient permissions') => {
  return new ForbiddenError(message, 'INSUFFICIENT_PERMISSIONS');
};

/**
 * Resource not found error helper
 */
export const createNotFoundError = (resource: string, id?: string) => {
  const message = id 
    ? `${resource} with ID ${id} not found`
    : `${resource} not found`;
  return new NotFoundError(message, 'RESOURCE_NOT_FOUND');
};

/**
 * Conflict error helper
 */
export const createConflictError = (message: string) => {
  return new ConflictError(message, 'RESOURCE_CONFLICT');
};