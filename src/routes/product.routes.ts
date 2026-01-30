import { Router } from 'express';
import productController from '../controllers/product.controller';
import { validateResult } from '../middleware/validation.middleware';
import { createProductSchema } from '../schemas/product.schema';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { verifySubscription, checkFeatureLimits } from '../middleware/subscription.middleware';
import { UserRole } from '@prisma/client';

import multer from 'multer';
import os from 'os';

const upload = multer({ dest: os.tmpdir() });

const router = Router();

// All product routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with filters
 * @access  Private
 */
router.get('/', productController.getProducts);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID
 * @access  Private
 */
router.get('/:id', productController.getProductById);

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Private (Owner, Admin, Manager, Pharmacist)
 * @limit   Check subscription plan maxProducts
 */
router.post(
    '/',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST),
    checkFeatureLimits('products'),
    validateResult(createProductSchema),
    productController.createProduct
);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update a product
 * @access  Private (Owner, Admin, Manager, Pharmacist)
 */
router.put(
    '/:id',
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST),
    productController.updateProduct
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete a product (soft delete)
 * @access  Private (Owner, Admin)
 */
router.delete(
    '/:id',
    authorize(UserRole.OWNER, UserRole.ADMIN),
    productController.deleteProduct
);

// Routes removed. Use billImport.routes.ts instead.

export default router;
