import prisma from '../config/database';
import { BillStatus } from '@prisma/client';
import billingService, { BillFilter } from './billing.service';

/**
 * Get aggregated sales stats
 */
export const getSalesStats = async (storeId: string) => {
    const now = new Date();

    // Today's boundaries
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Current Month boundaries
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Run queries in parallel
    const [todaySales, monthlySales] = await Promise.all([
        // Today's Sales
        prisma.bill.aggregate({
            where: {
                storeId,
                status: BillStatus.COMPLETED,
                billedAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            },
            _sum: {
                totalAmount: true,
                paidAmount: true,
            },
            _count: {
                id: true,
            },
        }),

        // Monthly Sales
        prisma.bill.aggregate({
            where: {
                storeId,
                status: BillStatus.COMPLETED,
                billedAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            _sum: {
                totalAmount: true,
            },
            _count: {
                id: true,
            },
        }),
    ]);

    return {
        today: {
            total: todaySales._sum.totalAmount || 0,
            count: todaySales._count.id || 0,
        },
        month: {
            total: monthlySales._sum.totalAmount || 0,
            count: monthlySales._count.id || 0,
        },
    };
};

/**
 * Get sales history (bills list)
 * Reuses billing service for consistent filtering/pagination
 */
export const getSalesHistory = async (storeId: string, filter: BillFilter, page: number, limit: number) => {
    return billingService.getBills(storeId, filter, page, limit);
};

export default {
    getSalesStats,
    getSalesHistory,
};
