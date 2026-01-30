import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

/**
 * @route   GET /api/v1/webhooks/health
 * @desc    Health check for webhook endpoint
 * @access  Public
 */
router.get('/health', webhookController.webhookHealth);

/**
 * @route   POST /api/v1/webhooks/phonepe
 * @desc    Handle PhonePe webhook events
 * @access  Public (verified via signature)
 * 
 * Note: This endpoint does NOT use authentication middleware
 * because it's called directly by PhonePe servers.
 * Verification is done via webhook signature (X-VERIFY).
 */
router.post('/phonepe', webhookController.phonepeWebhook);

export default router;
