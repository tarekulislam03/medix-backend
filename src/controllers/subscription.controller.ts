import { Request, Response } from 'express';
import { SubscriptionPlan } from '@prisma/client';
import subscriptionService from '../services/subscription.service';

/**
 * Get current subscription
 * GET /api/v1/subscription
 */
export const getCurrentSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const subscription = await subscriptionService.getCurrentSubscription(req.storeId);

        if (!subscription) {
            res.status(404).json({
                success: false,
                message: 'No subscription found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: subscription,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get subscription';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get all available plans
 * GET /api/v1/subscription/plans
 */
export const getAvailablePlans = async (_req: Request, res: Response): Promise<void> => {
    try {
        const plans = subscriptionService.getAvailablePlans();

        res.status(200).json({
            success: true,
            data: plans,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get plans';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get trial status
 * GET /api/v1/subscription/trial-status
 */
export const getTrialStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const trialStatus = await subscriptionService.checkTrialStatus(req.storeId);

        res.status(200).json({
            success: true,
            data: trialStatus,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get trial status';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Upgrade or change subscription plan
 * POST /api/v1/subscription/change-plan
 */
export const changePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { plan, billingCycle, paymentId } = req.body;

        // Validate plan
        if (!plan || !['BASIC', 'STANDARD', 'ADVANCED'].includes(plan)) {
            res.status(400).json({
                success: false,
                message: 'Invalid plan. Choose from: BASIC, STANDARD, ADVANCED',
            });
            return;
        }

        // Validate billing cycle
        if (billingCycle && !['monthly', 'yearly'].includes(billingCycle)) {
            res.status(400).json({
                success: false,
                message: 'Invalid billing cycle. Choose: monthly or yearly',
            });
            return;
        }

        const subscription = await subscriptionService.changePlan(
            req.storeId,
            plan as SubscriptionPlan,
            billingCycle || 'monthly',
            paymentId
        );

        res.status(200).json({
            success: true,
            message: `Successfully upgraded to ${plan} plan`,
            data: subscription,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to change plan';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Renew subscription
 * POST /api/v1/subscription/renew
 */
export const renewSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { paymentId } = req.body;

        const subscription = await subscriptionService.renewSubscription(req.storeId, paymentId);

        res.status(200).json({
            success: true,
            message: 'Subscription renewed successfully',
            data: subscription,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to renew subscription';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Cancel subscription
 * POST /api/v1/subscription/cancel
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const subscription = await subscriptionService.cancelSubscription(req.storeId);

        res.status(200).json({
            success: true,
            message: 'Subscription cancelled. You will have access until the end of your billing period.',
            data: subscription,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Toggle auto-renewal
 * POST /api/v1/subscription/toggle-auto-renew
 */
export const toggleAutoRenew = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const autoRenew = await subscriptionService.toggleAutoRenew(req.storeId);

        res.status(200).json({
            success: true,
            message: autoRenew ? 'Auto-renewal enabled' : 'Auto-renewal disabled',
            data: { autoRenew },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to toggle auto-renewal';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Get subscription history
 * GET /api/v1/subscription/history
 */
export const getSubscriptionHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const history = await subscriptionService.getSubscriptionHistory(req.storeId);

        res.status(200).json({
            success: true,
            data: history,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get subscription history';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get usage statistics
 * GET /api/v1/subscription/usage
 */
export const getUsageStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const usage = await subscriptionService.getUsageStats(req.storeId);

        res.status(200).json({
            success: true,
            data: usage,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get usage stats';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Check feature access
 * GET /api/v1/subscription/feature/:feature
 */
export const checkFeatureAccess = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { feature } = req.params;

        if (!feature) {
            res.status(400).json({
                success: false,
                message: 'Feature name is required',
            });
            return;
        }

        const hasAccess = await subscriptionService.hasFeatureAccess(req.storeId, String(feature));

        res.status(200).json({
            success: true,
            data: {
                feature,
                hasAccess,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to check feature access';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

export default {
    getCurrentSubscription,
    getAvailablePlans,
    getTrialStatus,
    changePlan,
    renewSubscription,
    cancelSubscription,
    toggleAutoRenew,
    getSubscriptionHistory,
    getUsageStats,
    checkFeatureAccess,
};
