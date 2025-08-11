import { Request, Response } from 'express';
import { NotificationService } from '@/services/notification.service';
import { asyncHandler } from '@/middleware/errorHandler';

/**
 * Notification controller
 */
export class NotificationController {
  /**
   * Get user notifications
   */
  static getUserNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { limit = 20, offset = 0 } = req.query;

    const notifications = NotificationService.getUserNotifications(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    const unreadCount = NotificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        total: notifications.length,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get unread notification count
   */
  static getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const unreadCount = NotificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        unreadCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Mark notification as read
   */
  static markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id: notificationId } = req.params;

    const success = NotificationService.markAsRead(userId, notificationId);

    if (!success) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Notification marked as read',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  });

  /**
   * Mark all notifications as read
   */
  static markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const markedCount = NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      data: {
        message: `${markedCount} notifications marked as read`,
        markedCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Delete notification
   */
  static deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id: notificationId } = req.params;

    const success = NotificationService.deleteNotification(userId, notificationId);

    if (!success) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Notification deleted successfully',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  });

  /**
   * Clear all notifications
   */
  static clearAllNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const clearedCount = NotificationService.clearAllNotifications(userId);

    res.json({
      success: true,
      data: {
        message: `${clearedCount} notifications cleared`,
        clearedCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get notification statistics (admin only)
   */
  static getNotificationStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = NotificationService.getNotificationStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Test notification (development only)
   */
  static testNotification = asyncHandler(async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: {
          code: 'NOT_ALLOWED_IN_PRODUCTION',
          message: 'Test notifications are not allowed in production',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userId = req.user!.id;
    const { type = 'ticket_created', title = 'Test Notification', message = 'This is a test notification' } = req.body;

    const notification = await NotificationService.createNotification(
      userId,
      type,
      title,
      message,
      {
        metadata: { test: true },
      }
    );

    res.json({
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    });
    return;
  });
}