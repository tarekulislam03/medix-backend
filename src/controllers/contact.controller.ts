import { Request, Response } from 'express';
import { sendContactFormEmail } from '../services/email.service';

/**
 * Handle contact form submission
 * POST /api/v1/contact
 */
export const submitContactForm = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, message } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and Email are required.',
            });
        }

        const emailSent = await sendContactFormEmail(name, email, phone, message);

        if (emailSent) {
            return res.status(200).json({
                success: true,
                message: 'Thank you! Your message has been sent successfully.',
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to send email. Please try again later.',
            });
        }
    } catch (error) {
        console.error('Contact form error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred.',
        });
    }
};
