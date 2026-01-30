// Authentication middleware
export {
    authenticate,
    authorize,
    optionalAuth,
    ensureStoreAccess,
} from './auth.middleware';

// Subscription middleware
export {
    verifySubscription,
    requirePlan,
    checkFeatureLimits,
    trialWarning,
} from './subscription.middleware';

// Types
export type { SubscriptionInfo } from './subscription.middleware';
