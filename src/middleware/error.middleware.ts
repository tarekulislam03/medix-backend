import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(`[Error] ${req.method} ${req.url}:`, err);

    let statusCode = 500;
    let message = 'Internal Server Error';

    // Handle Prisma unique constraint violations (P2002) - Duck Typing check to avoid import issues
    if (err.code === 'P2002') {
        statusCode = 409;
        message = 'A record with this unique field already exists.';
    } else if (err.code === 'P2025') {
        statusCode = 404;
        message = 'Record not found.';
    } else if (err.name === 'PrismaClientKnownRequestError') {
        message = `Database Error: ${err.message}`;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    } else if (err.message === 'Authentication required' || err.message === 'Invalid token') {
        statusCode = 401;
        message = err.message;
    } else if (err.message === 'Insufficient permissions') {
        statusCode = 403;
        message = err.message;
    } else if (err.statusCode) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof Error) {
        message = err.message;
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
