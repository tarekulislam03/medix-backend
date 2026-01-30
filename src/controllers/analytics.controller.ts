import { Request, Response } from 'express';
import analyticsService from '../services/analytics.service';
import { BillStatus } from '@prisma/client';

/**
 * Get sales overview stats (Today, Month)
 * GET /api/v1/analytics/stats
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        const stats = await analyticsService.getSalesStats(req.storeId);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get analytics stats';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get sales history / bills list
 * GET /api/v1/analytics/history
 * Query Params: page, limit, search, startDate, endDate
 */
export const getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        // Extract filters
        const search = req.query.search as string;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const status = req.query.status ? (req.query.status as BillStatus) : undefined;

        const result = await analyticsService.getSalesHistory(
            req.storeId,
            { search, startDate, endDate, status },
            page,
            limit
        );

        res.status(200).json({
            success: true,
            data: result.bills,
            pagination: result.pagination,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get sales history';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

export default {
    getStats,
    getHistory,
};
