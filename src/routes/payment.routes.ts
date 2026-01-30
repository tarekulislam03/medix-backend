import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * @route   POST /api/v1/payments/create-order
 * @desc    Create a Razorpay order for subscription payment
 * @access  Private (Owner only)
 */
router.post(
    '/create-order',
    authenticate,
    authorize(UserRole.OWNER),
    paymentController.createOrder
);

/**
 * @route   POST /api/v1/payments/redirect
 * @desc    Handle PhonePe payment redirect (Public)
 * @access  Public
 */
router.post('/redirect', paymentController.handlePaymentRedirect);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verify payment after Razorpay checkout
 * @access  Private (Owner only)
 */
router.post(
    '/verify',
    authenticate,
    authorize(UserRole.OWNER),
    paymentController.verifyPayment
);

/**
 * @route   GET /api/v1/payments/:paymentId
 * @desc    Get payment status
 * @access  Private (Owner/Admin only)
 */
router.get(
    '/:paymentId',
    authenticate,
    authorize(UserRole.OWNER, UserRole.ADMIN),
    paymentController.getPaymentStatus
);

/**
 * @route   POST /api/v1/payments/:paymentId/refund
 * @desc    Process refund for a payment
 * @access  Private (Owner only)
 */
router.post(
    '/:paymentId/refund',
    authenticate,
    authorize(UserRole.OWNER),
    paymentController.refundPayment
);

export default router;
