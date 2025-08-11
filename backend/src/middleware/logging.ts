import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { config } from '../config/env';

// Create Winston logger instance
export const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  ),
  defaultMeta: { service: 'ticket-system-api' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * HTTP request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url, ip, headers } = req;
  
  // Log request start
  logger.info('HTTP Request Started', {
    method,
    url,
    ip,
    userAgent: headers['user-agent'],
    timestamp: new Date().toISOString(),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log request completion
    logger.info('HTTP Request Completed', {
      method,
      url,
      ip,
      statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow Request Detected', {
        method,
        url,
        duration: `${duration}ms`,
        statusCode,
      });
    }

    // Call original end method with proper typing
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const { method, url, ip, body, query, params } = req;
  
  logger.error('HTTP Request Error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method,
      url,
      ip,
      body: config.env === 'development' ? body : '[REDACTED]',
      query,
      params,
    },
    timestamp: new Date().toISOString(),
  });

  next(error);
};

/**
 * Database operation logging
 */
export const logDatabaseOperation = (operation: string, table: string, data?: any) => {
  logger.debug('Database Operation', {
    operation,
    table,
    data: config.env === 'development' ? data : '[REDACTED]',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Authentication logging
 */
export const logAuthEvent = (event: string, userId?: string, email?: string, ip?: string) => {
  logger.info('Authentication Event', {
    event,
    userId,
    email,
    ip,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Security event logging
 */
export const logSecurityEvent = (event: string, details: any, req?: Request) => {
  logger.warn('Security Event', {
    event,
    details,
    request: req ? {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    } : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Performance logging
 */
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  const level = duration > 1000 ? 'warn' : 'info';
  
  logger.log(level, 'Performance Metric', {
    operation,
    duration: `${duration}ms`,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Business logic logging
 */
export const logBusinessEvent = (event: string, data: any) => {
  logger.info('Business Event', {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Create logs directory if it doesn't exist
import { existsSync, mkdirSync } from 'fs';
if (!existsSync('logs')) {
  mkdirSync('logs');
}