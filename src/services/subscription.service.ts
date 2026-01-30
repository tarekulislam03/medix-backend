import prisma from '../config/database';
import { SubscriptionPlan, SubscriptionStatus, Prisma, Subscription } from '@prisma/client';

// ============================================
// PLAN CONFIGURATION
// ============================================

export interface PlanFeatures {
    maxProducts: number;
    maxUsers: number;
    maxCustomers: number;
    maxBillsPerDay: number;
    features: string[];
}

export interface PlanPricing {
    monthly: number;
    yearly: number;
    currency: string;
}

export interface PlanDetails {
    name: string;
    description: string;
    pricing: PlanPricing;
    features: PlanFeatures;
}

export const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
    TRIAL: {
        name: 'Free Trial',
        description: '7-day free trial with limited features',
        pricing: {
            monthly: 0,
            yearly: 0,
            currency: 'INR',
        },
        features: {
            maxProducts: 50,
            maxUsers: 2,
            maxCustomers: 100,
            maxBillsPerDay: 20,
            features: [
                'Basic POS',
                'Inventory Management (50 products)',
                'Customer Management (100 customers)',
                'Basic Reports',
            ],
        },
    },
    BASIC: {
        name: 'Basic',
        description: 'For small pharmacies just getting started',
        pricing: {
            monthly: 999,
            yearly: 9990,
            currency: 'INR',
        },
        features: {
            maxProducts: 500,
            maxUsers: 5,
            maxCustomers: 1000,
            maxBillsPerDay: 100,
            features: [
                'Full POS System',
                'Inventory Management (500 products)',
                'Customer Management (1,000 customers)',
                'Basic Reports & Analytics',
                'Email Support',
                'Expiry Alerts',
            ],
        },
    },
    STANDARD: {
        name: 'Standard',
        description: 'For growing pharmacies with more needs',
        pricing: {
            monthly: 2499,
            yearly: 24990,
            currency: 'INR',
        },
        features: {
            maxProducts: 2000,
            maxUsers: 15,
            maxCustomers: 5000,
            maxBillsPerDay: 500,
            features: [
                'Everything in Basic',
                'Inventory Management (2,000 products)',
                'Customer Management (5,000 customers)',
                'Advanced Reports & Analytics',
                'Multi-user Access (15 users)',
                'Priority Support',
                'Low Stock Alerts',
                'Batch & Expiry Tracking',
                'Customer Loyalty Program',
            ],
        },
    },
    ADVANCED: {
        name: 'Advanced',
        description: 'For large pharmacies with unlimited needs',
        pricing: {
            monthly: 4999,
            yearly: 49990,
            currency: 'INR',
        },
        features: {
            maxProducts: -1, // Unlimited
            maxUsers: -1,
            maxCustomers: -1,
            maxBillsPerDay: -1,
            features: [
                'Everything in Standard',
                'Unlimited Products',
                'Unlimited Users',
                'Unlimited Customers',
                'API Access',
                'Custom Reports',
                'Dedicated Account Manager',
                '24/7 Priority Support',
                'Multi-branch Support',
                'Data Export',
                'White-label Options',
            ],
        },
    },
};

// ============================================
// SUBSCRIPTION SERVICE
// ============================================

export interface SubscriptionResponse {
    id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    trialEndsAt: Date | null;
    isTrialing: boolean;
    daysRemaining: number;
    isExpired: boolean;
    autoRenew: boolean;
    planDetails: PlanDetails;
}

/**
 * Calculate days remaining until a date
 */
const calculateDaysRemaining = (endDate: Date): number => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

/**
 * Get current subscription for a store
 */
