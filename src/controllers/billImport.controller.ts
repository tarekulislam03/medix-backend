import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { convertPdfToImages, processImage } from '../services/pdfToImage.service';
import { extractTextFromImage } from '../services/ocr.service';
import { extractMedicinesFromText } from '../services/aiExtraction.service';
import { normalizeMedicineName } from '../services/medicineNormalize.service';
import prisma from '../config/database';

export const importBill = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }

        const filePath = req.file.path;
        const mimeType = req.file.mimetype;
        const tempImages: string[] = [];

        try {
            // 1. Convert/Process to Image(s)
            if (mimeType === 'application/pdf') {
                const pdfImages = await convertPdfToImages(filePath);
                tempImages.push(...pdfImages);
            } else if (mimeType.startsWith('image/')) {
                // Process directly
                const processed = await processImage(filePath);
                tempImages.push(processed); // Use processed image
                // Or just use original if we want simplicity, but preprocessing is requested.
            } else {
                throw new Error('Unsupported file type');
            }

            // 2. OCR Extraction (Accumulate text from all pages)
            let fullText = '';
            for (const imgPath of tempImages) {
                const text = await extractTextFromImage(imgPath);
                fullText += text + '\n';

                // Cleanup processed image
                try { fs.unlinkSync(imgPath); } catch (e) { }
            }

            // 3. AI Extraction
            const rawMedicines = await extractMedicinesFromText(fullText);

            // 4. Normalize & Structure
            // Also try to find a match status
            // We can check if "normalized name" matches an existing product key

            // To do this efficiently, we might need to fetch all product names (or a subset)
            // But for a simple preview, we just return the cleaned data and let Frontend handle "Matching" logic 
            // OR we can do a quick check here. The User Step 9 says "Preview before save".
            // The previous implementation used Fuse.js on backend. We can replicate that if we want "Matched" status.

            const normalizedItems = rawMedicines.map(item => ({
                ...item,
                original_name: item.medicine_name,
                medicine_name: normalizeMedicineName(item.medicine_name),
            }));

            res.status(200).json({
                success: true,
                data: normalizedItems
            });

        } finally {
            // Cleanup input file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    } catch (error) {
        console.error('Bill Import Error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Import failed'
        });
    }
};

export const confirmImport = async (req: Request, res: Response): Promise<void> => {
    try {
        const { items } = req.body; // Expecting array of medicines
        const storeId = req.storeId;

        if (!storeId || !Array.isArray(items)) {
            res.status(400).json({ success: false, message: 'Invalid request' });
            return;
        }

        let created = 0;
        let updated = 0;

        for (const item of items) {
            // Logic:
            // 1. Check if product exists (by sku? or name?)
            //    The user asked for: "Product -> many Batches".
            //    Since we don't have separate Batch table, we use Product rows.
            //    To behave like batches, we can define uniqueness by (Name + Batch).
            //    Or we try to find a product with same Name.

            // Using Name to identify the "Product Concept".
            const name = item.medicine_name;
            const batch = item.batch_number;

            // Strategy:
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
                // Update Quantity ONLY. Do NOT overwrite MRP/Rate if they differ (Batch rule).
                // Actually user said: "Never overwrite old batches".
                // So if it exists, we just add stock?
                await prisma.product.update({
                    where: { id: exactBatchMatch.id },
                    data: {
                        quantity: exactBatchMatch.quantity + Number(item.quantity)
                    }
                });
                updated++;
            } else {
                // New Batch for this Product Name
                // If existingProducts.length > 0, we can clone details (Categor, etc) from one of them.
                const blueprint = existingProducts[0];

                await prisma.product.create({
                    data: {
                        storeId,
                        name: item.medicine_name, // Normalized or raw? Item has edit capability in frontend.
                        // Generate a unique SKU for this batch
                        sku: generateSku(item.medicine_name, batch),
                        quantity: Number(item.quantity),
                        batchNumber: batch,
                        expiryDate: item.expiry_date ? new Date(item.expiry_date) : undefined,
                        mrp: Number(item.mrp),
                        costPrice: Number(item.rate), // Purchase Rate
                        sellingPrice: Number(item.mrp), // Default selling to MRP

                        // Defaults or inherited
                        category: blueprint ? blueprint.category : 'MEDICINE',
                        unit: blueprint ? blueprint.unit : 'pcs',
                        reorderLevel: blueprint ? blueprint.reorderLevel : 10,
                        description: 'Imported from Bill'
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

const generateSku = (name: string, batch: string) => {
    // simple hash or random
    const cleanName = name.substring(0, 3).toUpperCase();
    const cleanBatch = batch ? batch.replace(/[^a-zA-Z0-9]/g, '') : Date.now().toString().substring(0, 6);
    const random = Math.floor(Math.random() * 999);
    return `${cleanName}-${cleanBatch}-${random}`;
};
