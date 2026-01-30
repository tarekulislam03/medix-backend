import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, DecodedToken } from '../utils/jwt';
import prisma from '../config/database';
import { AuthUser } from '../types/express';
import { UserRole } from '@prisma/client';

/**
 * Extend Express Request to include user and storeId
 */
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
            storeId?: string;
        }
    }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user/storeId to request
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Access token is required',
            });
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Invalid token format',
            });
            return;
        }

        // Verify token
        let decoded: DecodedToken;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            res.status(401).json({
                success: false,
                message: 'Invalid or expired token',
            });
            return;
        }

        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                storeId: true,
            },
        });

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        if (user.status !== 'ACTIVE') {
            res.status(403).json({
                success: false,
                message: 'Account is suspended or inactive',
            });
            return;
        }

        // Attach user and storeId to request
        req.user = {
            userId: user.id,
            storeId: user.storeId,
            email: user.email,
            role: user.role,
        };
        req.storeId = user.storeId;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error',
        });
    }
};

/**
 * Role-based authorization middleware
 * Must be used after authenticate middleware
 */
export const authorize = (...allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
            });
            return;
        }

        next();
    };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't block if missing
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            next();
            return;
        }

        try {
            const decoded = verifyAccessToken(token);

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    status: true,
                    storeId: true,
                },
            });

            if (user && user.status === 'ACTIVE') {
                req.user = {
                    userId: user.id,
                    storeId: user.storeId,
                    email: user.email,
                    role: user.role,
                };
                req.storeId = user.storeId;
            }
        } catch {
            // Token invalid, continue without auth
        }

        next();
    } catch (error) {
        next();
    }
};

/**
 * Store ownership middleware
 * Ensures the authenticated user belongs to the store in the request
 */
export const ensureStoreAccess = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
        });
        return;
    }

    // Get storeId from params or query
    const requestedStoreId = req.params.storeId || req.query.storeId;

    if (requestedStoreId && requestedStoreId !== req.user.storeId) {
        res.status(403).json({
            success: false,
            message: 'Access denied to this store',
        });
        return;
    }

    next();
};

export default {
    authenticate,
    authorize,
    optionalAuth,
    ensureStoreAccess,
};
