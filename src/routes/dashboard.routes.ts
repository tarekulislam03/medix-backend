import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

// All dashboard routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

/**
 * @route   GET /api/v1/dashboard
 * @desc    Get complete dashboard statistics
 * @access  Private
 */
router.get('/', dashboardController.getDashboardStats);

/**
 * @route   GET /api/v1/dashboard/today-sales
 * @desc    Get today's sales summary
 * @access  Private
 */
router.get('/today-sales', dashboardController.getTodaySales);

/**
 * @route   GET /api/v1/dashboard/monthly-summary
 * @desc    Get monthly sales summary
 * @access  Private
 */
router.get('/monthly-summary', dashboardController.getMonthlySummary);

/**
 * @route   GET /api/v1/dashboard/sales-graph
 * @desc    Get sales per month graph data (last 12 months)
 * @access  Private
 */
router.get('/sales-graph', dashboardController.getSalesGraphData);

/**
 * @route   GET /api/v1/dashboard/recent-bills
 * @desc    Get recent bills (default 10, max 50)
 * @access  Private
 */
router.get('/recent-bills', dashboardController.getRecentBills);

/**
 * @route   GET /api/v1/dashboard/notifications
 * @desc    Get notification counts (unread, alerts)
 * @access  Private
 */
router.get('/notifications', dashboardController.getNotificationCounts);

/**
 * @route   GET /api/v1/dashboard/inventory-stats
 * @desc    Get inventory statistics (low stock, expiring)
 * @access  Private
 */
router.get('/inventory-stats', dashboardController.getInventoryStats);

/**
 * @route   GET /api/v1/dashboard/customer-stats
 * @desc    Get customer statistics
 * @access  Private
 */
router.get('/customer-stats', dashboardController.getCustomerStats);

/**
 * @route   GET /api/v1/dashboard/store
 * @desc    Get store settings
 * @access  Private
 */
router.get('/store', dashboardController.getStoreSettings);

/**
 * @route   PUT /api/v1/dashboard/store
 * @desc    Update store settings
 * @access  Private
 */
router.put('/store', dashboardController.updateStoreSettings);

export default router;
