import bcrypt from 'bcrypt';
import { config } from '@/config/env';
import { validatePassword } from '@/middleware/validation';

/**
 * Password service for secure password handling
 */
export class PasswordService {
  /**
   * Hash password with bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    // Validate password strength first
    const validation = validatePassword(password);
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      const saltRounds = config.security.bcryptRounds;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return hashedPassword;
    } catch (error) {
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hashedPassword);
      return isValid;
    } catch (error) {
      throw new Error('Failed to verify password');
    }
  }

  /**
   * Generate secure random password
   */
  static generateRandomPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if password needs rehashing (if bcrypt rounds changed)
   */
  static async needsRehashing(hashedPassword: string): Promise<boolean> {
    try {
      const currentRounds = config.security.bcryptRounds;
      const hashRounds = bcrypt.getRounds(hashedPassword);
      return hashRounds !== currentRounds;
    } catch (error) {
      // If we can't determine rounds, assume it needs rehashing
      return true;
    }
  }

  /**
   * Rehash password if needed
   */
  static async rehashIfNeeded(password: string, currentHash: string): Promise<string | null> {
    const needsRehash = await this.needsRehashing(currentHash);
    if (needsRehash) {
      return await this.hashPassword(password);
    }
    return null;
  }

  /**
   * Generate password reset token
   */
  static generateResetToken(): { token: string; expires: Date } {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry
    
    return { token, expires };
  }

  /**
   * Validate password strength (detailed)
   */
  static validatePasswordStrength(password: string): {
    score: number;
    feedback: string[];
    isStrong: boolean;
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('Password should be at least 8 characters long');

    if (password.length >= 12) score += 1;
    else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score += 1;
    else feedback.push('Add special characters');

    // Pattern checks
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push('Avoid repeating characters');

    if (!/123|abc|qwe|asd|zxc/i.test(password)) score += 1;
    else feedback.push('Avoid common patterns');

    const isStrong = score >= 6;

    return {
      score,
      feedback,
      isStrong,
    };
  }

  /**
   * Check against common passwords
   */
  static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'shadow', 'superman', 'michael',
      'football', 'baseball', 'liverpool', 'jordan', 'princess',
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Time-safe password comparison to prevent timing attacks
   */
  static async timeSafeVerify(password: string, hashedPassword: string): Promise<boolean> {
    try {
      // Always perform the bcrypt comparison to prevent timing attacks
      const isValid = await bcrypt.compare(password, hashedPassword);
      
      // Add a small random delay to make timing analysis harder
      const delay = Math.random() * 10;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return isValid;
    } catch (error) {
      // Even on error, add delay to prevent timing analysis
      const delay = Math.random() * 10;
      await new Promise(resolve => setTimeout(resolve, delay));
      throw new Error('Failed to verify password');
    }
  }
}