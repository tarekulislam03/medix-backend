import { Router } from 'express';
import billingController from '../controllers/billing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

// All billing routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

/**
 * @route   GET /api/v1/billing/bills
 * @desc    Get bills history
 * @access  Private
 */
router.get('/bills', billingController.getBills);

/**
 * @route   POST /api/v1/billing/bills
 * @desc    Create new bill (POS transaction)
 * @access  Private
 */
router.post('/bills', billingController.createBill);

/**
 * @route   GET /api/v1/billing/bills/:id
 * @desc    Get bill details
 * @access  Private
 */
router.get('/bills/:id', billingController.getBillById);

/**
 * @route   GET /api/v1/billing/products/search
 * @desc    Search products for POS
 * @access  Private
 */
router.get('/products/search', billingController.searchProducts);

export default router;
