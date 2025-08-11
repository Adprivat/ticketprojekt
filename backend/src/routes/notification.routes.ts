import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import {
  validateUuidParam,
  validate,
} from '../middleware/validation';
import {
  requireAuth,
  requireAdmin,
} from '../middleware/auth';
import Joi from 'joi';

const router = Router();

/**
 * Notification validation schemas
 */
const notificationSchemas = {
  testNotification: Joi.object({
    type: Joi.string().valid(
      'ticket_created',
      'ticket_assigned',
      'ticket_unassigned',
      'ticket_status_changed',
      'comment_added',
      'ticket_closed',
      'ticket_reopened'
    ).default('ticket_created'),
    title: Joi.string().min(1).max(255).default('Test Notification'),
    message: Joi.string().min(1).max(500).default('This is a test notification'),
  }),

  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};

/**
 * Notification routes
 */

// Get user notifications
router.get(
  '/',
  requireAuth,
  validate({ query: notificationSchemas.pagination }),
  NotificationController.getUserNotifications
);

// Get unread notification count
router.get('/unread-count', requireAuth, NotificationController.getUnreadCount);

// Get notification statistics (admin only)
router.get('/statistics', requireAdmin, NotificationController.getNotificationStats);

// Mark all notifications as read
router.patch('/mark-all-read', requireAuth, NotificationController.markAllAsRead);

// Clear all notifications
router.delete('/clear-all', requireAuth, NotificationController.clearAllNotifications);

// Test notification (development only)
router.post(
  '/test',
  requireAuth,
  validate({ body: notificationSchemas.testNotification }),
  NotificationController.testNotification
);

// Mark specific notification as read
router.patch(
  '/:id/read',
  requireAuth,
  validateUuidParam,
  NotificationController.markAsRead
);

// Delete specific notification
router.delete(
  '/:id',
  requireAuth,
  validateUuidParam,
  NotificationController.deleteNotification
);

export { router as notificationRoutes };