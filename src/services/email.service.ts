import nodemailer from 'nodemailer';

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // App password for Gmail
    },
});

const FROM_EMAIL = process.env.SMTP_FROM || 'MediX POS <noreply@medix.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Send an email
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]*>/g, ''),
        });
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
};

/**
 * Send verification OTP
 */
export const sendVerificationOTP = async (email: string, otp: string, firstName: string): Promise<boolean> => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 40px 0;">
                    <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 40px 30px; text-align: center;">
                                <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                    <span style="color: white; font-size: 32px; font-weight: bold;">M</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Welcome to MediX POS</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Hi <strong>${firstName}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                    Thank you for registering with MediX POS! Please use the following One-Time Password (OTP) to verify your email address.
                                </p>
                                
                                <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
                                    <span style="font-family: monospace; font-size: 32px; font-weight: 700; color: #1e40af; letter-spacing: 4px;">${otp}</span>
                                </div>
                                
                                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0;">
                                    If you didn't create an account with MediX POS, you can safely ignore this email.
                                </p>
                                
                                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                                    This OTP will expire in 1 hour.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                                    © ${new Date().getFullYear()} MediX POS. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Verify Your Email - MediX POS',
        html,
    });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string, token: string, firstName: string): Promise<boolean> => {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 40px 0;">
                    <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 40px 30px; text-align: center;">
                                <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                    <span style="color: white; font-size: 32px;">🔐</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Password Reset Request</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Hi <strong>${firstName}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    We received a request to reset the password for your MediX POS account. Click the button below to create a new password.
                                </p>
                                
                                <table role="presentation" style="width: 100%; margin: 30px 0;">
                                    <tr>
                                        <td style="text-align: center;">
                                            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                                                Reset Password
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <div style="background-color: #fef3cd; border-left: 4px solid #ffc107; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
                                    <p style="color: #856404; font-size: 14px; margin: 0;">
                                        <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
                                    </p>
                                </div>
                                
                                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                                    This link will expire in 1 hour for security reasons.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                                    © ${new Date().getFullYear()} MediX POS. All rights reserved.
                                </p>
                                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 10px 0 0;">
                                    If the button doesn't work, copy and paste this link into your browser:<br>
                                    <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Reset Your Password - MediX POS',
        html,
    });
};

/**
 * Send password reset OTP
 */
export const sendPasswordResetOTP = async (email: string, otp: string, firstName: string): Promise<boolean> => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 40px 0;">
                    <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 40px 30px; text-align: center;">
                                <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                    <span style="color: white; font-size: 32px;">🔐</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Password Reset OTP</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Hi <strong>${firstName}</strong>,
                                </p>
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                    Use the One-Time Password (OTP) below to reset your password.
                                </p>
                                
                                <div style="background-color: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
                                    <span style="font-family: monospace; font-size: 32px; font-weight: 700; color: #b91c1c; letter-spacing: 4px;">${otp}</span>
                                </div>
                                
                                <div style="background-color: #fef3cd; border-left: 4px solid #ffc107; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
                                    <p style="color: #856404; font-size: 14px; margin: 0;">
                                        <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email.
                                    </p>
                                </div>
                                
                                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                                    This OTP will expire in 1 hour.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                                    © ${new Date().getFullYear()} MediX POS. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Reset Password OTP - MediX POS',
        html,
    });
};

export default {
    sendEmail,
    sendVerificationOTP,
    sendPasswordResetEmail,
    sendPasswordResetOTP,
};
