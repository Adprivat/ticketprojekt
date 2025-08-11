import request from 'supertest';
import { app } from '@/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
  createTestUser,
  createTestTicket,
  createTestComment,
  testHelpers,
} from './database.setup';
import { JwtService } from '@/utils/jwt';

describe('Comment CRUD Operations', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('POST /api/comments/ticket/:ticketId', () => {
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
        title: 'Test Comment Ticket',
      });
    });

    it('should create comment successfully for ticket creator', async () => {
      const commentData = {
        content: 'This is a test comment',
      };

      const response = await request(app)
        .post(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(commentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          content: commentData.content,
          ticketId: testTicket.id,
          authorId: testUser.id,
          author: {
            id: testUser.id,
            email: testUser.email,
          },
        },
      });
    });

    it('should allow agent to comment on any ticket', async () => {
      const commentData = {
        content: 'Agent comment on user ticket',
      };

      const response = await request(app)
        .post(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(commentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorId).toBe(testAgent.id);
    });

    it('should deny comment creation for users without ticket access', async () => {
      const commentData = {
        content: 'Unauthorized comment attempt',
      };

      const response = await request(app)
        .post(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(commentData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied to this ticket',
        },
      });
    });

    it('should reject empty comment content', async () => {
      const commentData = {
        content: '   ', // Only whitespace
      };

      const response = await request(app)
        .post(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(commentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Comment content cannot be empty',
        },
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/comments/ticket/${testTicket.id}`)
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

    it('should reject comment on non-existent ticket', async () => {
      const fakeTicketId = '123e4567-e89b-12d3-a456-426614174000';
      const commentData = {
        content: 'Comment on non-existent ticket',
      };

      const response = await request(app)
        .post(`/api/comments/ticket/${fakeTicketId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(commentData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject unauthenticated requests', async () => {
      const commentData = {
        content: 'Unauthenticated comment',
      };

      const response = await request(app)
        .post(`/api/comments/ticket/${testTicket.id}`)
        .send(commentData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/comments/ticket/:ticketId', () => {
    let userToken: string;
    let otherUserToken: string;
    let agentToken: string;
    let testUser: any;
    let otherUser: any;
    let testAgent: any;
    let testTicket: any;
    let testComments: any[];

    beforeEach(async () => {
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

      testTicket = await createTestTicket(testUser.id, {
        title: 'Ticket with Comments',
      });

      // Create test comments
      testComments = [
        await createTestComment(testTicket.id, testUser.id, {
          content: 'First comment by user',
        }),
        await createTestComment(testTicket.id, testAgent.id, {
          content: 'Reply by agent',
        }),
        await createTestComment(testTicket.id, testUser.id, {
          content: 'Follow-up by user',
        }),
      ];
    });

    it('should get ticket comments for ticket creator', async () => {
      const response = await request(app)
        .get(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1,
        },
      });

      expect(response.body.data).toHaveLength(3);
      
      // Comments should be ordered chronologically
      expect(response.body.data[0].content).toBe('First comment by user');
      expect(response.body.data[1].content).toBe('Reply by agent');
      expect(response.body.data[2].content).toBe('Follow-up by user');
    });

    it('should get ticket comments for agent', async () => {
      const response = await request(app)
        .get(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('should deny access to users without ticket access', async () => {
      const response = await request(app)
        .get(`/api/comments/ticket/${testTicket.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied to this ticket',
        },
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/comments/ticket/${testTicket.id}?page=1&limit=2`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(response.body.data).toHaveLength(2);
    });

    it('should return 404 for non-existent ticket', async () => {
      const fakeTicketId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/comments/ticket/${fakeTicketId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/comments/:id', () => {
    let userToken: string;
    let otherUserToken: string;
    let adminToken: string;
    let testUser: any;
    let otherUser: any;
    let testAdmin: any;
    let testTicket: any;
    let testComment: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      otherUser = await createTestUser({
        email: 'other@test.com',
        role: 'USER',
      });
      testAdmin = await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });

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
      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });

      testTicket = await createTestTicket(testUser.id);
      testComment = await createTestComment(testTicket.id, testUser.id, {
        content: 'Original comment content',
      });
    });

    it('should allow author to update their comment', async () => {
      const updateData = {
        content: 'Updated comment content',
      };

      const response = await request(app)
        .put(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testComment.id,
          content: updateData.content,
          authorId: testUser.id,
        },
      });
    });

    it('should allow admin to update any comment', async () => {
      const updateData = {
        content: 'Admin updated content',
      };

      const response = await request(app)
        .put(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(updateData.content);
    });

    it('should deny update to non-author users', async () => {
      const updateData = {
        content: 'Unauthorized update attempt',
      };

      const response = await request(app)
        .put(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Insufficient permissions to update this comment',
        },
      });
    });

    it('should reject empty content', async () => {
      const updateData = {
        content: '   ', // Only whitespace
      };

      const response = await request(app)
        .put(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Comment content cannot be empty',
        },
      });
    });

    it('should return 404 for non-existent comment', async () => {
      const fakeCommentId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        content: 'Update non-existent comment',
      };

      const response = await request(app)
        .put(`/api/comments/${fakeCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    let userToken: string;
    let otherUserToken: string;
    let adminToken: string;
    let testUser: any;
    let otherUser: any;
    let testAdmin: any;
    let testTicket: any;
    let testComment: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      otherUser = await createTestUser({
        email: 'other@test.com',
        role: 'USER',
      });
      testAdmin = await createTestUser({
        email: 'admin@test.com',
        role: 'ADMIN',
      });

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
      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });

      testTicket = await createTestTicket(testUser.id);
      testComment = await createTestComment(testTicket.id, testUser.id, {
        content: 'Comment to be deleted',
      });
    });

    it('should allow author to delete their comment', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Comment deleted successfully',
        },
      });
    });

    it('should allow admin to delete any comment', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny deletion to non-author users', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Only admins or comment authors can delete comments',
        },
      });
    });

    it('should return 404 for non-existent comment', async () => {
      const fakeCommentId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .delete(`/api/comments/${fakeCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/comments/my-comments', () => {
    let userToken: string;
    let testUser: any;
    let testTicket: any;

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

      testTicket = await createTestTicket(testUser.id);

      // Create user's comments
      await createTestComment(testTicket.id, testUser.id, {
        content: 'My first comment',
      });
      await createTestComment(testTicket.id, testUser.id, {
        content: 'My second comment',
      });
    });

    it('should get current user comments', async () => {
      const response = await request(app)
        .get('/api/comments/my-comments')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: expect.any(Object),
      });

      expect(response.body.data).toHaveLength(2);
      
      // All comments should belong to the current user
      response.body.data.forEach((comment: any) => {
        expect(comment.authorId).toBe(testUser.id);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/comments/my-comments?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
      });
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/comments/search', () => {
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

      // Create searchable comments
      const ticket = await createTestTicket(testUser.id);
      await createTestComment(ticket.id, testUser.id, {
        content: 'This is a searchable comment about database issues',
      });
      await createTestComment(ticket.id, testAgent.id, {
        content: 'Another comment about network problems',
      });
    });

    it('should search comments for agents', async () => {
      const response = await request(app)
        .get('/api/comments/search?q=database')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: expect.any(Object),
      });

      // Should find the comment containing "database"
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].content).toContain('database');
    });

    it('should deny search access to regular users', async () => {
      const response = await request(app)
        .get('/api/comments/search?q=database')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Only agents and admins can search comments',
        },
      });
    });

    it('should require search term', async () => {
      const response = await request(app)
        .get('/api/comments/search')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_SEARCH_TERM',
        },
      });
    });
  });

  describe('GET /api/comments/statistics', () => {
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

      // Create some comments for statistics
      const ticket = await createTestTicket(testUser.id);
      await createTestComment(ticket.id, testUser.id);
      await createTestComment(ticket.id, testAgent.id);
    });

    it('should get comment statistics for agents', async () => {
      const response = await request(app)
        .get('/api/comments/statistics')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalComments: expect.any(Number),
          commentsToday: expect.any(Number),
          commentsThisWeek: expect.any(Number),
          commentsThisMonth: expect.any(Number),
          averageCommentsPerTicket: expect.any(Number),
          topCommenters: expect.any(Array),
        },
      });
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .get('/api/comments/statistics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});