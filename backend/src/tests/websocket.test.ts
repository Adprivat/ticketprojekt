import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Client from 'socket.io-client';
type ClientSocket = ReturnType<typeof Client>;
import { createServer } from 'http';
import express from 'express';
import { initializeWebSocket } from '../websocket';
import { NotificationService } from '../services/notification.service';
import { JwtService } from '../utils/jwt';
import { setupTestDatabase, clearTestDatabase } from './database.setup';
// Removed node:test imports to avoid conflicts with Jest's globals

describe('WebSocket Integration Tests', () => {
  let httpServer: HTTPServer;
  let socketServer: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverAddress: string;
  let testUserId: string;
  let testToken: string;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Create test user and token
    testUserId = 'test-user-id';
    testToken = JwtService.generateAccessToken({
      userId: testUserId,
      email: 'test@example.com',
      role: 'AGENT'
    });

    // Create HTTP server
    const app = express();
    httpServer = createServer(app);
    
    // Initialize WebSocket server
    socketServer = initializeWebSocket(httpServer);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          serverAddress = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close connections
    if (clientSocket) {
      clientSocket.close();
    }
    if (socketServer) {
      socketServer.close();
    }
    if (httpServer) {
      httpServer.close();
    }

    // Cleanup test database
    await clearTestDatabase();
  });

  beforeEach(() => {
    // Clear notification service state
    (NotificationService as any).notifications.clear();
    (NotificationService as any).socketConnections.clear();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.close();
    }
  });

  describe('WebSocket Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = Client(serverAddress, { timeout: 1500 });

      clientSocket.on('connect_error', (error: any) => {
        expect(error.message).toBe('Authentication token required');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: 'invalid-token'
        },
        timeout: 1500,
      });

      clientSocket.on('connect_error', (error: any) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });
    });

    it('should accept connection with valid token', (done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('error', (error: any) => {
        done(error);
      });
    });
  });

  describe('Real-time Notifications', () => {
    beforeEach((done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('error', done);
    });

    it('should receive notification count on connection', (done) => {
      clientSocket.on('notification_count', (data: any) => {
        expect(data).toHaveProperty('unreadCount');
        expect(typeof data.unreadCount).toBe('number');
        done();
      });
    });

    it('should receive real-time notifications', (done) => {
      const testNotification = {
        type: 'ticket_created' as const,
        title: 'Test Notification',
        message: 'This is a test notification',
        ticketId: 'test-ticket-id',
      };

      clientSocket.on('notification', (payload: any) => {
        expect(payload.type).toBe('notification');
        expect(payload.data).toMatchObject({
          type: testNotification.type,
          title: testNotification.title,
          message: testNotification.message,
          ticketId: testNotification.ticketId,
          userId: testUserId,
        });
        expect(payload.data).toHaveProperty('id');
        expect(payload.data).toHaveProperty('createdAt');
        expect(payload.data.read).toBe(false);
        done();
      });

      // Create notification after socket is ready
      setTimeout(async () => {
        await NotificationService.createNotification(
          testUserId,
          testNotification.type,
          testNotification.title,
          testNotification.message,
          { ticketId: testNotification.ticketId }
        );
      }, 100);
    });

    it('should handle notification acknowledgment', (done) => {
      let notificationId: string;

      clientSocket.on('notification', async (payload: any) => {
        notificationId = payload.data.id;
        
        // Acknowledge the notification
        clientSocket.emit('notification_ack', { notificationId });
        
        // Check if notification is marked as read
        setTimeout(() => {
          const notifications = NotificationService.getUserNotifications(testUserId);
          const notification = notifications.find(n => n.id === notificationId);
          expect(notification?.read).toBe(true);
          done();
        }, 100);
      });

      // Create a test notification
      setTimeout(async () => {
        await NotificationService.createNotification(
          testUserId,
          'ticket_created',
          'Test Notification',
          'Test message'
        );
      }, 100);
    });

    it('should handle ping/pong for connection health', (done) => {
      clientSocket.on('pong', () => {
        done();
      });

      clientSocket.emit('ping');
    });
  });

  describe('Connection Management', () => {
    it('should register socket connection on connect', (done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        // Check if socket is registered
        const socketConnections = (NotificationService as any).socketConnections;
        expect(socketConnections.has(testUserId)).toBe(true);
        done();
      });

      clientSocket.on('error', done);
    });

    it('should unregister socket connection on disconnect', (done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        // Verify connection is registered
        const socketConnections = (NotificationService as any).socketConnections;
        expect(socketConnections.has(testUserId)).toBe(true);

        // Disconnect and check if unregistered
        clientSocket.close();
      });

      clientSocket.on('disconnect', () => {
        setTimeout(() => {
          const socketConnections = (NotificationService as any).socketConnections;
          expect(socketConnections.has(testUserId)).toBe(false);
          done();
        }, 100);
      });

      clientSocket.on('error', done);
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('error', done);
    });

    it('should handle invalid notification acknowledgment', (done) => {
      // Send invalid notification ack
      clientSocket.emit('notification_ack', { notificationId: 'invalid-id' });
      
      // Should not crash - just verify connection is still alive
      setTimeout(() => {
        clientSocket.emit('ping');
        clientSocket.on('pong', () => {
          done();
        });
      }, 100);
    });

    it('should handle malformed requests gracefully', (done) => {
      // Send malformed data
      clientSocket.emit('get_notifications', { invalid: 'data' });
      
      // Should not crash - verify connection is still alive
      setTimeout(() => {
        clientSocket.emit('ping');
        clientSocket.on('pong', () => {
          done();
        });
      }, 100);
    });
  });
});