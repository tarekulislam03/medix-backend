import jwt, { JwtPayload, SignOptions, Secret } from 'jsonwebtoken';

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_SECRET: Secret = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret';
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

export interface TokenPayload {
    userId: string;
    storeId: string;
    email: string;
    role: string;
}

export interface DecodedToken extends JwtPayload, TokenPayload { }

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    const options: SignOptions = {
        expiresIn: JWT_EXPIRES_IN,
    };
    return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
    const options: SignOptions = {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    };
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, options);
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): DecodedToken => {
    return jwt.verify(token, JWT_SECRET) as DecodedToken;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): DecodedToken => {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as DecodedToken;
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokens = (payload: TokenPayload) => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
    };
};

export default {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateTokens,
};
