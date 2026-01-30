import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6),
        firstName: z.string().min(1).optional(), // Make optional here if controller handles it or logic
        ownerName: z.string().min(1), // Changed to ownerName to match controller
        storeName: z.string().min(1),
        phone: z.string().min(10).optional(),
        plan: z.enum(['TRIAL', 'BASIC', 'STANDARD', 'ADVANCED']).optional(),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
    }),
});