export const getCurrentSubscription = async (storeId: string): Promise<SubscriptionResponse | null> => {
    const subscription = await prisma.subscription.findFirst({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
        return null;
    }

    const now = new Date();
    const isExpired = subscription.endDate < now;
    const daysRemaining = calculateDaysRemaining(subscription.endDate);
    const isTrialing = subscription.plan === SubscriptionPlan.TRIAL;

    return {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndsAt: subscription.trialEndsAt,
        isTrialing,
        daysRemaining,
        isExpired,
        autoRenew: subscription.autoRenew,
        planDetails: PLAN_DETAILS[subscription.plan],
    };
};

/**
 * Get all available plans
 */
export const getAvailablePlans = () => {
    return Object.entries(PLAN_DETAILS)
        .filter(([plan]) => plan !== 'TRIAL') // Don't show trial as an option
        .map(([plan, details]) => ({
            plan,
            ...details,
        }));
};

/**
 * Check if subscription is active
 */
export const isSubscriptionActive = async (storeId: string): Promise<boolean> => {
    const subscription = await getCurrentSubscription(storeId);

    if (!subscription) {
        return false;
    }

    return (
        subscription.status === SubscriptionStatus.ACTIVE &&
        !subscription.isExpired
    );
};

/**
 * Check trial status
 */
export const checkTrialStatus = async (storeId: string): Promise<{
    isTrialing: boolean;
    trialExpired: boolean;
    daysRemaining: number;
}> => {
    const subscription = await getCurrentSubscription(storeId);

    if (!subscription || !subscription.isTrialing) {
        return {
            isTrialing: false,
            trialExpired: false,
            daysRemaining: 0,
        };
    }

    return {
        isTrialing: true,
        trialExpired: subscription.isExpired,
        daysRemaining: subscription.daysRemaining,
    };
};

/**
 * Upgrade or change subscription plan
 */
export const changePlan = async (
    storeId: string,
    newPlan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    paymentId?: string
): Promise<SubscriptionResponse> => {
    // Validate plan
    if (!Object.keys(PLAN_DETAILS).includes(newPlan) || newPlan === SubscriptionPlan.TRIAL) {
        throw new Error('Invalid plan selected');
    }

    const planDetails = PLAN_DETAILS[newPlan];
    const amount = billingCycle === 'yearly' ? planDetails.pricing.yearly : planDetails.pricing.monthly;
    const durationDays = billingCycle === 'yearly' ? 365 : 30;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Create new subscription (deactivate old ones)
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Mark all existing subscriptions as cancelled
        await tx.subscription.updateMany({
            where: {
                storeId,
                status: SubscriptionStatus.ACTIVE,
            },
            data: {
                status: SubscriptionStatus.CANCELLED,
            },
        });

        // Create new subscription
        const subscription = await tx.subscription.create({
            data: {
                storeId,
                plan: newPlan,
                status: SubscriptionStatus.ACTIVE,
                startDate,
                endDate,
                billingCycleStart: startDate,
                billingCycleEnd: endDate,
                amount,
                currency: planDetails.pricing.currency,
                autoRenew: true,
                paymentId,
            },
        });

        return subscription;
    });

    return {
        id: result.id,
        plan: result.plan,
        status: result.status,
        startDate: result.startDate,
        endDate: result.endDate,
        trialEndsAt: result.trialEndsAt,
        isTrialing: false,
        daysRemaining: calculateDaysRemaining(result.endDate),
        isExpired: false,
        autoRenew: result.autoRenew,
        planDetails: PLAN_DETAILS[result.plan],
    };
};

/**
 * Renew existing subscription
 */
export const renewSubscription = async (
    storeId: string,
    paymentId?: string
): Promise<SubscriptionResponse> => {
    const currentSubscription = await prisma.subscription.findFirst({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
    });

    if (!currentSubscription) {
        throw new Error('No subscription found to renew');
    }

    if (currentSubscription.plan === SubscriptionPlan.TRIAL) {
        throw new Error('Cannot renew trial. Please upgrade to a paid plan.');
    }

    const planDetails = PLAN_DETAILS[currentSubscription.plan];

    // Determine billing cycle based on previous subscription
    const previousDuration = Math.ceil(
        (currentSubscription.endDate.getTime() - currentSubscription.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const isYearly = previousDuration > 60;
    const durationDays = isYearly ? 365 : 30;
    const amount = isYearly ? planDetails.pricing.yearly : planDetails.pricing.monthly;

    // Start from end date if not expired, otherwise from now
    const startDate = currentSubscription.endDate > new Date()
        ? currentSubscription.endDate
        : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const result = await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            billingCycleStart: startDate,
            billingCycleEnd: endDate,
            amount,
            paymentId,
        },
    });

    return {
        id: result.id,
        plan: result.plan,
        status: result.status,
        startDate: result.startDate,
        endDate: result.endDate,
        trialEndsAt: result.trialEndsAt,
        isTrialing: false,
        daysRemaining: calculateDaysRemaining(result.endDate),
        isExpired: false,
        autoRenew: result.autoRenew,
        planDetails: PLAN_DETAILS[result.plan],
    };
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (storeId: string): Promise<SubscriptionResponse> => {
    const currentSubscription = await prisma.subscription.findFirst({
        where: {
            storeId,
            status: SubscriptionStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
    });

    if (!currentSubscription) {
        throw new Error('No active subscription found');
    }

    const result = await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
            status: SubscriptionStatus.CANCELLED,
            autoRenew: false,
        },
    });

    return {
        id: result.id,
        plan: result.plan,
        status: result.status,
        startDate: result.startDate,
        endDate: result.endDate,
        trialEndsAt: result.trialEndsAt,
        isTrialing: result.plan === SubscriptionPlan.TRIAL,
        daysRemaining: calculateDaysRemaining(result.endDate),
        isExpired: result.endDate < new Date(),
        autoRenew: result.autoRenew,
        planDetails: PLAN_DETAILS[result.plan],
    };
};

