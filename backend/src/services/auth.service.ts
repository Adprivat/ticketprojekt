import { User, Role } from "@prisma/client";
import { userRepository } from "@/database/repositories";
import { JwtService } from "@/utils/jwt";
import { PasswordService } from "@/utils/password";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  BadRequestError,
  createAuthError,
  createConflictError,
  createNotFoundError,
} from "@/middleware/errorHandler";
import { logAuthEvent, logBusinessEvent } from "@/middleware/logging";
import { LoginRequest, AuthResponse, JwtPayload } from "@/types";

/**
 * Authentication service
 */
export class AuthService {
  /**
   * User login
   */
  static async login(
    loginData: LoginRequest,
    ip?: string
  ): Promise<AuthResponse> {
    const { email, password } = loginData;

    try {
      // Find user by email
      const user = await userRepository.findByEmail(email);
      if (!user) {
        logAuthEvent("LOGIN_FAILED_USER_NOT_FOUND", undefined, email, ip);
        throw createAuthError("Invalid email or password");
      }

      // Check if user is active
      if (!user.isActive) {
        logAuthEvent("LOGIN_FAILED_USER_INACTIVE", user.id, email, ip);
        throw createAuthError("Account is deactivated");
      }

      // Verify password
      const isPasswordValid = await PasswordService.timeSafeVerify(
        password,
        user.password
      );
      if (!isPasswordValid) {
        logAuthEvent("LOGIN_FAILED_INVALID_PASSWORD", user.id, email, ip);
        throw createAuthError("Invalid email or password");
      }

      // Check if password needs rehashing
      const newHash = await PasswordService.rehashIfNeeded(
        password,
        user.password
      );
      if (newHash) {
        await userRepository.update(user.id, { password: newHash });
        logBusinessEvent("PASSWORD_REHASHED", { userId: user.id });
      }

      // Generate tokens
      const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = JwtService.generateTokenPair(tokenPayload);

      logAuthEvent("LOGIN_SUCCESS", user.id, email, ip);
      logBusinessEvent("USER_LOGIN", { userId: user.id, email });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
  } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      logAuthEvent("LOGIN_ERROR", undefined, email, ip);
      throw createAuthError("Login failed");
    }
  }

  /**
   * User registration
   */
  static async register(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: Role;
  }): Promise<AuthResponse> {
    const { email, firstName, lastName, password, role = "USER" } = userData;

    try {
      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        logBusinessEvent("REGISTRATION_FAILED_EMAIL_EXISTS", { email });
        throw createConflictError("User with this email already exists");
      }

      // Hash password
      const hashedPassword = await PasswordService.hashPassword(password);

      // Create user
      const user = await userRepository.create({
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role,
        isActive: true,
      });

      // Generate tokens
      const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = JwtService.generateTokenPair(tokenPayload);

      logBusinessEvent("USER_REGISTERED", {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      logBusinessEvent("REGISTRATION_ERROR", { email, error: error instanceof Error ? error.message : String(error) });
      throw new BadRequestError("Registration failed");
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const decoded = JwtService.verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        logAuthEvent(
          "REFRESH_FAILED_INVALID_USER",
          decoded.userId,
          decoded.email
        );
        throw createAuthError(
          "User account is not valid or has been deactivated"
        );
      }

      // Generate new access token
      const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = JwtService.generateAccessToken(tokenPayload);

      logAuthEvent("TOKEN_REFRESHED", user.id, user.email);

      return { accessToken };
  } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      logAuthEvent("REFRESH_ERROR", undefined, undefined);
      throw createAuthError("Token refresh failed");
    }
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user
      const user = await userRepository.findById(userId);
      if (!user) {
        throw createNotFoundError("User", userId);
      }

      // Verify current password
      const isCurrentPasswordValid = await PasswordService.verifyPassword(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        logAuthEvent(
          "PASSWORD_CHANGE_FAILED_INVALID_CURRENT",
          userId,
          user.email
        );
        throw createAuthError("Current password is incorrect");
      }

      // Hash new password
      const hashedNewPassword = await PasswordService.hashPassword(newPassword);

      // Update password
      await userRepository.update(userId, {
        password: hashedNewPassword,
        updatedAt: new Date(),
      });

      logAuthEvent("PASSWORD_CHANGED", userId, user.email);
      logBusinessEvent("PASSWORD_CHANGED", { userId });
  } catch (error) {
      if (
        error instanceof UnauthorizedError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      logAuthEvent("PASSWORD_CHANGE_ERROR", userId);
      throw new BadRequestError("Password change failed");
    }
  }

  /**
   * Generate password reset token
   */
  static async generatePasswordResetToken(
    email: string
  ): Promise<{ token: string; expires: Date }> {
    try {
      const user = await userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        logBusinessEvent("PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL", { email });
        throw createNotFoundError("User with this email");
      }

      if (!user.isActive) {
        logBusinessEvent("PASSWORD_RESET_REQUESTED_INACTIVE_USER", {
          userId: user.id,
          email,
        });
        throw createAuthError("Account is deactivated");
      }

      const resetData = PasswordService.generateResetToken();

      // In a real application, you would store this token in the database
      // For now, we'll just return it
      logBusinessEvent("PASSWORD_RESET_TOKEN_GENERATED", {
        userId: user.id,
        email,
        expires: resetData.expires,
      });

      return resetData;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof UnauthorizedError
      ) {
        throw error;
      }
      logBusinessEvent("PASSWORD_RESET_TOKEN_ERROR", {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError("Password reset token generation failed");
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(
    email: string,
    token: string,
    newPassword: string
  ): Promise<void> {
    try {
      // In a real application, you would verify the token from the database
      // For now, we'll just validate the user exists
      const user = await userRepository.findByEmail(email);
      if (!user) {
        throw createNotFoundError("User with this email");
      }

      if (!user.isActive) {
        throw createAuthError("Account is deactivated");
      }

      // Hash new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update password
      await userRepository.update(user.id, {
        password: hashedPassword,
        updatedAt: new Date(),
      });

      logAuthEvent("PASSWORD_RESET", user.id, user.email);
      logBusinessEvent("PASSWORD_RESET", { userId: user.id, email });
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof UnauthorizedError
      ) {
        throw error;
      }
      logBusinessEvent("PASSWORD_RESET_ERROR", { email, error: error instanceof Error ? error.message : String(error) });
      throw new BadRequestError("Password reset failed");
    }
  }

  /**
   * Logout (invalidate token)
   */
  static async logout(userId: string): Promise<void> {
    try {
      // In a real application, you might want to blacklist the token
      // For now, we'll just log the logout event
      const user = await userRepository.findById(userId);
      if (user) {
        logAuthEvent("LOGOUT", userId, user.email);
        logBusinessEvent("USER_LOGOUT", { userId });
      }
    } catch (error) {
      logAuthEvent("LOGOUT_ERROR", userId);
    }
  }

  /**
   * Validate token and get user
   */
  static async validateToken(token: string): Promise<User | null> {
    try {
      const decoded = JwtService.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.userId);

      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(
    userId: string
  ): Promise<Omit<User, "password"> | null> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        return null;
      }

      // Remove password from response
      const { password, ...userProfile } = user;
      return userProfile;
    } catch (error) {
      return null;
    }
  }
}
