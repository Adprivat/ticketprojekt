import { Server as SocketIOServer } from 'socket.io';
import { NotificationService, NotificationData } from '../services/notification.service';
import { logger, logBusinessEvent } from '../middleware/logging';

/**
 * WebSocket notification broadcaster
 * Handles real-time broadcasting of notifications and ticket updates
 */
export class NotificationBroadcaster {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      if (userId) {
        this.connectedUsers.set(userId, socket.id);
        
        // Send initial notification count
        this.sendNotificationCount(userId);
        
        // Handle notification requests
        socket.on('get_notifications', async (data: { limit?: number; offset?: number }) => {
          await this.handleGetNotifications(socket, userId, data);
        });

        // Handle notification acknowledgment
        socket.on('notification_ack', (data: { notificationId: string }) => {
          this.handleNotificationAck(userId, data.notificationId);
        });

        // Handle mark all as read
        socket.on('mark_all_read', () => {
          this.handleMarkAllAsRead(userId);
        });

        // Handle ticket room management
        socket.on('join_ticket', (data: { ticketId: string }) => {
          socket.join(`ticket:${data.ticketId}`);
          logger.debug('User joined ticket room', {
            userId,
            ticketId: data.ticketId,
            socketId: socket.id,
          });
        });

        socket.on('leave_ticket', (data: { ticketId: string }) => {
          socket.leave(`ticket:${data.ticketId}`);
          logger.debug('User left ticket room', {
            userId,
            ticketId: data.ticketId,
            socketId: socket.id,
          });
        });

        // Handle typing indicators
        socket.on('typing_start', (data: { ticketId: string }) => {
          socket.to(`ticket:${data.ticketId}`).emit('user_typing', {
            userId,
            ticketId: data.ticketId,
            timestamp: Date.now(),
          });
        });

