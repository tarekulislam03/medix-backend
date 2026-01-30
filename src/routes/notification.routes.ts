import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

// All routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

/**
 * @route   GET /api/v1/notifications
 * @desc    Get all notifications
 * @access  Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   POST /api/v1/notifications/check-alerts
 * @desc    Trigger inventory alerts check manually
 * @access  Private
 */
router.post('/check-alerts', notificationController.checkAlerts);

export default router;
