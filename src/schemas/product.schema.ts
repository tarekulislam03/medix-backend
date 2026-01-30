import { z } from 'zod';
import { ProductCategory } from '@prisma/client';

const productCategoryEnum = z.nativeEnum(ProductCategory);

export const createProductSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Product name is required'),
        sku: z.string().min(1, 'SKU is required'),
        barcode: z.string().optional(),
        category: productCategoryEnum.optional().default(ProductCategory.MEDICINE),
        manufacturer: z.string().optional(),

        costPrice: z.number().or(z.string().transform(val => parseFloat(val))),
        sellingPrice: z.number().or(z.string().transform(val => parseFloat(val))),
        mrp: z.number().or(z.string().transform(val => parseFloat(val))),
        taxPercent: z.number().or(z.string().transform(val => parseFloat(val))).optional(),

        quantity: z.number().int().or(z.string().transform(val => parseInt(val, 10))),
        minStockLevel: z.number().int().or(z.string().transform(val => parseInt(val, 10))).optional(),
        reorderLevel: z.number().int().or(z.string().transform(val => parseInt(val, 10))).optional(),

        expiryDate: z.string().datetime({ offset: true }).or(z.string()).or(z.date()).optional().nullable()
            .transform(val => val === '' ? undefined : val),

        tabletsPerStrip: z.number().or(z.string().transform(val => parseInt(val, 10))).optional(),
        qtyInMl: z.number().or(z.string().transform(val => parseFloat(val))).optional(),
    })
});
