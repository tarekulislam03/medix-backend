import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All analytics routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

/**
 * @route   GET /api/v1/analytics/stats
 * @desc    Get aggregated sales stats (Today, Month)
 * @access  Private (Owner, Admin, Manager, Pharmacist)
 */
router.get(
    '/stats',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST),
    analyticsController.getStats
);

/**
 * @route   GET /api/v1/analytics/history
 * @desc    Get sales history / bills list
 * @access  Private (All roles)
 */
router.get(
    '/history',
    // authorize(), // All authenticated users in the store can view history?
    // Let's restrict to same roles for consistency, or allow Cashier too.
    // Assuming Cashier needs to find bills for reprint/return.
    // Logic: If no authorize middleware, any authenticated user (checked by router.use(authenticate)) works.
    // But verifySubscription is also checked.
    analyticsController.getHistory
);

export default router;
