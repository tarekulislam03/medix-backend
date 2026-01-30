import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/database';
import { generateTokens, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { UserRole, SubscriptionPlan, SubscriptionStatus, Prisma } from '@prisma/client';
import emailService from './email.service';

// Constants
const SALT_ROUNDS = 12;
const TRIAL_DURATION_DAYS = 7;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;

export interface RegisterInput {
    storeName: string;
    ownerName: string;
    email: string;
    password: string;
    plan?: SubscriptionPlan;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        role: UserRole;
        emailVerified?: boolean;
    };
    store: {
        id: string;
        name: string;
        slug: string;
    };
    subscription: {
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
        trialEndsAt: Date | null;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
    message?: string;
}

/**
 * Generate a URL-friendly slug from store name
 */
const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .concat('-', Date.now().toString(36));
};

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

/**
 * Register a new store with owner and trial subscription
 */
export const register = async (input: RegisterInput): Promise<AuthResponse> => {
    const { storeName, ownerName, email, password, plan } = input;

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
    });

    if (existingUser) {
        throw new Error('Email already registered');
    }

    // Check if store name already exists - REMOVED per user request to allow duplicate names
    // const existingStore = await prisma.store.findFirst({
    //     where: { name: storeName },
    // });

    // if (existingStore) {
    //     throw new Error('Store name already taken');
    // }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Parse owner name
    const nameParts = ownerName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || null;

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    // Generate numeric OTP
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 1); // 1 hour expiry for OTP

    // Create store, owner, and subscription in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create the store
        const store = await tx.store.create({
            data: {
                name: storeName,
                slug: generateSlug(storeName),
                email: email.toLowerCase(),
            },
        });

        // Create owner user with verification token
        const user = await tx.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                firstName,
                lastName,
                role: UserRole.OWNER,
                storeId: store.id,
                emailVerified: false,
                verificationToken,
                verificationTokenExpiry,
            },
        });

        // Create subscription
        const subscription = await tx.subscription.create({
            data: {
                plan: plan || SubscriptionPlan.TRIAL,
                status: SubscriptionStatus.ACTIVE,
                startDate: new Date(),
                endDate: trialEndsAt,
                trialEndsAt,
                storeId: store.id,
            },
        });

        return { store, user, subscription };
    });

    // Send verification OTP (async, don't wait)
    try {
        await emailService.sendVerificationOTP(
            result.user.email,
            verificationToken,
            result.user.firstName
        );
    } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails - user can request resend
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
        userId: result.user.id,
        storeId: result.store.id,
        email: result.user.email,
        role: result.user.role,
    };

    const tokens = generateTokens(tokenPayload);

    return {
        user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            role: result.user.role,
            emailVerified: false,
        },
        store: {
            id: result.store.id,
            name: result.store.name,
            slug: result.store.slug,
        },
        subscription: {
            plan: result.subscription.plan,
            status: result.subscription.status,
            trialEndsAt: result.subscription.trialEndsAt,
        },
        tokens,
        message: 'Registration successful! Please check your email for the OTP to verify your account.',
    };
};

/**
 * Login with email and password
 */
export const login = async (input: LoginInput): Promise<AuthResponse> => {
    const { email, password } = input;

    // Find user by email
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
        include: {
            store: true,
        },
    });

    if (!user) {
        throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
        throw new Error('Account is not active. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    // Check if email is verified
    if (!user.emailVerified) {
        // Generate new OTP and send it
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                verificationToken: token,
                verificationTokenExpiry: expiresAt,
            },
        });

        try {
            await emailService.sendVerificationOTP(user.email, token, user.firstName);
        } catch (error) {
            console.error('Failed to send verification OTP:', error);
        }

        throw new Error('Email not verified. A new verification code has been sent to your email.');
    }

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
        where: {
            storeId: user.storeId,
            status: SubscriptionStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
        throw new Error('No active subscription found. Please contact support.');
    }

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokenPayload: TokenPayload = {
        userId: user.id,
        storeId: user.storeId,
        email: user.email,
        role: user.role,
    };

    const tokens = generateTokens(tokenPayload);

    return {
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        },
        store: {
            id: user.store.id,
            name: user.store.name,
            slug: user.store.slug,
        },
        subscription: {
            plan: subscription.plan,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
        },
        tokens,
    };
};

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (refreshTokenStr: string): Promise<{ accessToken: string; refreshToken: string }> => {
    try {
        // Verify refresh token
        const decoded = verifyRefreshToken(refreshTokenStr);

        // Check if user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user || user.status !== 'ACTIVE') {
            throw new Error('User not found or inactive');
        }

        // Generate new tokens
        const tokenPayload: TokenPayload = {
            userId: user.id,
            storeId: user.storeId,
            email: user.email,
            role: user.role,
        };

        return generateTokens(tokenPayload);
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
};

