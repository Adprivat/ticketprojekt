import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AuthService } from '../services/auth.service';
import { JwtService } from '../utils/jwt';
import { userRepository } from '../database/repositories';
import { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError,
  ConflictError 
} from '../middleware/errorHandler';
import { logAuthEvent, logBusinessEvent } from '../middleware/logging';
import { config } from '../config/env';

export class AuthController {
  /**
   * User login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await userRepository.findByEmail(email);
      if (!user) {
        logAuthEvent('LOGIN_FAILED_USER_NOT_FOUND', undefined, email, req.ip);
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        logAuthEvent('LOGIN_FAILED_USER_INACTIVE', user.id, email, req.ip);
        throw new UnauthorizedError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logAuthEvent('LOGIN_FAILED_INVALID_PASSWORD', user.id, email, req.ip);
        throw new UnauthorizedError('Invalid credentials');
      }

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const { accessToken, refreshToken } = JwtService.generateTokenPair(tokenPayload);

      // Log successful login
      logAuthEvent('LOGIN_SUCCESS', user.id, email, req.ip);
      logBusinessEvent('USER_LOGIN', {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          accessToken,
          refreshToken,
        },
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User registration (if enabled)
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

      // Create user
      const newUser = await userRepository.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'USER', // Default role
        isActive: true,
      });

      // Log registration
      logAuthEvent('REGISTRATION_SUCCESS', newUser.id, email, req.ip);
      logBusinessEvent('USER_REGISTERED', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
          },
        },
        message: 'Registration successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new BadRequestError('Refresh token is required');
      }

      // Verify refresh token
      const decoded = JwtService.verifyRefreshToken(refreshToken);

      // Find user
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new access token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = JwtService.generateAccessToken(tokenPayload);

      logAuthEvent('TOKEN_REFRESHED', user.id, user.email, req.ip);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
        },
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      logAuthEvent('LOGOUT_SUCCESS', user.id, user.email, req.ip);
      logBusinessEvent('USER_LOGOUT', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      // Get full user data
      const fullUser = await userRepository.findById(user.id);
      if (!fullUser) {
        throw new NotFoundError('User not found');
      }

      res.json({
        success: true,
        data: {
          id: fullUser.id,
          email: fullUser.email,
          firstName: fullUser.firstName,
          lastName: fullUser.lastName,
          role: fullUser.role,
          isActive: fullUser.isActive,
          createdAt: fullUser.createdAt,
          updatedAt: fullUser.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      // Get full user data
      const fullUser = await userRepository.findById(user.id);
      if (!fullUser) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, fullUser.password);
      if (!isCurrentPasswordValid) {
        logAuthEvent('PASSWORD_CHANGE_FAILED_INVALID_CURRENT', user.id, user.email, req.ip);
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      // Update password
      await userRepository.update(user.id, {
        password: hashedNewPassword,
      });

      logAuthEvent('PASSWORD_CHANGED', user.id, user.email, req.ip);
      logBusinessEvent('PASSWORD_CHANGED', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user's profile (email only for now)
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { email } = req.body as { email: string };

      // Find current user
      const fullUser = await userRepository.findById(user.id);
      if (!fullUser) {
        throw new NotFoundError('User not found');
      }

      if (email && email !== fullUser.email) {
        // Ensure email is unique
        const existing = await userRepository.findByEmail(email);
        if (existing && existing.id !== fullUser.id) {
          throw new ConflictError('Email is already in use');
        }

        await userRepository.update(fullUser.id, {
          email,
          updatedAt: new Date(),
        });

        logBusinessEvent('USER_EMAIL_UPDATED', { userId: fullUser.id, oldEmail: fullUser.email, newEmail: email });
      }

      const updated = await userRepository.findById(user.id);

      res.json({
        success: true,
        data: {
          id: updated!.id,
          email: updated!.email,
          firstName: updated!.firstName,
          lastName: updated!.lastName,
          role: updated!.role,
          isActive: updated!.isActive,
          createdAt: updated!.createdAt,
          updatedAt: updated!.updatedAt,
        },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate token
   */
  static async validateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = JwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      // Verify token
      const decoded = JwtService.verifyAccessToken(token);

      // Find user
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid token');
      }

      res.json({
        success: true,
        data: {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        },
      });
    } catch (error) {
      res.json({
        success: false,
        data: {
          valid: false,
        },
        error: {
          message: 'Invalid token',
        },
      });
    }
  }

  /**
   * Get authentication status
   */
  static async getAuthStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      res.json({
        success: true,
        data: {
          authenticated: !!user,
          user: user ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          } : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset (placeholder)
   */
  static async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      // Find user
      const user = await userRepository.findByEmail(email);
      
      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });

      // Log the attempt
      if (user) {
        logAuthEvent('PASSWORD_RESET_REQUESTED', user.id, email, req.ip);
      } else {
        logAuthEvent('PASSWORD_RESET_REQUESTED_INVALID_EMAIL', undefined, email, req.ip);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password (placeholder)
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      // This would normally verify a password reset token
      // For now, just return an error
      throw new BadRequestError('Password reset functionality not implemented');
    } catch (error) {
      next(error);
    }
  }
}