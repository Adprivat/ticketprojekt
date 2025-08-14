import { User, Ticket, Comment } from '@prisma/client';
import { logBusinessEvent } from '../middleware/logging';

/**
 * Notification types
 */
export type NotificationType = 
  | 'ticket_created'
  | 'ticket_assigned'
  | 'ticket_unassigned'
  | 'ticket_status_changed'
  | 'comment_added'
  | 'ticket_closed'
  | 'ticket_reopened';

/**
 * Notification data interface
 */
export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  ticketId?: string;
  commentId?: string;
  actionBy?: {
    id: string;
    name: string;
    email: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  read: boolean;
}

/**
 * Notification payload for WebSocket
 */
export interface NotificationPayload {
  type: 'notification';
  data: NotificationData;
}

/**
 * Notification service for real-time frontend notifications
 */
export class NotificationService {
  private static notifications: Map<string, NotificationData[]> = new Map();
  private static socketConnections: Map<string, any> = new Map();
  private static broadcaster: any = null;

  /**
   * Register notification broadcaster
   */
  static registerBroadcaster(broadcaster: any): void {
    this.broadcaster = broadcaster;
  }

  /**
   * Register socket connection for user
   */
  static registerSocketConnection(userId: string, socket: any): void {
    this.socketConnections.set(userId, socket);
    logBusinessEvent('SOCKET_CONNECTED', { userId });
  }

  /**
   * Unregister socket connection
   */
  static unregisterSocketConnection(userId: string): void {
    this.socketConnections.delete(userId);
    logBusinessEvent('SOCKET_DISCONNECTED', { userId });
  }

  /**
   * Create and send notification
   */
  static async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options: {
      ticketId?: string;
      commentId?: string;
      actionBy?: User;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<NotificationData> {
    const notification: NotificationData = {
      id: this.generateNotificationId(),
      type,
      title,
      message,
      userId,
      ticketId: options.ticketId,
      commentId: options.commentId,
      actionBy: options.actionBy ? {
        id: options.actionBy.id,
        name: `${options.actionBy.firstName} ${options.actionBy.lastName}`,
        email: options.actionBy.email,
      } : undefined,
      metadata: options.metadata,
      createdAt: new Date(),
      read: false,
    };

    // Store notification
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId)!.unshift(notification);

    // Keep only last 50 notifications per user
    const userNotifications = this.notifications.get(userId)!;
    if (userNotifications.length > 50) {
      this.notifications.set(userId, userNotifications.slice(0, 50));
    }

    // Real-time delivery: prefer broadcaster when available to avoid duplicate emits
    if (this.broadcaster) {
      this.broadcaster.broadcastNotification(userId, notification);
    } else {
      // Fallback direct emit when no broadcaster is registered
      await this.sendRealTimeNotification(userId, notification);
    }

    logBusinessEvent('NOTIFICATION_CREATED', {
      notificationId: notification.id,
      userId,
      type,
      title,
    });

    return notification;
  }

  /**
   * Send real-time notification via WebSocket
   */
  private static async sendRealTimeNotification(
    userId: string, 
    notification: NotificationData
  ): Promise<void> {
    const socket = this.socketConnections.get(userId);
    if (socket) {
      const payload: NotificationPayload = {
        type: 'notification',
        data: notification,
      };
      
      socket.emit('notification', payload);
      
      logBusinessEvent('REALTIME_NOTIFICATION_SENT', {
        userId,
        notificationId: notification.id,
      });
    }
  }

  /**
   * Get notifications for user
   */
  static getUserNotifications(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): NotificationData[] {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.slice(offset, offset + limit);
  }

  /**
   * Get unread notification count
   */
  static getUnreadCount(userId: string): number {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.filter(n => !n.read).length;
  }

  /**
   * Mark notification as read
   */
  static markAsRead(userId: string, notificationId: string): boolean {
    const userNotifications = this.notifications.get(userId) || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      logBusinessEvent('NOTIFICATION_READ', { userId, notificationId });
      return true;
    }
    
