import prisma from '../config/database';
import { Product, ProductCategory, Prisma } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface CreateProductInput {
    name: string;
    genericName?: string;
    sku: string;
    barcode?: string;
    category: ProductCategory;
    manufacturer?: string;
    supplier?: string;
    description?: string;

    // Pricing
    costPrice: number;
    sellingPrice: number;
    mrp: number;
    taxPercent?: number;
    discountPercent?: number;

    // Inventory
    quantity: number;
    minStockLevel?: number;
    maxStockLevel?: number;
    reorderLevel?: number;
    unit?: string;

    // Pharmacy specific
    batchNumber?: string;
    expiryDate?: Date;
    manufacturingDate?: Date;
    requiresPrescription?: boolean;
    scheduleType?: string;
    storageConditions?: string;

    // Category specific
    tabletsPerStrip?: number;
    qtyInMl?: number;
    composition?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> { }

export interface ProductFilter {
    search?: string;
    category?: ProductCategory;
    lowStock?: boolean;
    expiring?: boolean;
}

// ============================================
// PRODUCT SERVICE
// ============================================

/**
 * Create a new product
 */
export const createProduct = async (storeId: string, input: CreateProductInput): Promise<Product> => {
    // Check if SKU exists in this store
    const existingProduct = await prisma.product.findUnique({
        where: {
            sku_storeId: {
                sku: input.sku,
                storeId,
            },
        },
    });

    if (existingProduct) {
        throw new Error(`Product with SKU '${input.sku}' already exists.`);
    }

    // Create product
    return prisma.product.create({
        data: {
            storeId,
            name: input.name,
            genericName: input.genericName,
            sku: input.sku,
            barcode: input.barcode,
            category: input.category,
            manufacturer: input.manufacturer,
            supplier: input.supplier,
            description: input.description,

            costPrice: input.costPrice,
            sellingPrice: input.sellingPrice,
            mrp: input.mrp,
            taxPercent: input.taxPercent || 0,
            discountPercent: input.discountPercent || 0,

            quantity: input.quantity,
            minStockLevel: input.minStockLevel || 10,
            maxStockLevel: input.maxStockLevel || 1000,
            reorderLevel: input.reorderLevel || 20,
            unit: input.unit || 'pcs',

            batchNumber: input.batchNumber,
            expiryDate: input.expiryDate,
            manufacturingDate: input.manufacturingDate,
            requiresPrescription: input.requiresPrescription || false,
            scheduleType: input.scheduleType,
            storageConditions: input.storageConditions,

            tabletsPerStrip: input.tabletsPerStrip,
            qtyInMl: input.qtyInMl,
        },
    });
};

/**
 * Get products with filtering and pagination
 */
export const getProducts = async (
    storeId: string,
    filter: ProductFilter,
    page: number = 1,
    limit: number = 20
) => {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
        storeId,
        isActive: true,
    };

    if (filter.search) {
        where.OR = [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { genericName: { contains: filter.search, mode: 'insensitive' } },
            { sku: { contains: filter.search, mode: 'insensitive' } },
            { barcode: { contains: filter.search, mode: 'insensitive' } },
        ];
    }

    if (filter.category) {
        where.category = filter.category;
    }

    if (filter.expiring) {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        where.expiryDate = {
            gte: today,
            lte: thirtyDaysFromNow,
        };
    }

    // For low stock, we need to fetch and filter since Prisma doesn't support field comparison
    if (filter.lowStock) {
        const allProducts = await prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        const lowStockProducts = allProducts.filter((p: any) => p.quantity <= p.reorderLevel);
        const total = lowStockProducts.length;
        const paginatedProducts = lowStockProducts.slice(skip, skip + limit);

        return {
            products: paginatedProducts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Execute query
    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.product.count({ where }),
    ]);

    return {
        products,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get single product by ID
 */
export const getProductById = async (storeId: string, productId: string): Promise<Product | null> => {
    return prisma.product.findUnique({
        where: {
            id: productId,
        },
    });
};

/**
 * Update product
 */
export const updateProduct = async (
    storeId: string,
    productId: string,
    input: UpdateProductInput
): Promise<Product> => {
    // Check if product exists and belongs to store
    const existingProduct = await prisma.product.findFirst({
        where: {
            id: productId,
            storeId,
        },
    });

    if (!existingProduct) {
        throw new Error('Product not found or access denied');
    }

    // Sanitize input using a strict whitelist to prevent unknown argument errors
    const allowedFields = [
        'name', 'genericName', 'sku', 'barcode', 'category', 'manufacturer', 'supplier', 'description',
        'costPrice', 'sellingPrice', 'mrp', 'taxPercent', 'discountPercent',
        'quantity', 'minStockLevel', 'maxStockLevel', 'reorderLevel', 'unit',
        'batchNumber', 'expiryDate', 'manufacturingDate', 'requiresPrescription', 'scheduleType', 'storageConditions',
        'tabletsPerStrip', 'qtyInMl', 'composition',
        'isActive'
    ];

    const updateData: Record<string, any> = {};
    const inputData = input as any;

    Object.keys(inputData).forEach(key => {
        if (allowedFields.includes(key)) {
            updateData[key] = inputData[key];
        }
    });

    return prisma.product.update({
        where: { id: productId },
        data: updateData,
    });
};

/**
 * Delete product (soft delete)
 */
export const deleteProduct = async (storeId: string, productId: string): Promise<void> => {
    // Check if product exists and belongs to store
    const existingProduct = await prisma.product.findFirst({
        where: {
            id: productId,
            storeId,
        },
    });

    if (!existingProduct) {
        throw new Error('Product not found or access denied');
    }

    await prisma.product.update({
        where: { id: productId },
        data: { isActive: false },
    });
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (storeId: string) => {
    // Fetch all products and filter since Prisma doesn't support field-to-field comparison
    const products = await prisma.product.findMany({
        where: {
            storeId,
            isActive: true,
        },
        orderBy: { quantity: 'asc' },
    });

    return products.filter((p: any) => p.quantity <= p.reorderLevel);
};

export default {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
};
