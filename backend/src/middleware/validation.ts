import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { logger } from "./logging";

/**
 * Generic validation middleware factory
 */
export const validate = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(
          `Params: ${error.details.map((d) => d.message).join(", ")}`
        );
      }
    }

    if (errors.length > 0) {
      logger.warn("Validation Error", {
        url: req.url,
        method: req.method,
        errors,
        body: req.body,
        query: req.query,
        params: req.params,
      });

      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: errors,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID parameter validation
  uuidParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),

  // Pagination query validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),

  // Search query validation
  search: Joi.object({
  // Accept both `q` and `search` as search terms
  q: Joi.string().min(1).max(255).optional(),
  search: Joi.string().min(1).max(255).optional(),
    status: Joi.string().valid("OPEN", "IN_PROGRESS", "CLOSED").optional(),
    priority: Joi.string().valid("LOW", "MEDIUM", "HIGH", "URGENT").optional(),
    assignedTo: Joi.string().uuid().optional(),
    createdBy: Joi.string().uuid().optional(),
  }),
};

/**
 * User validation schemas
 */
export const userSchemas = {
  create: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().min(1).max(100).required(),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string().valid("USER", "AGENT", "ADMIN").default("USER"),
  }),

  update: Joi.object({
    email: Joi.string().email().optional(),
    firstName: Joi.string().min(1).max(100).optional(),
    lastName: Joi.string().min(1).max(100).optional(),
    role: Joi.string().valid("USER", "AGENT", "ADMIN").optional(),
    isActive: Joi.boolean().optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
  }),

  // Profile/email update for current user
  profileUpdate: Joi.object({
    email: Joi.string().email().required(),
  }),

  // List query
  listQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('USER','AGENT','ADMIN').optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().max(255).optional(),
  }),
};

/**
 * Ticket validation schemas
 */
export const ticketSchemas = {
  create: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().min(1).max(5000).required(),
    priority: Joi.string()
      .valid("LOW", "MEDIUM", "HIGH", "URGENT")
      .default("MEDIUM"),
  }),

  update: Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    description: Joi.string().min(1).max(5000).optional(),
    status: Joi.string().valid("OPEN", "IN_PROGRESS", "CLOSED").optional(),
    priority: Joi.string().valid("LOW", "MEDIUM", "HIGH", "URGENT").optional(),
    assignedTo: Joi.string().uuid().allow(null).optional(),
  }),

  assign: Joi.object({
    assignedTo: Joi.string().uuid().required(),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid("OPEN", "IN_PROGRESS", "CLOSED").required(),
  }),
};

/**
 * Comment validation schemas
 */
export const commentSchemas = {
  create: Joi.object({
  // Allow empty string here so service can return specific error message after trimming
  content: Joi.string().max(2000).allow('').required(),
  }),

  update: Joi.object({
  // Allow empty string here so service can return specific error message after trimming
  content: Joi.string().max(2000).allow('').required(),
  }),
};

/**
 * Validation middleware for specific routes
 */
export const validateUserCreate = validate({ body: userSchemas.create });
export const validateUserUpdate = validate({
  body: userSchemas.update,
  params: commonSchemas.uuidParam,
});
export const validateUserLogin = validate({ body: userSchemas.login });
export const validateChangePassword = validate({
  body: userSchemas.changePassword,
});

export const validateProfileUpdate = validate({
  body: userSchemas.profileUpdate,
});

export const validateTicketCreate = validate({ body: ticketSchemas.create });
export const validateTicketUpdate = validate({
  body: ticketSchemas.update,
  params: commonSchemas.uuidParam,
});
export const validateTicketAssign = validate({
  body: ticketSchemas.assign,
  params: commonSchemas.uuidParam,
});
export const validateTicketStatus = validate({
  body: ticketSchemas.updateStatus,
  params: commonSchemas.uuidParam,
});

export const validateCommentCreate = validate({
  body: commentSchemas.create,
});
export const validateCommentUpdate = validate({
  body: commentSchemas.update,
  params: commonSchemas.uuidParam,
});

export const validateUuidParam = validate({ params: commonSchemas.uuidParam });
export const validatePagination = validate({ query: commonSchemas.pagination });
export const validateSearch = validate({
  query: commonSchemas.pagination.concat(commonSchemas.search),
});

// Specific validator for :ticketId params
export const validateTicketIdParam = validate({ params: Joi.object({ ticketId: Joi.string().uuid().required() }) });

/**
 * Custom validation helpers
 */
export const validateEmail = (email: string): boolean => {
  const emailSchema = Joi.string().email();
  const { error } = emailSchema.validate(email);
  return !error;
};

export const validateUuid = (uuid: string): boolean => {
  const uuidSchema = Joi.string().uuid();
  const { error } = uuidSchema.validate(uuid);
  return !error;
};

export const validatePassword = (
  password: string
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
