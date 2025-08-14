import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../utils/jwt';
import { userRepository } from '../database/repositories';
import { 
  UnauthorizedError, 
  createAuthError,
  createTokenError,
  createAuthorizationError 
} from './errorHandler';
import { logAuthEvent, logSecurityEvent } from './logging';

type Role = 'USER' | 'AGENT' | 'ADMIN';

/**
 * Extend Express Request to include user information
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        iat?: number;
        exp?: number;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      logSecurityEvent('AUTH_MISSING_TOKEN', { url: req.url }, req);
      throw createTokenError('Authentication token is required');
    }

    // Verify token
    const decoded = JwtService.verifyAccessToken(token);

    // Check if user still exists and is active
    const user = await userRepository.findById(decoded.userId);
    if (!user || !user.isActive) {
      logSecurityEvent('AUTH_INVALID_USER', { 
        userId: decoded.userId,
        userExists: !!user,
        isActive: user?.isActive 
      }, req);
      throw createAuthError('User account is not valid or has been deactivated');
    }

    // Attach user information to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    logAuthEvent('AUTH_SUCCESS', user.id, user.email, req.ip);
    next();

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      // propagate already-classified auth errors (may be INVALID_TOKEN/AUTH_FAILED)
      next(error);
    } else if (error && (error as any).name === 'JsonWebTokenError') {
      // Ensure JWT errors surface as INVALID_TOKEN per tests
      next(createTokenError('Invalid authentication token'));
    } else if (error && (error as any).name === 'TokenExpiredError') {
      next(createTokenError('Authentication token has expired'));
    } else {
      const message = error instanceof Error ? error.message : String(error);
      logSecurityEvent('AUTH_ERROR', { error: message }, req);
      next(createAuthError('Authentication failed'));
    }
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = JwtService.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          iat: decoded.iat,
          exp: decoded.exp,
        };
      }
    }

    next();
  } catch (_err) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};

/**
 * Authorization middleware factory
 * Checks if user has required role(s)
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logSecurityEvent('AUTHZ_NO_USER', { allowedRoles }, req);
      throw createAuthError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      logSecurityEvent('AUTHZ_INSUFFICIENT_ROLE', {
        userId: req.user.id,
        userRole: req.user.role,
        allowedRoles,
      }, req);
      throw createAuthorizationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }

    next();
  };
};

/**
 * Resource ownership middleware
 * Checks if user owns the resource or has admin privileges
 */
export const authorizeOwnership = (resourceUserIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createAuthError('Authentication required');
    }

    // Admins can access any resource
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check ownership based on request parameters or body
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      throw createAuthorizationError('Resource ownership cannot be determined');
    }

    if (req.user.id !== resourceUserId) {
      logSecurityEvent('AUTHZ_OWNERSHIP_VIOLATION', {
        userId: req.user.id,
        resourceUserId,
        resource: req.url,
      }, req);
      throw createAuthorizationError('Access denied. You can only access your own resources');
    }

    next();
  };
};

/**
 * Ticket access authorization
 * Users can access tickets they created or are assigned to
 * Agents and admins can access all tickets
 */
export const authorizeTicketAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw createAuthError('Authentication required');
    }

    // Admins and agents can access all tickets
    if (req.user.role === 'ADMIN' || req.user.role === 'AGENT') {
      return next();
    }

    const ticketId = req.params.id;
    if (!ticketId) {
      throw createAuthorizationError('Ticket ID is required');
    }

    // Check if user created the ticket or is assigned to it
    const { ticketRepository } = await import('../database/repositories');
    const ticket = await ticketRepository.findById(ticketId);

    if (!ticket) {
      // Surface as 404 Not Found instead of 403
      const { createNotFoundError } = await import('./errorHandler');
      throw createNotFoundError('Ticket', ticketId);
    }

    const hasAccess = ticket.createdBy === req.user.id || ticket.assignedTo === req.user.id;

    if (!hasAccess) {
      logSecurityEvent('AUTHZ_TICKET_ACCESS_DENIED', {
        userId: req.user.id,
        ticketId,
        ticketCreator: ticket.createdBy,
        ticketAssignee: ticket.assignedTo,
      }, req);
      throw createAuthorizationError('Access denied. You can only access tickets you created or are assigned to');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Comment access authorization
 * Users can access comments on tickets they have access to
 */
export const authorizeCommentAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw createAuthError('Authentication required');
    }

    // Admins can access all comments
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const commentId = req.params.id;
    const ticketId = req.params.ticketId;

  if (commentId) {
      // Accessing specific comment
      const { commentRepository } = await import('../database/repositories');
      const comment = await commentRepository.findByIdWithRelations(commentId);

      if (!comment) {
    const { createNotFoundError } = await import('./errorHandler');
    throw createNotFoundError('Comment', commentId);
      }

      // Check access to the ticket this comment belongs to
      const hasTicketAccess = comment.ticket && (
        comment.ticket.createdBy === req.user.id || 
        comment.ticket.assignedTo === req.user.id ||
        req.user.role === 'AGENT'
      );

  if (!hasTicketAccess) {
        logSecurityEvent('AUTHZ_COMMENT_ACCESS_DENIED', {
          userId: req.user.id,
          commentId,
          ticketId: comment.ticketId,
        }, req);
        throw createAuthorizationError('Access denied to comment');
      }
    } else if (ticketId) {
      // Accessing comments for a ticket - use ticket authorization
      req.params.id = ticketId;
      return authorizeTicketAccess(req, res, next);
    } else {
      throw createAuthorizationError('Comment or ticket ID is required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Self-access middleware
 * Users can only access their own user data (except admins)
 */
export const authorizeSelfAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw createAuthError('Authentication required');
  }

  // Admins can access any user data
  if (req.user.role === 'ADMIN') {
    return next();
  }

  const targetUserId = req.params.id || req.params.userId;
  if (!targetUserId) {
    throw createAuthorizationError('User ID is required');
  }

  if (req.user.id !== targetUserId) {
    logSecurityEvent('AUTHZ_SELF_ACCESS_VIOLATION', {
      userId: req.user.id,
      targetUserId,
    }, req);
    throw createAuthorizationError('Access denied. You can only access your own data');
  }

  next();
};

/**
 * Role hierarchy check
 * Ensures user can only modify users with lower or equal role
 */
export const authorizeRoleHierarchy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw createAuthError('Authentication required');
    }

    const targetUserId = req.params.id;
    if (!targetUserId) {
      return next(); // Let other middleware handle missing ID
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw createAuthorizationError('Target user not found');
    }

    const roleHierarchy = { USER: 1, AGENT: 2, ADMIN: 3 };
    const userLevel = roleHierarchy[req.user.role];
    const targetLevel = roleHierarchy[targetUser.role];

    if (userLevel < targetLevel) {
      logSecurityEvent('AUTHZ_ROLE_HIERARCHY_VIOLATION', {
        userId: req.user.id,
        userRole: req.user.role,
        targetUserId,
        targetRole: targetUser.role,
      }, req);
      throw createAuthorizationError('Cannot modify user with higher role');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware combinations for common use cases
 */
export const requireAuth = [authenticate];
export const requireAdmin = [authenticate, authorize('ADMIN')];
export const requireAgent = [authenticate, authorize('AGENT', 'ADMIN')];
export const requireUser = [authenticate, authorize('USER', 'AGENT', 'ADMIN')];

export const requireSelfOrAdmin = [authenticate, authorizeSelfAccess];
export const requireTicketAccess = [authenticate, authorizeTicketAccess];
export const requireCommentAccess = [authenticate, authorizeCommentAccess];