/**
 * Change user password
 */
export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<void> => {
    // Find user
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
    });
};

/**
 * Generate a secure verification token
 */
const generateVerificationToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Send verification email to a user
 */
export const sendVerificationEmailToUser = async (userId: string): Promise<boolean> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new Error('User not found');
    }

    if (user.emailVerified) {
        throw new Error('Email is already verified');
    }

    // Generate OTP
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Update user with verification token
    await prisma.user.update({
        where: { id: userId },
        data: {
            verificationToken: token,
            verificationTokenExpiry: expiresAt,
        },
    });

    // Send verification OTP
    return emailService.sendVerificationOTP(user.email, token, user.firstName);
};

/**
 * Verify user email with OTP
 */
export const verifyOTP = async (email: string, otp: string): Promise<AuthResponse & { success: boolean; message: string }> => {
    if (!email || !otp) {
        throw new Error('Email and OTP are required');
    }

    // Find user by email
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
        include: {
            store: true,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Check if email already verified
    if (user.emailVerified) {
        // If already verified, just login
        // But for security, maybe we should require password? 
        // For this flow, we assume coming from registration context.
        // However, if we want to be strict, we check if OTP matches.
        // If user is verified, OTP column should be null.
        throw new Error('Email is already verified. Please login.');
    }

    // Check OTP
    if (user.verificationToken !== otp) {
        throw new Error('Invalid OTP');
    }

    // Check if token has expired
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
        throw new Error('OTP has expired. Please request a new one.');
    }

    // Mark email as verified
    await prisma.user.update({
        where: { id: user.id },
        data: {
            emailVerified: true,
            verificationToken: null,
            verificationTokenExpiry: null,
        },
    });

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
        where: {
            storeId: user.storeId,
            status: SubscriptionStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
        throw new Error('No active subscription found');
    }

    // Generate tokens for auto-login
    const tokenPayload: TokenPayload = {
        userId: user.id,
        storeId: user.storeId,
        email: user.email,
        role: user.role,
    };

    const tokens = generateTokens(tokenPayload);

    return {
        success: true,
        message: 'Email verified successfully',
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            emailVerified: true,
        },
        store: {
            id: user.store.id,
            name: user.store.name,
            slug: user.store.slug,
        },
        subscription: {
            plan: subscription.plan,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
        },
        tokens,
    };
};

/**
 * Request password reset - sends reset OTP
 */
export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists for security
    if (!user) {
        return { success: true, message: 'If an account with that email exists, an OTP has been sent.' };
    }

    // Generate numeric OTP
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Update user with reset token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetPasswordToken: token,
            resetPasswordExpiry: expiresAt,
        },
    });

    // Send reset email with OTP
    await emailService.sendPasswordResetOTP(user.email, token, user.firstName);

    return { success: true, message: 'If an account with that email exists, an OTP has been sent.' };
};

/**
 * Reset password using OTP
 */
export const resetPassword = async (email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!email || !otp) {
        throw new Error('Email and OTP are required');
    }

    if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    // Find user by email
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Check OTP
    if (user.resetPasswordToken !== otp) {
        throw new Error('Invalid or expired OTP');
    }

    // Check if token has expired
    if (user.resetPasswordExpiry && user.resetPasswordExpiry < new Date()) {
        throw new Error('OTP has expired. Please request a new one.');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpiry: null,
        },
    });

    return { success: true, message: 'Password reset successfully. You can now login with your new password.' };
};

/**
 * Resend verification OTP
 */
export const resendVerificationOTP = async (email: string): Promise<{ success: boolean; message: string }> => {
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
    });

    if (!user) {
        // Don't reveal if user exists
        return { success: true, message: 'If an account with that email exists, a verification OTP has been sent.' };
    }

    if (user.emailVerified) {
        throw new Error('Email is already verified');
    }

    // Generate new OTP
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Update user with new verification token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            verificationToken: token,
            verificationTokenExpiry: expiresAt,
        },
    });

    // Send verification OTP
    await emailService.sendVerificationOTP(user.email, token, user.firstName);

    return { success: true, message: 'If an account with that email exists, a verification OTP has been sent.' };
};

export default {
    register,
    login,
    refreshToken,
    changePassword,
    sendVerificationEmailToUser,
    verifyOTP,
    forgotPassword,
    resetPassword,
    resendVerificationOTP,
};