        socket.on('typing_stop', (data: { ticketId: string }) => {
          socket.to(`ticket:${data.ticketId}`).emit('user_stopped_typing', {
            userId,
            ticketId: data.ticketId,
            timestamp: Date.now(),
          });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          this.connectedUsers.delete(userId);
          logger.debug('User disconnected from WebSocket', {
            userId,
            socketId: socket.id,
          });
        });
      }
    });
  }

  /**
   * Send notification count to user
   */
  private sendNotificationCount(userId: string): void {
    const unreadCount = NotificationService.getUnreadCount(userId);
    const socketId = this.connectedUsers.get(userId);
    
    if (socketId) {
      this.io.to(socketId).emit('notification_count', {
        unreadCount,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle get notifications request
   */
  private async handleGetNotifications(
    socket: any,
    userId: string,
    data: { limit?: number; offset?: number }
  ): Promise<void> {
    try {
      const notifications = NotificationService.getUserNotifications(
        userId,
        data.limit || 20,
        data.offset || 0
      );

      socket.emit('notifications_list', {
        notifications,
        hasMore: notifications.length === (data.limit || 20),
  unreadCount: NotificationService.getUnreadCount(userId),
        timestamp: Date.now(),
      });

      logger.debug('Sent notifications list', {
        userId,
        count: notifications.length,
        limit: data.limit,
        offset: data.offset,
      });
    } catch (error) {
      logger.error('Error handling get notifications', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      socket.emit('error', {
        type: 'GET_NOTIFICATIONS_ERROR',
        message: 'Failed to retrieve notifications',
      });
    }
  }

  /**
   * Handle notification acknowledgment
   */
  private handleNotificationAck(userId: string, notificationId: string): void {
    const success = NotificationService.markAsRead(userId, notificationId);
    
    if (success) {
      // Send updated notification count
      this.sendNotificationCount(userId);
      
      logger.debug('Notification acknowledged', {
        userId,
        notificationId,
      });
    } else {
      logger.warn('Failed to acknowledge notification', {
        userId,
        notificationId,
      });
    }
  }

  /**
   * Handle mark all as read
   */
  private handleMarkAllAsRead(userId: string): void {
    const markedCount = NotificationService.markAllAsRead(userId);
    
    // Send updated notification count
    this.sendNotificationCount(userId);
    
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('all_notifications_read', {
        markedCount,
        timestamp: Date.now(),
      });
    }

    logger.debug('All notifications marked as read', {
      userId,
      markedCount,
    });
  }

  /**
   * Broadcast notification to specific user
   */
  public broadcastNotification(userId: string, notification: NotificationData): void {
    const socketId = this.connectedUsers.get(userId);
    
    if (socketId) {
      this.io.to(socketId).emit('notification', {
        type: 'notification',
        data: notification,
      });

      // Also send updated count
      this.sendNotificationCount(userId);

      logger.debug('Notification broadcasted', {
        userId,
        notificationId: notification.id,
        type: notification.type,
      });
    } else {
      logger.debug('User not connected, notification stored for later', {
        userId,
        notificationId: notification.id,
      });
    }
  }

  /**
   * Broadcast ticket update to all users in ticket room
   */
  public broadcastTicketUpdate(
    ticketId: string,
    update: {
      type: 'status_change' | 'assignment_change' | 'comment_added' | 'ticket_updated';
      data: any;
      updatedBy?: {
        id: string;
        name: string;
        email: string;
      };
    }
  ): void {
    this.io.to(`ticket:${ticketId}`).emit('ticket_update', {
      ticketId,
      type: update.type,
      data: update.data,
      updatedBy: update.updatedBy,
      timestamp: Date.now(),
    });

    logger.debug('Ticket update broadcasted', {
      ticketId,
      updateType: update.type,
    });

    logBusinessEvent('TICKET_UPDATE_BROADCASTED', {
      ticketId,
      updateType: update.type,
      updatedBy: update.updatedBy?.id,
    });
  }

  /**
   * Broadcast to users with specific role
   */
  public broadcastToRole(
    role: 'ADMIN' | 'AGENT' | 'USER',
    event: string,
    data: any
  ): void {
    const room = `role:${role.toLowerCase()}`;
    this.io.to(room).emit(event, {
      ...data,
      timestamp: Date.now(),
    });

    logger.debug('Role broadcast sent', {
      role,
      event,
      room,
    });
  }

  /**
   * Broadcast system announcement to all connected users
   */
  public broadcastSystemAnnouncement(
    announcement: {
      title: string;
      message: string;
      type: 'info' | 'warning' | 'error' | 'success';
      priority: 'low' | 'medium' | 'high';
    }
  ): void {
    this.io.emit('system_announcement', {
      ...announcement,
      timestamp: Date.now(),
    });

    logger.info('System announcement broadcasted', {
      title: announcement.title,
      type: announcement.type,
      priority: announcement.priority,
    });

    logBusinessEvent('SYSTEM_ANNOUNCEMENT', {
      title: announcement.title,
      type: announcement.type,
      priority: announcement.priority,
    });
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    connectedUsers: number;
    totalRooms: number;
    socketCount: number;
  } {
    return {
      connectedUsers: this.connectedUsers.size,
      totalRooms: this.io.sockets.adapter.rooms.size,
      socketCount: this.io.sockets.sockets.size,
    };
  }

  /**
   * Get connected users list
   */
  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Force disconnect user
   */
  public disconnectUser(userId: string, reason?: string): boolean {
    const socketId = this.connectedUsers.get(userId);
    
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        logger.info('User forcefully disconnected', {
          userId,
          socketId,
          reason,
        });
        return true;
      }
    }
    
    return false;
  }

  /**
   * Send direct message to specific user
   */
  public sendDirectMessage(
    userId: string,
    event: string,
    data: any
  ): boolean {
    const socketId = this.connectedUsers.get(userId);
    
    if (socketId) {
      this.io.to(socketId).emit(event, {
        ...data,
        timestamp: Date.now(),
      });
      
      logger.debug('Direct message sent', {
        userId,
        event,
      });
      
      return true;
    }
    
    return false;
  }
}