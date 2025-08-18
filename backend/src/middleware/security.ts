import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
  scriptSrc: ["'self'"],
  connectSrc: ["'self'", config.cors.origin, 'ws:', 'wss:'],
    },
  },
  // Align with tests expecting X-Frame-Options: DENY
  frameguard: { action: 'deny' },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
});

/**
 * Rate limiting middleware
 */
export const rateLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
    timestamp: new Date().toISOString(),
  },
  // Expose both modern and legacy headers so tests can read X-RateLimit-*
  standardHeaders: true,
  legacyHeaders: true,
  // Skip rate limiting for certain routes in development
  skip: (req: Request) => {
    if (config.env === 'development') {
      return req.path.startsWith('/api/health');
    }
    return false;
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // In development, effectively disable strict auth limiting to avoid 429s while testing
  max: 5,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: true,
  // Skip strict auth rate limiting outside production (dev and test)
  skip: () => config.env !== 'production',
});

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Remove potentially dangerous characters
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigin = config.cors.origin;
    const isProd = process.env.NODE_ENV === 'production';
    // Allow same-origin in production deployments (no origin header or exact match), always allow in non-prod
    if (!origin || origin === allowedOrigin || !isProd) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

/**
 * Security middleware for API routes
 */
export const apiSecurity = [
  securityHeaders,
  rateLimiter,
  sanitizeInput,
];

/**
 * Enhanced security for authentication routes
 */
export const authSecurity = [
  securityHeaders,
  authRateLimiter,
  sanitizeInput,
];