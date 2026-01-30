import { Request, Response } from 'express';
import { ProductCategory } from '@prisma/client';
import productService from '../services/product.service';

/**
 * Create a new product
 * POST /api/v1/products
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const input = req.body;

        // Basic validation
        if (!input.name || !input.sku || !input.costPrice || !input.sellingPrice) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: name, sku, costPrice, sellingPrice',
            });
            return;
        }

        const product = await productService.createProduct(req.storeId, {
            ...input,
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
            manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : undefined,
        });

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product,
        });
    } catch (error) {
        console.error('Product creation error:', error);
        const message = error instanceof Error ? error.message : 'Failed to create product';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Get all products
 * GET /api/v1/products
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        // Filters
        const search = req.query.search as string;
        const category = req.query.category as ProductCategory;
        const lowStock = req.query.lowStock === 'true';
        const expiring = req.query.expiring === 'true';

        const result = await productService.getProducts(
            req.storeId,
            { search, category, lowStock, expiring },
            page,
            limit
        );

        res.status(200).json({
            success: true,
            data: result.products,
            pagination: result.pagination,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get products';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get product by ID
 * GET /api/v1/products/:id
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { id } = req.params;
        const product = await productService.getProductById(req.storeId, String(id));

        if (!product || product.storeId !== req.storeId) {
            res.status(404).json({
                success: false,
                message: 'Product not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get product';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Update product
 * PUT /api/v1/products/:id
 */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { id } = req.params;
        const input = req.body;

        const product = await productService.updateProduct(req.storeId, String(id), {
            ...input,
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
            manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : undefined,
        });

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: product,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update product';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Delete product
 * DELETE /api/v1/products/:id
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        const { id } = req.params;
        await productService.deleteProduct(req.storeId, String(id));

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete product';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

// Methods removed. Use billImport.controller.ts instead.

export default {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
};
