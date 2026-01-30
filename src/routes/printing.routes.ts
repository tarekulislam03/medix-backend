import { Router } from 'express';
import printingController from '../controllers/printing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

// All routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

/**
 * @route   GET /api/v1/printing/bills/:id/pdf
 * @desc    Get Bill PDF (thermal format)
 * @access  Private
 */
router.get('/bills/:id/pdf', printingController.printBill);

/**
 * @route   GET /api/v1/printing/bills/:id/html
 * @desc    Get Bill HTML for print preview
 * @access  Private
 */
router.get('/bills/:id/html', printingController.printBillHtml);

export default router;
