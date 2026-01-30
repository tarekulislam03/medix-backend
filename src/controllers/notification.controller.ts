import { Request, Response } from 'express';
import prisma from '../config/database';
import { NotificationStatus } from '@prisma/client';
import inventoryAlertService from '../services/inventoryAlert.service';

/**
 * Get all notifications for the store/user
 * GET /api/v1/notifications
 */
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { unreadOnly } = req.query;

        const where: any = {
            storeId: req.storeId,
            OR: [
                { userId: req.user?.userId },
                { userId: null }, // Store-wide notifications
            ],
        };

        if (unreadOnly === 'true') {
            where.status = NotificationStatus.UNREAD;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit to last 50
        });

        // Count unread
        const unreadCount = await prisma.notification.count({
            where: {
                ...where,
                status: NotificationStatus.UNREAD,
            },
        });

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Mark notification as read
 * PATCH /api/v1/notifications/:id/read
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;

        // Verify ownership
        const notification = await prisma.notification.findFirst({
            where: { id: String(id), storeId: req.storeId },
        });

        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }

        const updated = await prisma.notification.update({
            where: { id: String(id) },
            data: {
                status: NotificationStatus.READ,
                readAt: new Date(),
            },
        });

        res.status(200).json({
            success: true,
            data: updated,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update notification';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Mark all notifications as read
 * PATCH /api/v1/notifications/read-all
 */
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const where = {
            storeId: req.storeId,
            status: NotificationStatus.UNREAD,
            OR: [
                { userId: req.user?.userId },
                { userId: null },
            ],
        };

        await prisma.notification.updateMany({
            where,
            data: {
                status: NotificationStatus.READ,
                readAt: new Date(),
            },
        });

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update notifications';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Manually trigger inventory alerts check
 * POST /api/v1/notifications/check-alerts
 */
export const checkAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        await inventoryAlertService.generateInventoryAlerts(req.storeId);

        res.status(200).json({
            success: true,
            message: 'Inventory alerts check triggered successfully',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to check alerts';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

export default {
    getNotifications,
    markAsRead,
    markAllAsRead,
    checkAlerts,
};
