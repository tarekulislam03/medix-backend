import prisma from '../config/database';
import { Bill, BillStatus, PaymentMethod, Prisma } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface BillItemInput {
    productId?: string; // Optional if ad-hoc item, but usually required for inventory
    productName: string;
    productSku: string; // If ad-hoc, maybe required
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    taxPercent?: number;
}

export interface CreateBillInput {
    customerId?: string;
    customerName?: string; // Optional simple name if not registered
    customerPhone?: string; // Optional simple phone

    items: BillItemInput[];

    // Fees & Adjustments
    discountAmount?: number; // Global discount
    doctorFees?: number;
    otherCharges?: number;

    // Payment
    paymentMethod: PaymentMethod;
    amountPaid: number;

    // Meta
    doctorName?: string;
    notes?: string;
}

export interface BillFilter {
    startDate?: Date;
    endDate?: Date;
    status?: BillStatus;
    search?: string;
}

// ============================================
// BILLING SERVICE
// ============================================

/**
 * Create a new bill with inventory updates
 */
export const createBill = async (storeId: string, userId: string, input: CreateBillInput) => {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let totalItemsDiscount = 0;

        // Prepare items for batch creation
        const billItemsData = [];

        for (const item of input.items) {
            // If product exists, verify stock and get cost price
            let costPrice = 0;
            let batchNumber = null;
            let expiryDate = null;

            if (item.productId) {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                });

                if (!product || product.storeId !== storeId) {
                    throw new Error(`Product not found: ${item.productName}`);
                }

                if (product.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}`);
                }

                // Update stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: { quantity: { decrement: item.quantity } },
                });

                costPrice = Number(product.costPrice);
                batchNumber = product.batchNumber;
                expiryDate = product.expiryDate;
            }

            // Calculate item totals
            const grossAmount = item.unitPrice * item.quantity;
            const discountAmount = (grossAmount * (item.discountPercent || 0)) / 100;
            const taxableAmount = grossAmount - discountAmount;
            const taxAmount = (taxableAmount * (item.taxPercent || 0)) / 100;
            const netAmount = taxableAmount + taxAmount;

            subtotal += taxableAmount; // Usually subtotal excludes tax, but definitions vary. Let's say subtotal is post-item-discount pre-tax sum. 
            // Actually standard: Subtotal = sum(unit_price * quantity). Then Discounts, Then Taxes.
            // But here we support item level discounts.
            // Let's stick to: Subtotal = Sum of (Price * Qty) - Item Discounts.

            totalTax += taxAmount;
            totalItemsDiscount += discountAmount;

            billItemsData.push({
                storeId,
                productId: item.productId,
                productName: item.productName,
                productSku: item.productSku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                costPrice, // Track cost for profit calc
                mrp: item.unitPrice, // Assuming selling price is MRP for now
                taxPercent: item.taxPercent || 0,
                taxAmount,
                discountPercent: item.discountPercent || 0,
                discountAmount,
                totalAmount: netAmount,
                batchNumber,
                expiryDate,
            });
        }

        // 2. Global calculations
        // Global discount is applied on top? Or already included? Input says `discountAmount`. 
        // Usually global discount is applied on subtotal.
        const globalDiscount = input.discountAmount || 0;
        const doctorFees = input.doctorFees || 0;
        const otherCharges = input.otherCharges || 0;

        const grandTotal = subtotal + totalTax + doctorFees + otherCharges - globalDiscount;

        // 3. Generate Bill Number
        // Format: INV-{YY}{MM}{DD}-{RANDOM4}
        const date = new Date();
        const prefix = `INV-${date.getFullYear().toString().substr(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const random = Math.floor(1000 + Math.random() * 9000);
        const billNumber = `${prefix}-${random}`;

        // 4. Handle Customer
        let customerId = input.customerId;

        // If no ID but phone provided, maybe check existing or create? 
        // For simplicity, if ID provided use it. If not, treat as Guest (customerId null).

        if (customerId) {
            // Update customer usage stats
            await tx.customer.update({
                where: { id: customerId },
                data: {
                    totalPurchases: { increment: grandTotal },
                    // points logic could go here
                }
            });
        }

        // 5. Create Bill
        const bill = await tx.bill.create({
            data: {
                storeId,
                userId,
                billNumber,
                customerId,

                subtotal,
                taxAmount: totalTax,
                discountAmount: totalItemsDiscount + globalDiscount, // Total discount tracked
                doctorFees,
                otherCharges,
                totalAmount: grandTotal,

                paidAmount: input.amountPaid,
                changeAmount: Math.max(0, input.amountPaid - grandTotal),
                paymentMethod: input.paymentMethod,
                status: BillStatus.COMPLETED,

                doctorName: input.doctorName,
                notes: input.notes,

                billItems: {
                    create: billItemsData,
                },
            },
            include: {
                billItems: true,
                customer: true,
            },
        });

        return bill;
    });
};

/**
 * Get bills with pagination and filters
 */
export const getBills = async (storeId: string, filter: BillFilter, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    const where: Prisma.BillWhereInput = {
        storeId,
    };

    if (filter.status) where.status = filter.status;

    if (filter.startDate && filter.endDate) {
        where.billedAt = {
            gte: filter.startDate,
            lte: filter.endDate,
        };
    } else if (filter.startDate) {
        where.billedAt = { gte: filter.startDate };
    }

    if (filter.search) {
        where.OR = [
            { billNumber: { contains: filter.search, mode: 'insensitive' } },
            { customer: { firstName: { contains: filter.search, mode: 'insensitive' } } },
            { customer: { phone: { contains: filter.search, mode: 'insensitive' } } },
        ];
    }

    const [bills, total] = await Promise.all([
        prisma.bill.findMany({
            where,
            include: { customer: true, billItems: true },
            orderBy: { billedAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.bill.count({ where }),
    ]);

    return {
        bills,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get single bill by ID
 */
export const getBillById = async (storeId: string, billId: string) => {
    return prisma.bill.findFirst({
        where: { id: billId, storeId },
        include: {
            billItems: true,
            customer: true,
            store: true,
            user: {
                select: { firstName: true, lastName: true },
            },
        },
    });
};

/**
 * Search products optimized for billing
 */
export const searchProductsForBilling = async (storeId: string, query: string) => {
    return prisma.product.findMany({
        where: {
            storeId,
            isActive: true,
            quantity: { gt: 0 }, // Only available
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
                { barcode: { contains: query, mode: 'insensitive' } },
            ],
        },
        take: 10,
        select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
            mrp: true,
            quantity: true,
            taxPercent: true,
            discountPercent: true,
            expiryDate: true,
            batchNumber: true,
            category: true,
            unit: true,
        },
    });
};

export default {
    createBill,
    getBills,
    getBillById,
    searchProductsForBilling,
};
