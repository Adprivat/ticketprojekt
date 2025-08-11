import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { 
  validateUserLogin,
  validateUserCreate,
  validateChangePassword,
  validateProfileUpdate,
} from '../middleware/validation';
import { 
  authenticate,
  optionalAuth,
} from '../middleware/auth';
import { authSecurity } from '../middleware/security';

const router = Router();

/**
 * Authentication routes
 */

// Public routes (no authentication required)
router.post('/login', authSecurity, validateUserLogin, AuthController.login);
router.post('/register', authSecurity, validateUserCreate, AuthController.register);
router.post('/refresh', authSecurity, AuthController.refreshToken);
router.post('/forgot-password', authSecurity, AuthController.requestPasswordReset);
router.post('/reset-password', authSecurity, AuthController.resetPassword);
router.post('/validate-token', authSecurity, AuthController.validateToken);

// Protected routes (authentication required)
router.post('/logout', authenticate, AuthController.logout);
router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, validateProfileUpdate, AuthController.updateProfile);
router.post('/change-password', authenticate, validateChangePassword, AuthController.changePassword);

// Optional authentication routes
router.get('/status', optionalAuth, AuthController.getAuthStatus);

export default router;