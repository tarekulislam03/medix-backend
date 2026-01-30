import { Router } from 'express';
import subscriptionController from '../controllers/subscription.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/v1/subscription/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', subscriptionController.getAvailablePlans);

/**
 * @route   GET /api/v1/subscription
 * @desc    Get current subscription for the store
 * @access  Private
 */
router.get('/', authenticate, subscriptionController.getCurrentSubscription);

/**
 * @route   GET /api/v1/subscription/trial-status
 * @desc    Get trial status for the store
 * @access  Private
 */
router.get('/trial-status', authenticate, subscriptionController.getTrialStatus);

/**
 * @route   GET /api/v1/subscription/usage
 * @desc    Get usage statistics for the store
 * @access  Private
 */
router.get('/usage', authenticate, subscriptionController.getUsageStats);

/**
 * @route   GET /api/v1/subscription/history
 * @desc    Get subscription history for the store
 * @access  Private (Owner/Admin only)
 */
router.get(
    '/history',
    authenticate,
    authorize(UserRole.OWNER, UserRole.ADMIN),
    subscriptionController.getSubscriptionHistory
);

/**
 * @route   GET /api/v1/subscription/feature/:feature
 * @desc    Check if store has access to a feature
 * @access  Private
 */
router.get('/feature/:feature', authenticate, subscriptionController.checkFeatureAccess);

/**
 * @route   POST /api/v1/subscription/change-plan
 * @desc    Upgrade or change subscription plan
 * @access  Private (Owner only)
 */
router.post(
    '/change-plan',
    authenticate,
    authorize(UserRole.OWNER),
    subscriptionController.changePlan
);

/**
 * @route   POST /api/v1/subscription/renew
 * @desc    Renew current subscription
 * @access  Private (Owner only)
 */
router.post(
    '/renew',
    authenticate,
    authorize(UserRole.OWNER),
    subscriptionController.renewSubscription
);

/**
 * @route   POST /api/v1/subscription/cancel
 * @desc    Cancel subscription
 * @access  Private (Owner only)
 */
router.post(
    '/cancel',
    authenticate,
    authorize(UserRole.OWNER),
    subscriptionController.cancelSubscription
);

/**
 * @route   POST /api/v1/subscription/toggle-auto-renew
 * @desc    Toggle auto-renewal setting
 * @access  Private (Owner only)
 */
router.post(
    '/toggle-auto-renew',
    authenticate,
    authorize(UserRole.OWNER),
    subscriptionController.toggleAutoRenew
);

export default router;
