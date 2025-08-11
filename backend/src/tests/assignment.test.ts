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

describe('Assignment Functionality', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('POST /api/assignments/tickets/:id/assign', () => {
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
        title: 'Test Assignment Ticket',
      });
    });

    it('should assign ticket to agent successfully', async () => {
      const assignmentData = {
        assigneeId: testAgent.id,
        reason: 'Assigning to available agent',
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assignmentData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testTicket.id,
          assignedTo: testAgent.id,
          assignee: {
            id: testAgent.id,
            email: testAgent.email,
          },
        },
      });
    });

    it('should allow agent to assign tickets', async () => {
      const assignmentData = {
        assigneeId: testAgent.id,
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/assign`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(assignmentData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny assignment to regular users', async () => {
      const assignmentData = {
        assigneeId: testAgent.id,
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/assign`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(assignmentData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject assignment to regular user role', async () => {
      const assignmentData = {
        assigneeId: testUser.id, // Regular user cannot be assigned
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assignmentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Only agents and admins can be assigned tickets',
        },
      });
    });

    it('should validate assignee exists', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      const assignmentData = {
        assigneeId: fakeUserId,
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assignmentData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate ticket exists', async () => {
      const fakeTicketId = '123e4567-e89b-12d3-a456-426614174000';
      const assignmentData = {
        assigneeId: testAgent.id,
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${fakeTicketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assignmentData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
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

  describe('POST /api/assignments/tickets/:id/unassign', () => {
    let adminToken: string;
    let testAdmin: any;
    let testAgent: any;
    let testUser: any;
    let testTicket: any;

    beforeEach(async () => {
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

      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });

      // Create assigned ticket
      testTicket = await createTestTicket(testUser.id, {
        title: 'Assigned Ticket',
        assignedTo: testAgent.id,
      });
    });

    it('should unassign ticket successfully', async () => {
      const unassignData = {
        reason: 'Agent unavailable',
      };

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/unassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(unassignData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testTicket.id,
          assignedTo: null,
        },
      });
    });

    it('should reject unassigning unassigned ticket', async () => {
      // Create unassigned ticket
      const unassignedTicket = await createTestTicket(testUser.id, {
        title: 'Unassigned Ticket',
      });

      const response = await request(app)
        .post(`/api/assignments/tickets/${unassignedTicket.id}/unassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Ticket is not currently assigned',
        },
      });
    });
  });

  describe('POST /api/assignments/tickets/:id/auto-assign', () => {
    let adminToken: string;
    let testAdmin: any;
    let testAgent1: any;
    let testAgent2: any;
    let testUser: any;
    let testTicket: any;

    beforeEach(async () => {
      testAdmin = await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });
      testAgent1 = await createTestUser({
        email: 'agent1@test.com',
        role: 'AGENT',
      });
      testAgent2 = await createTestUser({
        email: 'agent2@test.com',
        role: 'AGENT',
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

      testTicket = await createTestTicket(testUser.id, {
        title: 'Auto Assignment Ticket',
      });
    });

    it('should auto-assign ticket to available agent', async () => {
      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/auto-assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testTicket.id,
          assignedTo: expect.any(String),
          assignee: expect.objectContaining({
            role: expect.stringMatching(/AGENT|ADMIN/),
          }),
        },
      });
    });

    it('should assign to agent with lower workload', async () => {
      // Give agent1 some tickets to increase workload
      await createTestTicket(testUser.id, {
        title: 'Agent1 Ticket 1',
        assignedTo: testAgent1.id,
      });
      await createTestTicket(testUser.id, {
        title: 'Agent1 Ticket 2',
        assignedTo: testAgent1.id,
      });

      const response = await request(app)
        .post(`/api/assignments/tickets/${testTicket.id}/auto-assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should prefer agent2 who has no tickets
      expect(response.body.data.assignedTo).toBe(testAgent2.id);
    });
  });

  describe('GET /api/assignments/assignees', () => {
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

      // Create additional assignees
      await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });
    });

    it('should get available assignees for agents', async () => {
      const response = await request(app)
        .get('/api/assignments/assignees')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });

      // Should include agents and admins, but not regular users
      response.body.data.forEach((assignee: any) => {
        expect(['AGENT', 'ADMIN']).toContain(assignee.role);
        expect(assignee.isActive).toBe(true);
      });
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .get('/api/assignments/assignees')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/assignments/workloads', () => {
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

      // Create some tickets to test workload calculation
      const testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });

      await createTestTicket(testUser.id, {
        title: 'Open Ticket',
        assignedTo: testAgent.id,
        status: 'OPEN',
      });
      await createTestTicket(testUser.id, {
        title: 'In Progress Ticket',
        assignedTo: testAgent.id,
        status: 'IN_PROGRESS',
      });
    });

    it('should get assignee workloads', async () => {
      const response = await request(app)
        .get('/api/assignments/workloads')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });

      // Find the test agent in workloads
      const agentWorkload = response.body.data.find(
        (w: any) => w.userId === testAgent.id
      );
      expect(agentWorkload).toMatchObject({
        userId: testAgent.id,
        user: {
          id: testAgent.id,
          role: 'AGENT',
        },
        openTickets: 1,
        inProgressTickets: 1,
        totalActiveTickets: 2,
        isAvailable: expect.any(Boolean),
      });
    });
  });

  describe('POST /api/assignments/bulk-assign', () => {
    let adminToken: string;
    let testAdmin: any;
    let testAgent: any;
    let testUser: any;
    let testTickets: any[];

    beforeEach(async () => {
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

      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });

      // Create multiple test tickets
      testTickets = [
        await createTestTicket(testUser.id, { title: 'Bulk Ticket 1' }),
        await createTestTicket(testUser.id, { title: 'Bulk Ticket 2' }),
        await createTestTicket(testUser.id, { title: 'Bulk Ticket 3' }),
      ];
    });

    it('should bulk assign tickets successfully', async () => {
      const bulkAssignData = {
        ticketIds: testTickets.map(t => t.id),
        assigneeId: testAgent.id,
        reason: 'Bulk assignment for efficiency',
      };

      const response = await request(app)
        .post('/api/assignments/bulk-assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bulkAssignData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          successful: testTickets.map(t => t.id),
          failed: [],
        },
      });
    });

    it('should handle partial failures in bulk assignment', async () => {
      const fakeTicketId = '123e4567-e89b-12d3-a456-426614174000';
      const bulkAssignData = {
        ticketIds: [...testTickets.map(t => t.id), fakeTicketId],
        assigneeId: testAgent.id,
      };

      const response = await request(app)
        .post('/api/assignments/bulk-assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bulkAssignData)
        .expect(200);

      expect(response.body.data.successful).toHaveLength(3);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].ticketId).toBe(fakeTicketId);
    });

    it('should validate bulk assignment input', async () => {
      const response = await request(app)
        .post('/api/assignments/bulk-assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ticketIds: [], // Empty array
          assigneeId: testAgent.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/assignments/tickets/:id/recommendations', () => {
    let agentToken: string;
    let testAgent: any;
    let testUser: any;
    let testTicket: any;

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

      testTicket = await createTestTicket(testUser.id, {
        title: 'Recommendation Test Ticket',
        priority: 'HIGH',
      });

      // Create additional assignees for better recommendations
      await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });
    });

    it('should get assignment recommendations', async () => {
      const response = await request(app)
        .get(`/api/assignments/tickets/${testTicket.id}/recommendations`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });

      // Each recommendation should have required fields
      response.body.data.forEach((rec: any) => {
        expect(rec).toMatchObject({
          userId: expect.any(String),
          user: expect.objectContaining({
            role: expect.stringMatching(/AGENT|ADMIN/),
          }),
          score: expect.any(Number),
          reasons: expect.any(Array),
          currentWorkload: expect.any(Number),
        });
      });

      // Should be sorted by score (descending)
      for (let i = 1; i < response.body.data.length; i++) {
        expect(response.body.data[i - 1].score).toBeGreaterThanOrEqual(
          response.body.data[i].score
        );
      }
    });
  });
});