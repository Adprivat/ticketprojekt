import request from 'supertest';
import { app } from '@/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
  createTestUser,
  createTestTicket,
} from './database.setup';
import { JwtService } from '@/utils/jwt';

describe('Status Management', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('PATCH /api/status/tickets/:id', () => {
    let adminToken: string;
    let agentToken: string;
    let userToken: string;
    let testAdmin: any;
    let testAgent: any;
    let testUser: any;
    let testTicket: any;

    beforeEach(async () => {
      // Create test users
      testAdmin = await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });

      // Generate tokens
      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
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

      // Create test ticket
      testTicket = await createTestTicket(testUser.id, {
        title: 'Status Test Ticket',
        status: 'OPEN',
        assignedTo: testAgent.id,
      });
    });

    it('should change ticket status from OPEN to IN_PROGRESS', async () => {
      const statusData = {
        status: 'IN_PROGRESS',
        reason: 'Starting work on this ticket',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testTicket.id,
          status: 'IN_PROGRESS',
        },
      });
    });

    it('should allow admin to change status', async () => {
      const statusData = {
        status: 'IN_PROGRESS',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny status change to regular users', async () => {
      const statusData = {
        status: 'IN_PROGRESS',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid status transitions', async () => {
      // Try to change from OPEN directly to CLOSED without assignment
      const unassignedTicket = await createTestTicket(testUser.id, {
        title: 'Unassigned Ticket',
        status: 'OPEN',
      });

      const statusData = {
        status: 'CLOSED',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${unassignedTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Comment is required'),
        },
      });
    });

    it('should require comment for certain transitions', async () => {
      const statusData = {
        status: 'CLOSED',
        // Missing required comment
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Comment is required'),
        },
      });
    });

    it('should allow status change with required comment', async () => {
      const statusData = {
        status: 'CLOSED',
        comment: 'Issue resolved successfully',
        reason: 'Problem fixed',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'CLOSED',
        },
      });
    });

    it('should reject same status change', async () => {
      const statusData = {
        status: 'OPEN', // Same as current status
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Ticket is already in OPEN status',
        },
      });
    });

    it('should validate ticket exists', async () => {
      const fakeTicketId = '123e4567-e89b-12d3-a456-426614174000';
      const statusData = {
        status: 'IN_PROGRESS',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${fakeTicketId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate status enum', async () => {
      const statusData = {
        status: 'INVALID_STATUS',
      };

      const response = await request(app)
        .patch(`/api/status/tickets/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });

  describe('GET /api/status/transitions', () => {
    let agentToken: string;

    beforeEach(async () => {
      const testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });

      agentToken = JwtService.generateAccessToken({
        userId: testAgent.id,
        email: testAgent.email,
        role: testAgent.role,
      });
    });

    it('should get valid transitions for OPEN status', async () => {
      const response = await request(app)
        .get('/api/status/transitions?status=OPEN')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          currentStatus: 'OPEN',
          validTransitions: expect.arrayContaining(['IN_PROGRESS', 'CLOSED']),
          userRole: 'AGENT',
        },
      });
    });

    it('should get valid transitions for IN_PROGRESS status', async () => {
      const response = await request(app)
        .get('/api/status/transitions?status=IN_PROGRESS')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.data.validTransitions).toEqual(
        expect.arrayContaining(['OPEN', 'CLOSED'])
      );
    });

    it('should require status parameter', async () => {
      const response = await request(app)
        .get('/api/status/transitions')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_STATUS',
        },
      });
    });
  });

  describe('GET /api/status/workflow', () => {
    let userToken: string;

    beforeEach(async () => {
      const testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });

      userToken = JwtService.generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should get status workflow information', async () => {
      const response = await request(app)
        .get('/api/status/workflow')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          statuses: expect.arrayContaining(['OPEN', 'IN_PROGRESS', 'CLOSED']),
          transitions: expect.any(Array),
          workflow: expect.objectContaining({
            OPEN: expect.any(Array),
            IN_PROGRESS: expect.any(Array),
            CLOSED: expect.any(Array),
          }),
        },
      });
    });
  });

  describe('GET /api/status/statistics', () => {
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

      // Create tickets with different statuses
      await createTestTicket(testUser.id, { status: 'OPEN' });
      await createTestTicket(testUser.id, { status: 'IN_PROGRESS' });
      await createTestTicket(testUser.id, { status: 'CLOSED' });
    });

    it('should get status statistics for agents', async () => {
      const response = await request(app)
        .get('/api/status/statistics')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          open: expect.any(Number),
          inProgress: expect.any(Number),
          closed: expect.any(Number),
          total: expect.any(Number),
          statusDistribution: {
            OPEN: {
              count: expect.any(Number),
              percentage: expect.any(Number),
            },
            IN_PROGRESS: {
              count: expect.any(Number),
              percentage: expect.any(Number),
            },
            CLOSED: {
              count: expect.any(Number),
              percentage: expect.any(Number),
            },
          },
        },
      });
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .get('/api/status/statistics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/status/bulk-change', () => {
    let adminToken: string;
    let testAdmin: any;
    let testUser: any;
    let testTickets: any[];

    beforeEach(async () => {
      testAdmin = await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });

      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });

      // Create multiple test tickets
      testTickets = [
        await createTestTicket(testUser.id, { 
          title: 'Bulk Status Ticket 1',
          status: 'OPEN',
          assignedTo: testAdmin.id,
        }),
        await createTestTicket(testUser.id, { 
          title: 'Bulk Status Ticket 2',
          status: 'OPEN',
          assignedTo: testAdmin.id,
        }),
        await createTestTicket(testUser.id, { 
          title: 'Bulk Status Ticket 3',
          status: 'OPEN',
          assignedTo: testAdmin.id,
        }),
      ];
    });

    it('should bulk change status successfully', async () => {
      const bulkStatusData = {
        ticketIds: testTickets.map(t => t.id),
        status: 'IN_PROGRESS',
        reason: 'Bulk status change for efficiency',
      };

      const response = await request(app)
        .patch('/api/status/bulk-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bulkStatusData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          successful: testTickets.map(t => t.id),
          failed: [],
        },
      });
    });

    it('should handle partial failures in bulk status change', async () => {
      const fakeTicketId = '123e4567-e89b-12d3-a456-426614174000';
      const bulkStatusData = {
        ticketIds: [...testTickets.map(t => t.id), fakeTicketId],
        status: 'IN_PROGRESS',
      };

      const response = await request(app)
        .patch('/api/status/bulk-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bulkStatusData)
        .expect(200);

      expect(response.body.data.successful).toHaveLength(3);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].ticketId).toBe(fakeTicketId);
    });

    it('should validate bulk status change input', async () => {
      const response = await request(app)
        .patch('/api/status/bulk-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ticketIds: [], // Empty array
          status: 'IN_PROGRESS',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/status/:status/tickets', () => {
    let agentToken: string;
    let userToken: string;
    let testAgent: any;
    let testUser: any;

    beforeEach(async () => {
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });
      testUser = await createTestUser({
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

      // Create tickets with different statuses
      await createTestTicket(testUser.id, { 
        title: 'Open Ticket 1',
        status: 'OPEN' 
      });
      await createTestTicket(testUser.id, { 
        title: 'Open Ticket 2',
        status: 'OPEN' 
      });
      await createTestTicket(testUser.id, { 
        title: 'In Progress Ticket',
        status: 'IN_PROGRESS' 
      });
    });

    it('should get tickets by status for agents', async () => {
      const response = await request(app)
        .get('/api/status/OPEN/tickets')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });

      // All returned tickets should have OPEN status
      response.body.data.forEach((ticket: any) => {
        expect(ticket.status).toBe('OPEN');
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/status/OPEN/tickets?page=1&limit=1')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should filter tickets for regular users', async () => {
      const response = await request(app)
        .get('/api/status/OPEN/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // User should only see their own tickets
      response.body.data.forEach((ticket: any) => {
        expect(ticket.createdBy).toBe(testUser.id);
      });
    });
  });

  describe('GET /api/status/can-change', () => {
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

    it('should check if agent can change status', async () => {
      const response = await request(app)
        .get('/api/status/can-change?from=OPEN&to=IN_PROGRESS')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          canChange: true,
          userRole: 'AGENT',
          from: 'OPEN',
          to: 'IN_PROGRESS',
        },
      });
    });

    it('should check if user cannot change status', async () => {
      const response = await request(app)
        .get('/api/status/can-change?from=OPEN&to=IN_PROGRESS')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          canChange: false,
          userRole: 'USER',
        },
      });
    });

    it('should require both from and to parameters', async () => {
      const response = await request(app)
        .get('/api/status/can-change?from=OPEN')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
        },
      });
    });
  });
});