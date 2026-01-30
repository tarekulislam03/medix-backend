import prisma from '../config/database';
import { NotificationType, NotificationStatus } from '@prisma/client';

/**
 * Check and generate inventory alerts
 */
export const generateInventoryAlerts = async (storeId: string) => {
    await Promise.all([
        checkLowStock(storeId),
        checkExpiringProducts(storeId),
        checkDeadStock(storeId),
    ]);
};

/**
 * Check for low stock products and create notifications
 */
const checkLowStock = async (storeId: string) => {
    // Prisma doesn't support field-to-field comparison, so fetch all and filter
    const allProducts = await prisma.product.findMany({
        where: {
            storeId,
            isActive: true,
        },
    });

    const lowStockProducts = allProducts.filter((p: any) => p.quantity <= p.reorderLevel);

    for (const product of lowStockProducts) {
        // Check if unread notification already exists for this product and type
        const existingNotification = await prisma.notification.findFirst({
            where: {
                storeId,
                entityId: product.id,
                type: NotificationType.LOW_STOCK,
                status: NotificationStatus.UNREAD,
            },
        });

        if (!existingNotification) {
            await prisma.notification.create({
                data: {
                    storeId,
                    title: 'Low Stock Alert',
                    message: `Product '${product.name}' is low on stock (${product.quantity} left). Reorder level is ${product.reorderLevel}.`,
                    type: NotificationType.LOW_STOCK,
                    entityType: 'product',
                    entityId: product.id,
                    actionUrl: `/inventory?search=${product.sku}`,
                    actionLabel: 'View Product',
                },
            });
        }
    }
};

/**
 * Check for expiring products (next 30 days)
 */
const checkExpiringProducts = async (storeId: string) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringProducts = await prisma.product.findMany({
        where: {
            storeId,
            isActive: true,
            expiryDate: {
                gte: now,
                lte: thirtyDaysFromNow,
            },
        },
    });

    for (const product of expiringProducts) {
        const existingNotification = await prisma.notification.findFirst({
            where: {
                storeId,
                entityId: product.id,
                type: NotificationType.EXPIRY,
                status: NotificationStatus.UNREAD,
            },
        });

        if (!existingNotification) {
            const daysLeft = Math.ceil((new Date(product.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            await prisma.notification.create({
                data: {
                    storeId,
                    title: 'Expiry Warning',
                    message: `Product '${product.name}' is expiring in ${daysLeft} days (Batch: ${product.batchNumber || 'N/A'}).`,
                    type: NotificationType.EXPIRY,
                    entityType: 'product',
                    entityId: product.id,
                    actionUrl: `/inventory?search=${product.sku}`,
                    actionLabel: 'Review',
                },
            });
        }
    }
};

/**
 * Check for dead stock (no sales in last 90 days)
 */
const checkDeadStock = async (storeId: string) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find products created before 90 days ago that have NO bill items in the last 90 days
    // We exclude recently added products to avoid false positives
    const deadStockProducts = await prisma.product.findMany({
        where: {
            storeId,
            isActive: true,
            createdAt: {
                lt: ninetyDaysAgo,
            },
            billItems: {
                none: {
                    createdAt: {
                        gte: ninetyDaysAgo,
                    },
                },
            },
            // Assume dead stock only matters if we actually have stock
            quantity: {
                gt: 0,
            },
        },
    });

    for (const product of deadStockProducts) {
        const existingNotification = await prisma.notification.findFirst({
            where: {
                storeId,
                entityId: product.id,
                type: NotificationType.WARNING, // Using WARNING for dead stock
                message: { contains: 'Dead stock' },
                status: NotificationStatus.UNREAD,
            },
        });

        if (!existingNotification) {
            await prisma.notification.create({
                data: {
                    storeId,
                    title: 'Dead Stock Detected',
                    message: `Product '${product.name}' has not sold in the last 90 days. Consider discounting.`,
                    type: NotificationType.WARNING,
                    entityType: 'product',
                    entityId: product.id,
                    actionUrl: `/inventory?search=${product.sku}`,
                    actionLabel: 'View Details',
                },
            });
        }
    }
};

export default {
    generateInventoryAlerts,
};
