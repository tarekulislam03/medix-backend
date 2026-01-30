import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validateResult = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        return next();
    } catch (error) {
        if (error instanceof ZodError) {
            // Explicit cast to any to avoid TS linter issues with 'unknown' type
            const zError = error as any;
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: zError.errors?.map((e: any) => ({
                    field: e.path?.join('.') || 'unknown',
                    message: e.message,
                })) || [],
            });
        }
        return next(error);
    }
};
