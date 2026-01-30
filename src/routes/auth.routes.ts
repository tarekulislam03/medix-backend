import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { validateResult } from '../middleware/validation.middleware';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new store with owner
 * @access  Public
 */
router.post('/register', validateResult(registerSchema), authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post('/login', authLimiter, validateResult(loginSchema), authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Public
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private (requires auth)
 */
import { authenticate } from '../middleware/auth.middleware';
router.post('/change-password', authenticate, authController.changePassword);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify user email with OTP
 * @access  Public
 */
router.post('/verify-otp', authLimiter, authController.verifyOTP);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', authLimiter, authController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', authLimiter, authController.resetPassword);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post('/resend-verification', authLimiter, authController.resendVerification);

export default router;
