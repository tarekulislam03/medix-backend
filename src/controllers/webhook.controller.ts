import { Request, Response } from 'express';
import phonepeService from '../services/phonepe.service';

/**
 * Handle PhonePe webhook events
 * POST /api/v1/webhooks/payment
 * 
 * This endpoint receives webhook events from PhonePe.
 * Important: This endpoint should NOT require authentication
 * from our middleware as it's called directly by PhonePe servers.
 */
export const phonepeWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const xVerify = req.headers['x-verify'] as string;
        // PhonePe sends { response: "base64encoded..." } in body
        const { response: base64Response } = req.body;

        console.log('Received PhonePe webhook:', {
            signature: xVerify ? 'present' : 'missing',
            timestamp: new Date().toISOString(),
        });

        if (!base64Response || !xVerify) {
            res.status(400).json({
                success: false,
                message: 'Invalid webhook payload or signature',
            });
            return;
        }

        const result = await phonepeService.handleWebhook(base64Response, xVerify);

        if (result.success) {
            // always return 200 for success
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal webhook processing error',
        });
    }
};

/**
 * Health check for webhook endpoint
 * GET /api/v1/webhooks/health
 */
export const webhookHealth = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        message: 'Webhook endpoint is healthy',
        timestamp: new Date().toISOString(),
    });
};

export default {
    phonepeWebhook,
    webhookHealth,
};
