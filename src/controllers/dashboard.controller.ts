import { Request, Response } from 'express';
import dashboardService from '../services/dashboard.service';
import inventoryAlertService from '../services/inventoryAlert.service';

/**
 * Get complete dashboard statistics
 * GET /api/v1/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        // Trigger inventory alert generation in background (don't await)
        inventoryAlertService.generateInventoryAlerts(req.storeId).catch(err => {
            console.error('Failed to generate inventory alerts:', err);
        });

        const stats = await dashboardService.getDashboardStats(req.storeId, req.user?.userId);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get dashboard stats';
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get today's sales summary
 * GET /api/v1/dashboard/today-sales
 */
export const getTodaySales = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const sales = await dashboardService.getTodaySales(req.storeId);

        res.status(200).json({
            success: true,
            data: sales,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get today sales';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get monthly sales summary
 * GET /api/v1/dashboard/monthly-summary
 */
export const getMonthlySummary = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const summary = await dashboardService.getMonthlySummary(req.storeId);

        res.status(200).json({
            success: true,
            data: summary,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get monthly summary';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get sales graph data (last 12 months)
 * GET /api/v1/dashboard/sales-graph
 */
export const getSalesGraphData = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const graphData = await dashboardService.getSalesGraphData(req.storeId);

        res.status(200).json({
            success: true,
            data: graphData,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get sales graph data';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get recent bills
 * GET /api/v1/dashboard/recent-bills
 */
export const getRecentBills = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 10;
        const bills = await dashboardService.getRecentBills(req.storeId, Math.min(limit, 50));

        res.status(200).json({
            success: true,
            data: bills,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get recent bills';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get notification counts
 * GET /api/v1/dashboard/notifications
 */
export const getNotificationCounts = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const notifications = await dashboardService.getNotificationCounts(req.storeId, req.user?.userId);

        res.status(200).json({
            success: true,
            data: notifications,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get notification counts';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get inventory stats
 * GET /api/v1/dashboard/inventory-stats
 */
export const getInventoryStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const stats = await dashboardService.getInventoryStats(req.storeId);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get inventory stats';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get customer stats
 * GET /api/v1/dashboard/customer-stats
 */
export const getCustomerStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const stats = await dashboardService.getCustomerStats(req.storeId);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get customer stats';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get store settings
 * GET /api/v1/dashboard/store
 */
export const getStoreSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const store = await dashboardService.getStoreSettings(req.storeId);

        res.status(200).json({
            success: true,
            data: store,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get store settings';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Update store settings
 * PUT /api/v1/dashboard/store
 */
export const updateStoreSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const store = await dashboardService.updateStoreSettings(req.storeId, req.body);

        res.status(200).json({
            success: true,
            data: store,
            message: 'Store settings updated successfully',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update store settings';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

export default {
    getDashboardStats,
    getTodaySales,
    getMonthlySummary,
    getSalesGraphData,
    getRecentBills,
    getNotificationCounts,
    getInventoryStats,
    getCustomerStats,
    getStoreSettings,
    updateStoreSettings,
};
