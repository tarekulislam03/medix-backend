import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { limiter } from './middleware/rateLimit.middleware';
import { errorHandler } from './middleware/error.middleware';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';
import dashboardRoutes from './routes/dashboard.routes';
import productRoutes from './routes/product.routes';
import notificationRoutes from './routes/notification.routes';
import billingRoutes from './routes/billing.routes';
import customerRoutes from './routes/customer.routes';
import printingRoutes from './routes/printing.routes';
import analyticsRoutes from './routes/analytics.routes';
import billImportRoutes from './routes/billImport.routes';

// Create Express application
const app: Application = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Welcome to Pharmacy POS API',
        version: '1.0.0',
        documentation: '/api-docs', // If you have docs later
        status: 'online'
    });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        message: 'Pharmacy POS API is running',
        timestamp: new Date().toISOString(),
    });
});

// Rate Limiter
app.use('/api', limiter);

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/printing', printingRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/inventory', billImportRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Global error handler
app.use(errorHandler);

export default app;
