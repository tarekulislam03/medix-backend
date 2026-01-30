import { Request } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Authenticated user payload attached to request
 */
export interface AuthUser {
    userId: string;
    storeId: string;
    email: string;
    role: UserRole;
}

/**
 * Extended Express Request with authentication data
 */
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
    storeId: string;
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
    return 'user' in req && 'storeId' in req;
}