/**
 * Toggle auto-renewal
 */
export const toggleAutoRenew = async (storeId: string): Promise<boolean> => {
    const currentSubscription = await prisma.subscription.findFirst({
        where: {
            storeId,
            status: SubscriptionStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
    });

    if (!currentSubscription) {
        throw new Error('No active subscription found');
    }

    const result = await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
            autoRenew: !currentSubscription.autoRenew,
        },
    });

    return result.autoRenew;
};

/**
 * Get subscription history for a store
 */
export const getSubscriptionHistory = async (storeId: string) => {
    const subscriptions = await prisma.subscription.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((sub: Subscription) => ({
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        amount: sub.amount,
        currency: sub.currency,
        createdAt: sub.createdAt,
    }));
};

/**
 * Check feature access based on plan
 */
export const hasFeatureAccess = async (
    storeId: string,
    feature: string
): Promise<boolean> => {
    const subscription = await getCurrentSubscription(storeId);

    if (!subscription || subscription.isExpired || subscription.status !== SubscriptionStatus.ACTIVE) {
        return false;
    }

    const planFeatures = subscription.planDetails.features.features;

    // Advanced plan has access to everything
    if (subscription.plan === SubscriptionPlan.ADVANCED) {
        return true;
    }

    // Check if feature is in the plan's feature list
    return planFeatures.some(f => f.toLowerCase().includes(feature.toLowerCase()));
};

/**
 * Get usage statistics for a store
 */
export const getUsageStats = async (storeId: string) => {
    const subscription = await getCurrentSubscription(storeId);

    if (!subscription) {
        throw new Error('No subscription found');
    }

    const [productCount, userCount, customerCount, todayBillCount] = await Promise.all([
        prisma.product.count({ where: { storeId } }),
        prisma.user.count({ where: { storeId } }),
        prisma.customer.count({ where: { storeId } }),
        prisma.bill.count({
            where: {
                storeId,
                createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
        }),
    ]);

    const limits = subscription.planDetails.features;

    return {
        products: {
            used: productCount,
            limit: limits.maxProducts,
            unlimited: limits.maxProducts === -1,
            percentage: limits.maxProducts === -1 ? 0 : Math.round((productCount / limits.maxProducts) * 100),
        },
        users: {
            used: userCount,
            limit: limits.maxUsers,
            unlimited: limits.maxUsers === -1,
            percentage: limits.maxUsers === -1 ? 0 : Math.round((userCount / limits.maxUsers) * 100),
        },
        customers: {
            used: customerCount,
            limit: limits.maxCustomers,
            unlimited: limits.maxCustomers === -1,
            percentage: limits.maxCustomers === -1 ? 0 : Math.round((customerCount / limits.maxCustomers) * 100),
        },
        billsToday: {
            used: todayBillCount,
            limit: limits.maxBillsPerDay,
            unlimited: limits.maxBillsPerDay === -1,
            percentage: limits.maxBillsPerDay === -1 ? 0 : Math.round((todayBillCount / limits.maxBillsPerDay) * 100),
        },
    };
};

export default {
    getCurrentSubscription,
    getAvailablePlans,
    isSubscriptionActive,
    checkTrialStatus,
    changePlan,
    renewSubscription,
    cancelSubscription,
    toggleAutoRenew,
    getSubscriptionHistory,
    hasFeatureAccess,
    getUsageStats,
    PLAN_DETAILS,
};
