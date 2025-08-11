import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtService } from '@/utils/jwt';
import { NotificationService } from '@/services/notification.service';
import { logBusinessEvent, logSecurityEvent } from '@/middleware/logging';

/**
 * WebSocket handler for real-time notifications
 */
export class NotificationWebSocketHandler {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(socket: Socket): Promise<void> {
    try {
      // Authenticate user
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        logSecurityEvent('WEBSOCKET_AUTH_MISSING_TOKEN', { socketId: socket.id });
        socket.emit('error', { message: 'Authentication token required' });
        socket.disconnect();
        return;
      }

      const decoded = JwtService.verifyAccessToken(token);
      const userId = decoded.userId;

      // Store user ID in socket data
      socket.data.userId = userId;

      // Register socket connection for notifications
      NotificationService.registerSocketConnection(userId, socket);

      logBusinessEvent('WEBSOCKET_USER_CONNECTED', {
        userId,
        socketId: socket.id,
      });

      // Send initial notification count
      const unreadCount = NotificationService.getUnreadCount(userId);
      socket.emit('notification_count', { unreadCount });

      // Setup event handlers for this socket
      this.setupSocketEventHandlers(socket, userId);

    } catch (error) {
      logSecurityEvent('WEBSOCKET_AUTH_FAILED', {
        socketId: socket.id,
  error: error instanceof Error ? error.message : String(error),
      });
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  /**
   * Setup event handlers for authenticated socket
   */
  private setupSocketEventHandlers(socket: Socket, userId: string): void {
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      NotificationService.unregisterSocketConnection(userId);
      logBusinessEvent('WEBSOCKET_USER_DISCONNECTED', {
        userId,
        socketId: socket.id,
        reason,
      });
    });

    // Handle notification acknowledgment
    socket.on('notification_ack', (data: { notificationId: string }) => {
      if (data.notificationId) {
        NotificationService.markAsRead(userId, data.notificationId);
        logBusinessEvent('NOTIFICATION_ACKNOWLEDGED', {
          userId,
          notificationId: data.notificationId,
        });
      }
    });

    // Handle request for notification history
    socket.on('get_notifications', (data: { limit?: number; offset?: number }) => {
      const notifications = NotificationService.getUserNotifications(
        userId,
        data.limit || 20,
        data.offset || 0
      );
      
      socket.emit('notifications_history', {
        notifications,
        unreadCount: NotificationService.getUnreadCount(userId),
      });
    });

    // Handle mark all as read
    socket.on('mark_all_read', () => {
      const markedCount = NotificationService.markAllAsRead(userId);
      socket.emit('notifications_marked_read', { markedCount });
      
      logBusinessEvent('WEBSOCKET_MARK_ALL_READ', {
        userId,
        markedCount,
      });
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle errors
    socket.on('error', (error) => {
      logBusinessEvent('WEBSOCKET_ERROR', {
        userId,
        socketId: socket.id,
        error: error.message,
      });
    });
  }

  /**
   * Broadcast notification to all connected users
   */
  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Send notification to specific user
   */
  public sendToUser(userId: string, event: string, data: any): void {
    this.io.to(userId).emit(event, data);
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    rooms: string[];
  } {
    const sockets = Array.from(this.io.sockets.sockets.values());
    const authenticatedConnections = sockets.filter(socket => socket.data.userId).length;
    const rooms = Array.from(this.io.sockets.adapter.rooms.keys());

    return {
      totalConnections: sockets.length,
      authenticatedConnections,
      rooms,
    };
  }
}