    return false;
  }

  /**
   * Mark all notifications as read
   */
  static markAllAsRead(userId: string): number {
    const userNotifications = this.notifications.get(userId) || [];
    let markedCount = 0;
    
    userNotifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        markedCount++;
      }
    });

    if (markedCount > 0) {
      logBusinessEvent('ALL_NOTIFICATIONS_READ', { userId, count: markedCount });
    }

    return markedCount;
  }

  /**
   * Delete notification
   */
  static deleteNotification(userId: string, notificationId: string): boolean {
    const userNotifications = this.notifications.get(userId) || [];
    const index = userNotifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      userNotifications.splice(index, 1);
      logBusinessEvent('NOTIFICATION_DELETED', { userId, notificationId });
      return true;
    }
    
    return false;
  }

  /**
   * Clear all notifications for user
   */
  static clearAllNotifications(userId: string): number {
    const userNotifications = this.notifications.get(userId) || [];
    const count = userNotifications.length;
    
    this.notifications.set(userId, []);
    
    if (count > 0) {
      logBusinessEvent('ALL_NOTIFICATIONS_CLEARED', { userId, count });
    }
    
    return count;
  } 
 /**
   * Notify when ticket is created
   */
  static async notifyTicketCreated(
    ticket: Ticket & { creator?: User | null; assignee?: User | null },
    createdBy: User
  ): Promise<void> {
    // Notify assignee if ticket is assigned
    if (ticket.assignee && ticket.assignee.id !== createdBy.id) {
      await this.createNotification(
        ticket.assignee.id,
        'ticket_created',
        'New Ticket Assigned',
        `A new ticket "${ticket.title}" has been created and assigned to you.`,
        {
          ticketId: ticket.id,
          actionBy: createdBy,
          metadata: { priority: ticket.priority },
        }
      );
    }

    // Notify admins/agents about new tickets (except the creator)
    const { userRepository } = await import('../database/repositories');
    const agents = await userRepository.findByRole('AGENT');
    const admins = await userRepository.findByRole('ADMIN');
    
    const notifyUsers = [...agents, ...admins].filter(
      user => user.id !== createdBy.id && user.isActive
    );

    for (const user of notifyUsers) {
      await this.createNotification(
        user.id,
        'ticket_created',
        'New Ticket Created',
        `A new ticket "${ticket.title}" has been created by ${createdBy.firstName} ${createdBy.lastName}.`,
        {
          ticketId: ticket.id,
          actionBy: createdBy,
          metadata: { priority: ticket.priority },
        }
      );
    }

    // Self notification for creator (so they also see something in UI)
    await this.createNotification(
      createdBy.id,
      'ticket_created',
      'Ticket erstellt',
      `Ihr Ticket "${ticket.title}" wurde erfolgreich erstellt.`,
      {
        ticketId: ticket.id,
        actionBy: createdBy,
        metadata: { priority: ticket.priority },
      }
    );
  }

  /**
   * Notify when ticket is assigned
   */
  static async notifyTicketAssigned(
    ticket: Ticket & { creator?: User | null; assignee?: User | null },
    assignedBy: User,
    previousAssignee?: User
  ): Promise<void> {
    // Notify new assignee (auch bei Selbst-Zuweisung)
    if (ticket.assignee) {
      const selfAssignment = ticket.assignee.id === assignedBy.id;
      await this.createNotification(
        ticket.assignee.id,
        'ticket_assigned',
        selfAssignment ? 'Ticket Ihnen zugewiesen' : 'Ticket zugewiesen',
        selfAssignment
          ? `Sie haben sich das Ticket "${ticket.title}" zugewiesen.`
          : `Ticket "${ticket.title}" wurde Ihnen zugewiesen von ${assignedBy.firstName} ${assignedBy.lastName}.`,
        {
          ticketId: ticket.id,
          actionBy: assignedBy,
          metadata: { priority: ticket.priority },
        }
      );
    }

    // Notify ticket creator if they're not the one assigning
    if (ticket.creator && ticket.creator.id !== assignedBy.id) {
      const assigneeName = ticket.assignee 
        ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
        : 'jemandem';

      await this.createNotification(
        ticket.creator.id,
        'ticket_assigned',
        'Ihr Ticket wurde zugewiesen',
        `Ihr Ticket "${ticket.title}" wurde ${assigneeName} zugewiesen.`,
        {
          ticketId: ticket.id,
          actionBy: assignedBy,
        }
      );
    }

    // Notify previous assignee if there was one
    if (previousAssignee && previousAssignee.id !== assignedBy.id) {
      await this.createNotification(
        previousAssignee.id,
        'ticket_unassigned',
        'Ticket neu zugewiesen',
        `Ticket "${ticket.title}" wurde einer anderen Person zugewiesen.`,
        {
          ticketId: ticket.id,
          actionBy: assignedBy,
        }
      );
    }
  }

  /**
   * Notify when ticket status changes
   */
  static async notifyTicketStatusChanged(
    ticket: Ticket & { creator?: User | null; assignee?: User | null },
    changedBy: User,
    previousStatus: string,
    newStatus: string
  ): Promise<void> {
    const statusMessages = {
      OPEN: 'opened',
      IN_PROGRESS: 'started',
      CLOSED: 'closed',
    };

    const message = `Ticket "${ticket.title}" has been ${statusMessages[newStatus as keyof typeof statusMessages] || newStatus.toLowerCase()}.`;

    // Notify ticket creator if they're not the one changing status
    if (ticket.creator && ticket.creator.id !== changedBy.id) {
      await this.createNotification(
        ticket.creator.id,
        'ticket_status_changed',
        'Ticket Status Updated',
        message,
        {
          ticketId: ticket.id,
          actionBy: changedBy,
          metadata: { previousStatus, newStatus },
        }
      );
    }

    // Notify assignee if they're not the one changing status
    if (ticket.assignee && ticket.assignee.id !== changedBy.id) {
      await this.createNotification(
        ticket.assignee.id,
        'ticket_status_changed',
        'Assigned Ticket Status Updated',
        message,
        {
          ticketId: ticket.id,
          actionBy: changedBy,
          metadata: { previousStatus, newStatus },
        }
      );
    }

    // Special handling for closed tickets
    if (newStatus === 'CLOSED') {
      await this.notifyTicketClosed(ticket, changedBy);
    }
  }

  /**
   * Notify when comment is added
   */
  static async notifyCommentAdded(
    ticket: Ticket & { creator?: User | null; assignee?: User | null },
    comment: Comment,
    commentAuthor: User
  ): Promise<void> {
    const notifiedUsers = new Set<string>();

    // Notify ticket creator if they're not the comment author
    if (ticket.creator && ticket.creator.id !== commentAuthor.id) {
      await this.createNotification(
        ticket.creator.id,
        'comment_added',
        'New Comment on Your Ticket',
        `${commentAuthor.firstName} ${commentAuthor.lastName} added a comment to your ticket "${ticket.title}".`,
        {
          ticketId: ticket.id,
          commentId: comment.id,
          actionBy: commentAuthor,
        }
      );
      notifiedUsers.add(ticket.creator.id);
    }

    // Notify assignee if they're not the comment author and not already notified
    if (ticket.assignee && 
        ticket.assignee.id !== commentAuthor.id && 
        !notifiedUsers.has(ticket.assignee.id)) {
      await this.createNotification(
        ticket.assignee.id,
        'comment_added',
        'New Comment on Assigned Ticket',
        `${commentAuthor.firstName} ${commentAuthor.lastName} added a comment to ticket "${ticket.title}".`,
        {
          ticketId: ticket.id,
          commentId: comment.id,
          actionBy: commentAuthor,
        }
      );
      notifiedUsers.add(ticket.assignee.id);
    }
  }

  /**
   * Notify when ticket is closed
   */
  private static async notifyTicketClosed(
    ticket: Ticket & { creator?: User | null; assignee?: User | null },
    closedBy: User
  ): Promise<void> {
    // This is called from notifyTicketStatusChanged, so we don't duplicate notifications
    // Just log the event for now
    logBusinessEvent('TICKET_CLOSED_NOTIFICATION', {
      ticketId: ticket.id,
      closedBy: closedBy.id,
    });
  }

  /**
   * Generate unique notification ID
   */
  private static generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get notification statistics
   */
  static getNotificationStats(): {
    totalNotifications: number;
    totalUsers: number;
    unreadNotifications: number;
  } {
    let totalNotifications = 0;
    let unreadNotifications = 0;
    const totalUsers = this.notifications.size;

    for (const userNotifications of this.notifications.values()) {
      totalNotifications += userNotifications.length;
      unreadNotifications += userNotifications.filter(n => !n.read).length;
    }

    return {
      totalNotifications,
      totalUsers,
      unreadNotifications,
    };
  }

  /**
   * Cleanup old notifications (called periodically)
   */
  static cleanupOldNotifications(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let cleanedCount = 0;

    for (const [userId, userNotifications] of this.notifications.entries()) {
      const filteredNotifications = userNotifications.filter(
        notification => notification.createdAt > cutoffDate
      );
      
      const removedCount = userNotifications.length - filteredNotifications.length;
      cleanedCount += removedCount;
      
      this.notifications.set(userId, filteredNotifications);
    }

    if (cleanedCount > 0) {
      logBusinessEvent('NOTIFICATIONS_CLEANED', { 
        cleanedCount, 
        daysOld 
      });
    }

    return cleanedCount;
  }
}