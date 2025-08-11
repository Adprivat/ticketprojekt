import request from 'supertest';
import { app } from '@/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
  createTestUser,
  createTestTicket,
  testHelpers,
} from './database.setup';
import { JwtService } from '@/utils/jwt';
import { PasswordService } from '@/utils/password';

describe('Ticket CRUD Operations', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('POST /api/tickets', () => {
    let userToken: string;
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should create a ticket successfully', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'This is a test ticket description',
        priority: 'MEDIUM',
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          title: ticketData.title,
          description: ticketData.description,
          priority: ticketData.priority,
          status: 'OPEN',
          createdBy: testUser.id,
          assignedTo: null,
          creator: {
            id: testUser.id,
            email: testUser.email,
          },
        },
      });
    });

    it('should reject ticket creation without authentication', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'This is a test ticket description',
        priority: 'MEDIUM',
      };

      const response = await request(app)
        .post('/api/tickets')
        .send(ticketData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should validate priority enum', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'This is a test ticket description',
        priority: 'INVALID_PRIORITY',
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(ticketData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tickets', () => {
    let userToken: string;
    let agentToken: string;
    let testUser: any;
    let testAgent: any;
    let testTickets: any[];

    beforeEach(async () => {
      // Create test users
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });

      // Generate tokens
      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
      agentToken = JwtService.generateAccessToken({
        userId: testAgent.id,
        email: testAgent.email,
        role: testAgent.role,
      });

      // Create test tickets
      testTickets = [
        await createTestTicket(testUser.id, {
          title: 'User Ticket 1',
          priority: 'HIGH',
        }),
        await createTestTicket(testUser.id, {
          title: 'User Ticket 2',
          priority: 'LOW',
          assignedTo: testAgent.id,
        }),
      ];
    });

    it('should get tickets for authenticated user', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });

      // User should see their own tickets
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/tickets?page=1&limit=1')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
      });
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/tickets?status=OPEN')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All returned tickets should have OPEN status
      response.body.data.forEach((ticket: any) => {
        expect(ticket.status).toBe('OPEN');
      });
    });

    it('should support filtering by priority', async () => {
      const response = await request(app)
        .get('/api/tickets?priority=HIGH')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All returned tickets should have HIGH priority
      response.body.data.forEach((ticket: any) => {
        expect(ticket.priority).toBe('HIGH');
      });
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/tickets?search=User Ticket 1')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tickets/:id', () => {
    let userToken: string;
    let otherUserToken: string;
    let agentToken: string;
    let testUser: any;
    let otherUser: any;
    let testAgent: any;
    let testTicket: any;

    beforeEach(async () => {
      // Create test users
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      otherUser = await createTestUser({
        email: 'other@test.com',
        role: 'USER',
      });
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });

      // Generate tokens
      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
      otherUserToken = JwtService.generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
        role: otherUser.role,
      });
      agentToken = JwtService.generateAccessToken({
        userId: testAgent.id,
        email: testAgent.email,
        role: testAgent.role,
      });

      // Create test ticket
      testTicket = await createTestTicket(testUser.id, {
        title: 'Test Ticket',
      });
    });

    it('should get ticket by ID for creator', async () => {
      const response = await request(app)
        .get(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testTicket.id,
          title: testTicket.title,
          createdBy: testUser.id,
        },
      });
    });

    it('should get ticket by ID for agent', async () => {
      const response = await request(app)
        .get(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny access to other users', async () => {
      const response = await request(app)
        .get(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent ticket', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/api/tickets/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
        },
      });
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/tickets/invalid-uuid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tickets/:id', () => {
    let userToken: string;
    let agentToken: string;
    let testUser: any;
    let testAgent: any;
    let testTicket: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });

      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
      agentToken = JwtService.generateAccessToken({
        userId: testAgent.id,
        email: testAgent.email,
        role: testAgent.role,
      });

      testTicket = await createTestTicket(testUser.id, {
        title: 'Original Title',
      });
    });

    it('should update ticket successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 'HIGH',
      };

      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testTicket.id,
          title: updateData.title,
          description: updateData.description,
          priority: updateData.priority,
        },
      });
    });

    it('should allow agents to update status', async () => {
      const updateData = {
        status: 'IN_PROGRESS',
      };

      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.status).toBe('IN_PROGRESS');
    });

    it('should allow agents to assign tickets', async () => {
      const updateData = {
        assignedTo: testAgent.id,
      };

      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.assignedTo).toBe(testAgent.id);
    });

    it('should validate assignee exists', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        assignedTo: fakeUserId,
      };

      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid status values', async () => {
      const updateData = {
        status: 'INVALID_STATUS',
      };

      const response = await request(app)
        .put(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    let userToken: string;
    let adminToken: string;
    let otherUserToken: string;
    let testUser: any;
    let testAdmin: any;
    let otherUser: any;
    let testTicket: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      testAdmin = await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });
      otherUser = await createTestUser({
        email: 'other@test.com',
        role: 'USER',
      });

      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });
      otherUserToken = JwtService.generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
        role: otherUser.role,
      });

      testTicket = await createTestTicket(testUser.id);
    });

    it('should allow creator to delete ticket', async () => {
      const response = await request(app)
        .delete(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Ticket deleted successfully',
        },
      });
    });

    it('should allow admin to delete any ticket', async () => {
      const response = await request(app)
        .delete(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny deletion to other users', async () => {
      const response = await request(app)
        .delete(`/api/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent ticket', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .delete(`/api/tickets/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tickets/assigned/me', () => {
    let agentToken: string;
    let testAgent: any;

    beforeEach(async () => {
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });

      agentToken = JwtService.generateAccessToken({
        userId: testAgent.id,
        email: testAgent.email,
        role: testAgent.role,
      });

      // Create some assigned tickets
      const creator = await createTestUser({
        email: 'creator@test.com',
        role: 'USER',
      });

      await createTestTicket(creator.id, {
        title: 'Assigned Ticket 1',
        assignedTo: testAgent.id,
      });
      await createTestTicket(creator.id, {
        title: 'Assigned Ticket 2',
        assignedTo: testAgent.id,
        status: 'IN_PROGRESS',
      });
    });

    it('should get assigned tickets for current user', async () => {
      const response = await request(app)
        .get('/api/tickets/assigned/me')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: expect.any(Object),
      });

      // All tickets should be assigned to the current user
      response.body.data.forEach((ticket: any) => {
        expect(ticket.assignedTo).toBe(testAgent.id);
      });
    });

    it('should support status filtering', async () => {
      const response = await request(app)
        .get('/api/tickets/assigned/me?status=IN_PROGRESS')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((ticket: any) => {
        expect(ticket.status).toBe('IN_PROGRESS');
      });
    });
  });

  describe('GET /api/tickets/statistics', () => {
    let agentToken: string;
    let userToken: string;

    beforeEach(async () => {
      const testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });
      const testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });

      agentToken = JwtService.generateAccessToken({
        userId: testAgent.id,
        email: testAgent.email,
        role: testAgent.role,
      });
      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should get statistics for agents', async () => {
      const response = await request(app)
        .get('/api/tickets/statistics')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          total: expect.any(Number),
          open: expect.any(Number),
          inProgress: expect.any(Number),
          closed: expect.any(Number),
          unassigned: expect.any(Number),
        },
      });
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .get('/api/tickets/statistics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});