import request from 'supertest';
import { app } from '@/server';
import { 
  setupTestDatabase, 
  teardownTestDatabase, 
  clearTestDatabase,
  createTestUser 
} from './database.setup';
import { PasswordService } from '@/utils/password';
import { JwtService } from '@/utils/jwt';

describe('Authentication', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'USER',
          },
          token: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // Verify token is valid
      const decoded = JwtService.decodeToken(response.body.data.token);
      expect(decoded.email).toBe(userData.email);
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPassword123!',
      };

      // Create user first
      await createTestUser({ 
        email: userData.email,
        password: await PasswordService.hashPassword(userData.password)
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RESOURCE_CONFLICT',
          message: 'User with this email already exists',
        },
      });
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'weak',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      const hashedPassword = await PasswordService.hashPassword('TestPassword123!');
      testUser = await createTestUser({
        email: 'test@example.com',
        password: hashedPassword,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: testUser.role,
          },
          token: expect.any(String),
          refreshToken: expect.any(String),
        },
      });
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Invalid email or password',
        },
      });
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Invalid email or password',
        },
      });
    });

    it('should reject login for inactive user', async () => {
      // Deactivate user
      const { userRepository } = await import('@/database/repositories');
      await userRepository.update(testUser.id, { isActive: false });

      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Account is deactivated',
        },
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const hashedPassword = await PasswordService.hashPassword('TestPassword123!');
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: hashedPassword,
      });

      const tokens = JwtService.generateTokenPair({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
      refreshToken = tokens.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
        },
      });
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
        },
      });
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
        },
      });
    });
  });

  describe('GET /api/auth/profile', () => {
    let accessToken: string;
    let testUser: any;

    beforeEach(async () => {
      const hashedPassword = await PasswordService.hashPassword('TestPassword123!');
      testUser = await createTestUser({
        email: 'test@example.com',
        password: hashedPassword,
      });

      accessToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role,
        },
      });

      // Ensure password is not included
      expect(response.body.data.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
        },
      });
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
        },
      });
    });
  });

  describe('POST /api/auth/change-password', () => {
    let accessToken: string;
    let testUser: any;

    beforeEach(async () => {
      const hashedPassword = await PasswordService.hashPassword('TestPassword123!');
      testUser = await createTestUser({
        email: 'test@example.com',
        password: hashedPassword,
      });

      accessToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Password changed successfully',
        },
      });
    });

    it('should reject with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(passwordData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Current password is incorrect',
        },
      });
    });

    it('should reject weak new password', async () => {
      const passwordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'weak',
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      const hashedPassword = await PasswordService.hashPassword('TestPassword123!');
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: hashedPassword,
      });

      accessToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
        },
      });
    });
  });

  describe('GET /api/auth/status', () => {
    it('should return authenticated status with valid token', async () => {
      const hashedPassword = await PasswordService.hashPassword('TestPassword123!');
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: hashedPassword,
      });

      const accessToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });

      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authenticated: true,
          user: {
            id: testUser.id,
            email: testUser.email,
            role: testUser.role,
          },
        },
      });
    });

    it('should return unauthenticated status without token', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authenticated: false,
          user: null,
        },
      });
    });
  });
});