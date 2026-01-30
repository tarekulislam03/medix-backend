import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { SubscriptionStatus, SubscriptionPlan } from '@prisma/client';

/**
 * Subscription status attached to request
 */
export interface SubscriptionInfo {
    id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    isTrialing: boolean;
    daysRemaining: number;
    isExpired: boolean;
}

/**
 * Extend Express Request to include subscription info
 */
declare global {
    namespace Express {
        interface Request {
            subscription?: SubscriptionInfo;
        }
    }
}

/**
 * Calculate days remaining until subscription ends
 */
const calculateDaysRemaining = (endDate: Date): number => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Subscription verification middleware
 * Checks if the store has an active subscription
 * Must be used after authenticate middleware
 */
export const verifySubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        // Get the latest subscription for the store
        const subscription = await prisma.subscription.findFirst({
            where: {
                storeId: req.storeId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!subscription) {
            res.status(403).json({
                success: false,
                message: 'No subscription found. Please subscribe to continue.',
                code: 'NO_SUBSCRIPTION',
            });
            return;
        }

        const now = new Date();
        const isExpired = subscription.endDate < now;
        const daysRemaining = calculateDaysRemaining(subscription.endDate);
        const isTrialing = subscription.plan === SubscriptionPlan.TRIAL;

        // Check subscription status
        if (subscription.status === SubscriptionStatus.CANCELLED) {
            res.status(403).json({
                success: false,
                message: 'Subscription has been cancelled. Please resubscribe to continue.',
                code: 'SUBSCRIPTION_CANCELLED',
            });
            return;
        }

        if (subscription.status === SubscriptionStatus.SUSPENDED) {
            res.status(403).json({
                success: false,
                message: 'Subscription has been suspended. Please contact support.',
                code: 'SUBSCRIPTION_SUSPENDED',
            });
            return;
        }

        if (subscription.status === SubscriptionStatus.EXPIRED || isExpired) {
            // Update subscription status if it wasn't already marked as expired
            if (subscription.status !== SubscriptionStatus.EXPIRED && isExpired) {
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: SubscriptionStatus.EXPIRED },
                });
            }

            res.status(403).json({
                success: false,
                message: isTrialing
                    ? 'Your free trial has expired. Please upgrade to continue.'
                    : 'Subscription has expired. Please renew to continue.',
                code: 'SUBSCRIPTION_EXPIRED',
                data: {
                    plan: subscription.plan,
                    expiredAt: subscription.endDate,
                },
            });
            return;
        }

        // Attach subscription info to request
        req.subscription = {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            isTrialing,
            daysRemaining,
            isExpired: false,
        };

        next();
    } catch (error) {
        console.error('Subscription middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying subscription',
        });
    }
};

/**
 * Plan-based feature access middleware
 * Restricts access based on subscription plan level
 */
export const requirePlan = (...allowedPlans: SubscriptionPlan[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.subscription) {
            res.status(403).json({
                success: false,
                message: 'Subscription verification required',
            });
            return;
        }

        if (!allowedPlans.includes(req.subscription.plan)) {
            res.status(403).json({
                success: false,
                message: `This feature requires ${allowedPlans.join(' or ')} plan`,
                code: 'PLAN_UPGRADE_REQUIRED',
                data: {
                    currentPlan: req.subscription.plan,
                    requiredPlans: allowedPlans,
                },
            });
            return;
        }

        next();
    };
};

/**
 * Feature limits middleware
 * Checks usage limits based on subscription plan
 */
export const checkFeatureLimits = (feature: string) => {
    // Define limits per plan
    const PLAN_LIMITS: Record<SubscriptionPlan, Record<string, number>> = {
        TRIAL: {
            products: 50,
            users: 2,
            bills_per_day: 20,
            customers: 100,
        },
        BASIC: {
            products: 500,
            users: 5,
            bills_per_day: 100,
            customers: 1000,
        },
        STANDARD: {
            products: 2000,
            users: 15,
            bills_per_day: 500,
            customers: 5000,
        },
        ADVANCED: {
            products: -1, // Unlimited
            users: -1,
            bills_per_day: -1,
            customers: -1,
        },
    };

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.subscription || !req.storeId) {
                res.status(403).json({
                    success: false,
                    message: 'Subscription verification required',
                });
                return;
            }

            const limits = PLAN_LIMITS[req.subscription.plan];
            const limit = limits[feature];

            // -1 means unlimited
            if (limit === -1) {
                next();
                return;
            }

            let currentCount = 0;

            // Check current usage based on feature
            switch (feature) {
                case 'products':
                    currentCount = await prisma.product.count({
                        where: { storeId: req.storeId },
                    });
                    break;
                case 'users':
                    currentCount = await prisma.user.count({
                        where: { storeId: req.storeId },
                    });
                    break;
                case 'customers':
                    currentCount = await prisma.customer.count({
                        where: { storeId: req.storeId },
                    });
                    break;
                case 'bills_per_day':
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    currentCount = await prisma.bill.count({
                        where: {
                            storeId: req.storeId,
                            createdAt: { gte: today },
                        },
                    });
                    break;
                default:
                    next();
                    return;
            }

            if (currentCount >= limit) {
                res.status(403).json({
                    success: false,
                    message: `${feature} limit reached for your plan. Please upgrade.`,
                    code: 'LIMIT_EXCEEDED',
                    data: {
                        feature,
                        limit,
                        current: currentCount,
                        plan: req.subscription.plan,
                    },
                });
                return;
            }

            next();
        } catch (error) {
            console.error('Feature limits check error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking feature limits',
            });
        }
    };
};

/**
 * Trial warning middleware
 * Adds warning headers for expiring trials
 */
export const trialWarning = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (req.subscription?.isTrialing && req.subscription.daysRemaining <= 3) {
        res.setHeader('X-Trial-Warning', 'true');
        res.setHeader('X-Trial-Days-Remaining', req.subscription.daysRemaining.toString());
    }
    next();
};

export default {
    verifySubscription,
    requirePlan,
    checkFeatureLimits,
    trialWarning,
};
