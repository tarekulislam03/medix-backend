import { Request, Response } from 'express';
import authService from '../services/auth.service';

/**
 * Register a new store with owner
 * POST /api/v1/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { storeName, ownerName, email, password, plan } = req.body;

        // Validate required fields
        if (!storeName || !ownerName || !email || !password) {
            res.status(400).json({
                success: false,
                message: 'All fields are required: storeName, ownerName, email, password',
            });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                message: 'Invalid email format',
            });
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long',
            });
            return;
        }

        const result = await authService.register({
            storeName,
            ownerName,
            email,
            password,
            plan,
        });

        res.status(201).json({
            success: true,
            message: 'Store registered successfully. Your 7-day free trial has started!',
            data: result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Login with email and password
 * POST /api/v1/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
            return;
        }

        const result = await authService.login({ email, password });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        res.status(401).json({
            success: false,
            message,
        });
    }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message: 'Refresh token is required',
            });
            return;
        }

        const tokens = await authService.refreshToken(refreshToken);

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: tokens,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Token refresh failed';
        res.status(401).json({
            success: false,
            message,
        });
    }
};

/**
 * Logout (client-side token removal)
 * POST /api/v1/auth/logout
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
    // In a JWT-based system, logout is typically handled client-side
    // by removing tokens from storage. This endpoint is for consistency.
    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
};

/**
 * Change password
 * POST /api/v1/auth/change-password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({
                success: false,
                message: 'Current password and new password are required',
            });
            return;
        }

        if (newPassword.length < 8) {
            res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long',
            });
            return;
        }

        await authService.changePassword(userId, currentPassword, newPassword);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to change password';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Verify email with OTP
 * POST /api/v1/auth/verify-otp
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            res.status(400).json({
                success: false,
                message: 'Email and OTP are required',
            });
            return;
        }

        const result = await authService.verifyOTP(email, otp);

        // Return full auth data for auto-login
        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                user: result.user,
                store: result.store,
                subscription: result.subscription,
                tokens: result.tokens,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'OTP verification failed';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email is required',
            });
            return;
        }

        const result = await authService.forgotPassword(email);

        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process request';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp, password } = req.body;

        if (!email || !otp) {
            res.status(400).json({
                success: false,
                message: 'Email and OTP are required',
            });
            return;
        }

        if (!password || password.length < 8) {
            res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long',
            });
            return;
        }

        const result = await authService.resetPassword(email, otp, password);

        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Password reset failed';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Resend verification OTP
 * POST /api/v1/auth/resend-verification
 */
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email is required',
            });
            return;
        }

        const result = await authService.resendVerificationOTP(email);

        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to resend verification OTP';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

export default {
    register,
    login,
    refresh,
    logout,
    changePassword,
    verifyOTP,
    forgotPassword,
    resetPassword,
    resendVerification,
};
