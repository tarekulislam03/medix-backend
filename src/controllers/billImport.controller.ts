import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Confirm and save imported items to database
 * POST /api/v1/inventory/confirm-import
 * 
 * The extraction is now handled by the text-extractor microservice.
 * This endpoint only handles saving the reviewed data to the database.
 */
export const confirmImport = async (req: Request, res: Response): Promise<void> => {
    try {
        const { items } = req.body;
        const storeId = req.storeId;

        if (!storeId || !Array.isArray(items)) {
            res.status(400).json({ success: false, message: 'Invalid request' });
            return;
        }

        let created = 0;
        let updated = 0;

        for (const item of items) {
            const name = item.medicine_name;
            const batch = item.batch_number;

            // Parse all the values upfront
            const mrpValue = Number(item.mrp) || 0;
            const costPriceValue = Number(item.rate) || 0;
            const quantityValue = Number(item.quantity) || 0;
            const expiryValue = item.expiry_date ? parseExpiryDate(item.expiry_date) : undefined;

            // Debug logging
            console.log(`[Import] Item: ${name}, MRP: ${mrpValue}, Cost: ${costPriceValue}, Qty: ${quantityValue}, Batch: ${batch}`);

            // Find ALL products with this name in this store
            const existingProducts = await prisma.product.findMany({
                where: {
                    storeId,
                    name: { equals: name, mode: 'insensitive' }
                }
            });

            // Is there a product with specific Batch?
            const exactBatchMatch = existingProducts.find(p => p.batchNumber === batch);

            if (exactBatchMatch) {
                // Update existing product - add stock AND update prices if they were empty
                // Convert Prisma Decimal types to numbers for comparison
                const existingMrp = exactBatchMatch.mrp ? Number(exactBatchMatch.mrp) : 0;
                const existingCostPrice = exactBatchMatch.costPrice ? Number(exactBatchMatch.costPrice) : 0;
                const existingSellingPrice = exactBatchMatch.sellingPrice ? Number(exactBatchMatch.sellingPrice) : 0;
                const existingQty = exactBatchMatch.quantity ? Number(exactBatchMatch.quantity) : 0;

                await prisma.product.update({
                    where: { id: exactBatchMatch.id },
                    data: {
                        quantity: existingQty + quantityValue,
                        // Update prices only if they were empty/0 before
                        mrp: existingMrp > 0 ? existingMrp : mrpValue,
                        costPrice: existingCostPrice > 0 ? existingCostPrice : costPriceValue,
                        sellingPrice: existingSellingPrice > 0 ? existingSellingPrice : mrpValue,
                        // Update batch/expiry if they were empty
                        batchNumber: exactBatchMatch.batchNumber || batch || undefined,
                        expiryDate: exactBatchMatch.expiryDate || expiryValue,
                        manufacturer: exactBatchMatch.manufacturer || item.supplier || undefined,
                    }
                });
                updated++;
            } else {
                // New Batch for this Product Name
                const blueprint = existingProducts[0];

                await prisma.product.create({
                    data: {
                        storeId,
                        name: item.medicine_name,
                        sku: generateSku(item.medicine_name, batch),
                        quantity: quantityValue,
                        batchNumber: batch || undefined,
                        expiryDate: expiryValue,
                        mrp: mrpValue,
                        costPrice: costPriceValue,
                        sellingPrice: mrpValue, // MRP = Selling Price

                        // Supplier stored as manufacturer
                        manufacturer: item.supplier || undefined,

                        // Defaults or inherited from existing products with same name
                        category: blueprint ? blueprint.category : 'MEDICINE',
                        unit: blueprint ? blueprint.unit : 'pcs',
                        reorderLevel: blueprint ? blueprint.reorderLevel : 10,
                        description: 'Imported from Supplier Bill'
                    }
                });
                created++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Import confirmed. ${created} new batches, ${updated} stock updates.`
        });

    } catch (error) {
        console.error('Confirm Import Error:', error);
        res.status(500).json({ success: false, message: 'Failed to save inventory' });
    }
};

/**
 * Generate a unique SKU for a product batch
 */
const generateSku = (name: string, batch: string) => {
    const cleanName = name.substring(0, 3).toUpperCase();
    const cleanBatch = batch ? batch.replace(/[^a-zA-Z0-9]/g, '') : Date.now().toString().substring(0, 6);
    const random = Math.floor(Math.random() * 999);
    return `${cleanName}-${cleanBatch}-${random}`;
};

/**
 * Parse expiry date from various formats (MM/YY, MM-YY, YYYY-MM, etc.)
 */
const parseExpiryDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;

    // Try MM/YY or MM-YY format
    const shortMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{2})$/);
    if (shortMatch) {
        const month = parseInt(shortMatch[1]);
        let year = parseInt(shortMatch[2]);
        year = year < 50 ? 2000 + year : 1900 + year;
        return new Date(year, month - 1, 1);
    }

    // Try YYYY-MM format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, 1);
    }

    // Fallback: try native Date parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? undefined : parsed;
};

// Legacy import endpoint removed - now handled by text-extractor microservice
export const importBill = async (req: Request, res: Response): Promise<void> => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Please use the text-extractor service at http://localhost:3000/api/extract'
    });
};
