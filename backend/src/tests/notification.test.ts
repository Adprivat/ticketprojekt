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
import { NotificationService } from '@/services/notification.service';

describe('Notification System', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    // Clear notifications between tests
    NotificationService.clearAllNotifications = jest.fn().mockImplementation((userId: string) => {
      return 0;
    });
  });

  describe('NotificationService', () => {
    let testUser: any;
    let testAgent: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
        role: 'USER',
      });
      testAgent = await createTestUser({
        email: 'agent@test.com',
        role: 'AGENT',
      });
    });

    describe('createNotification', () => {
      it('should create notification successfully', async () => {
        const notification = await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'New Ticket',
          'A new ticket has been created',
          {
            ticketId: 'test-ticket-id',
            actionBy: testAgent,
          }
        );

        expect(notification).toMatchObject({
          id: expect.any(String),
          type: 'ticket_created',
          title: 'New Ticket',
          message: 'A new ticket has been created',
          userId: testUser.id,
          ticketId: 'test-ticket-id',
          actionBy: {
            id: testAgent.id,
            name: `${testAgent.firstName} ${testAgent.lastName}`,
            email: testAgent.email,
          },
          read: false,
          createdAt: expect.any(Date),
        });
      });

      it('should store notification for user', async () => {
        await NotificationService.createNotification(
          testUser.id,
          'ticket_assigned',
          'Ticket Assigned',
          'A ticket has been assigned to you'
        );

        const notifications = NotificationService.getUserNotifications(testUser.id);
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('ticket_assigned');
      });
    });

    describe('getUserNotifications', () => {
      beforeEach(async () => {
        // Create multiple notifications
        await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'First Notification',
          'First message'
        );
        await NotificationService.createNotification(
          testUser.id,
          'ticket_assigned',
          'Second Notification',
          'Second message'
        );
        await NotificationService.createNotification(
          testUser.id,
          'comment_added',
          'Third Notification',
          'Third message'
        );
      });

      it('should return user notifications', async () => {
        const notifications = NotificationService.getUserNotifications(testUser.id);
        
        expect(notifications).toHaveLength(3);
        // Should be ordered by creation time (newest first)
        expect(notifications[0].title).toBe('Third Notification');
        expect(notifications[1].title).toBe('Second Notification');
        expect(notifications[2].title).toBe('First Notification');
      });

      it('should support pagination', async () => {
        const notifications = NotificationService.getUserNotifications(testUser.id, 2, 1);
        
        expect(notifications).toHaveLength(2);
        expect(notifications[0].title).toBe('Second Notification');
        expect(notifications[1].title).toBe('First Notification');
      });
    });

    describe('getUnreadCount', () => {
      it('should return correct unread count', async () => {
        await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Unread 1',
          'Message 1'
        );
        await NotificationService.createNotification(
          testUser.id,
          'ticket_assigned',
          'Unread 2',
          'Message 2'
        );

        const unreadCount = NotificationService.getUnreadCount(testUser.id);
        expect(unreadCount).toBe(2);
      });

      it('should return 0 for user with no notifications', async () => {
        const unreadCount = NotificationService.getUnreadCount(testUser.id);
        expect(unreadCount).toBe(0);
      });
    });

    describe('markAsRead', () => {
      it('should mark notification as read', async () => {
        const notification = await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Test Notification',
          'Test message'
        );

        const success = NotificationService.markAsRead(testUser.id, notification.id);
        expect(success).toBe(true);

        const unreadCount = NotificationService.getUnreadCount(testUser.id);
        expect(unreadCount).toBe(0);
      });

      it('should return false for non-existent notification', async () => {
        const success = NotificationService.markAsRead(testUser.id, 'non-existent-id');
        expect(success).toBe(false);
      });
    });

    describe('markAllAsRead', () => {
      it('should mark all notifications as read', async () => {
        await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Notification 1',
          'Message 1'
        );
        await NotificationService.createNotification(
          testUser.id,
          'ticket_assigned',
          'Notification 2',
          'Message 2'
        );

        const markedCount = NotificationService.markAllAsRead(testUser.id);
        expect(markedCount).toBe(2);

        const unreadCount = NotificationService.getUnreadCount(testUser.id);
        expect(unreadCount).toBe(0);
      });
    });
  });

  describe('Notification API Endpoints', () => {
    let userToken: string;
    let adminToken: string;
    let testUser: any;
    let testAdmin: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'user@test.com',
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
      adminToken = JwtService.generateAccessToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });
    });

    describe('GET /api/notifications', () => {
      beforeEach(async () => {
        // Create test notifications
        await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Test Notification 1',
          'Test message 1'
        );
        await NotificationService.createNotification(
          testUser.id,
          'ticket_assigned',
          'Test Notification 2',
          'Test message 2'
        );
      });

      it('should get user notifications', async () => {
        const response = await request(app)
          .get('/api/notifications')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            notifications: expect.any(Array),
            unreadCount: expect.any(Number),
            total: expect.any(Number),
          },
        });

        expect(response.body.data.notifications).toHaveLength(2);
        expect(response.body.data.unreadCount).toBe(2);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/notifications?limit=1&offset=0')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.data.notifications).toHaveLength(1);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/notifications')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/notifications/unread-count', () => {
      it('should get unread count', async () => {
        await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Unread Notification',
          'Unread message'
        );

        const response = await request(app)
          .get('/api/notifications/unread-count')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            unreadCount: 1,
          },
        });
      });
    });

    describe('PATCH /api/notifications/:id/read', () => {
      let notificationId: string;

      beforeEach(async () => {
        const notification = await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Test Notification',
          'Test message'
        );
        notificationId = notification.id;
      });

      it('should mark notification as read', async () => {
        const response = await request(app)
          .patch(`/api/notifications/${notificationId}/read`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Notification marked as read',
          },
        });
      });

      it('should return 404 for non-existent notification', async () => {
        const fakeId = 'notif_123456789_fake';
        
        const response = await request(app)
          .patch(`/api/notifications/${fakeId}/read`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
          },
        });
      });
    });

    describe('PATCH /api/notifications/mark-all-read', () => {
      it('should mark all notifications as read', async () => {
        await NotificationService.createNotification(
          testUser.id,
          'ticket_created',
          'Notification 1',
          'Message 1'
        );
        await NotificationService.createNotification(
          testUser.id,
          'ticket_assigned',
          'Notification 2',
          'Message 2'
        );

        const response = await request(app)
          .patch('/api/notifications/mark-all-read')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: expect.stringContaining('notifications marked as read'),
            markedCount: expect.any(Number),
          },
        });
      });
    });

    describe('GET /api/notifications/statistics', () => {
      it('should get notification statistics for admin', async () => {
        const response = await request(app)
          .get('/api/notifications/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            totalNotifications: expect.any(Number),
            totalUsers: expect.any(Number),
            unreadNotifications: expect.any(Number),
          },
        });
      });

      it('should deny access to non-admin users', async () => {
        const response = await request(app)
          .get('/api/notifications/statistics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/notifications/test', () => {
      it('should create test notification in development', async () => {
        // Mock NODE_ENV for this test
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const testData = {
          type: 'ticket_created',
          title: 'Test Title',
          message: 'Test Message',
        };

        const response = await request(app)
          .post('/api/notifications/test')
          .set('Authorization', `Bearer ${userToken}`)
          .send(testData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            type: 'ticket_created',
            title: 'Test Title',
            message: 'Test Message',
            userId: testUser.id,
          },
        });

        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      });

      it('should deny test notifications in production', async () => {
        // Mock NODE_ENV for this test
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const response = await request(app)
          .post('/api/notifications/test')
          .set('Authorization', `Bearer ${userToken}`)
          .send({})
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'NOT_ALLOWED_IN_PRODUCTION',
          },
        });

        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      });
    });
  });
});