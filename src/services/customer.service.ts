import prisma from '../config/database';
import { Customer, Prisma } from '@prisma/client';

export interface CreateCustomerInput {
    firstName: string;
    lastName?: string;
    email?: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    dateOfBirth?: Date;
    gender?: string;
    allergies?: string;
    chronicConditions?: string;
    notes?: string;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> { }

/**
 * Create a new customer
 */
export const createCustomer = async (storeId: string, input: CreateCustomerInput): Promise<Customer> => {
    // Check if phone exists in store
    const existing = await prisma.customer.findFirst({
        where: {
            storeId,
            phone: input.phone,
        },
    });

    if (existing) {
        throw new Error(`Customer with phone ${input.phone} already exists.`);
    }

    return prisma.customer.create({
        data: {
            storeId,
            ...input,
        },
    });
};

/**
 * Search customers by phone or name
 */
export const searchCustomers = async (storeId: string, query: string, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const where: Prisma.CustomerWhereInput = {
        storeId,
        isActive: true,
    };

    if (query) {
        where.OR = [
            { phone: { contains: query } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
        ];
    }

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            take: limit,
            skip,
            orderBy: { updatedAt: 'desc' },
        }),
        prisma.customer.count({ where }),
    ]);

    return {
        customers,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get customer by ID with last visit details
 */
export const getCustomerById = async (storeId: string, customerId: string) => {
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, storeId },
        include: {
            _count: {
                select: { bills: true },
            },
        },
    });

    if (!customer) return null;

    // Get last visit (last bill)
    const lastBill = await prisma.bill.findFirst({
        where: { customerId, storeId },
        orderBy: { billedAt: 'desc' },
        take: 1,
    });

    return {
        ...customer,
        lastVisit: lastBill?.billedAt || null,
        lastBillAmount: lastBill?.totalAmount || null,
    };
};

/**
 * Get customer details by Phone (Optimized for POS)
 */
export const getCustomerByPhone = async (storeId: string, phone: string) => {
    const customer = await prisma.customer.findFirst({
        where: { storeId, phone },
    });

    if (!customer) return null;

    // Get last visit (last bill)
    const lastBill = await prisma.bill.findFirst({
        where: { customerId: customer.id, storeId },
        orderBy: { billedAt: 'desc' },
        take: 1,
    });

    return {
        ...customer,
        lastVisit: lastBill?.billedAt || null,
        lastBillAmount: lastBill?.totalAmount || null,
    };
};

/**
 * Update customer
 */
export const updateCustomer = async (storeId: string, customerId: string, input: UpdateCustomerInput) => {
    return prisma.customer.update({
        where: { id: customerId },
        data: input,
    });
};

/**
 * Get customer bills history
 */
export const getCustomerBills = async (storeId: string, customerId: string, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const where: Prisma.BillWhereInput = {
        storeId,
        customerId,
    };

    const [bills, total] = await Promise.all([
        prisma.bill.findMany({
            where,
            orderBy: { billedAt: 'desc' },
            skip,
            take: limit,
            include: {
                billItems: true
            }
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
        }
    }
}

/**
 * Get items from customer's last bill (for auto-fill in POS)
 */
export const getCustomerLastBillItems = async (storeId: string, customerId: string) => {
    // Get the most recent bill for this customer
    const lastBill = await prisma.bill.findFirst({
        where: {
            storeId,
            customerId,
            status: 'COMPLETED' // Only completed bills
        },
        orderBy: { billedAt: 'desc' },
        include: {
            billItems: {
                include: {
                    product: true
                }
            }
        }
    });

    if (!lastBill || !lastBill.billItems || lastBill.billItems.length === 0) {
        return [];
    }

    // Map bill items to include product details and check stock availability
    const items = lastBill.billItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        // Include current product data for stock check
        product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            sellingPrice: item.product.sellingPrice,
            mrp: item.product.mrp,
            quantity: item.product.quantity, // Current stock
            unit: item.product.unit,
            taxPercent: item.product.taxPercent,
            isActive: item.product.isActive,
        } : null
    })).filter(item => item.product && item.product.isActive && item.product.quantity > 0);

    return items;
}


/**
 * Delete customer
 */
export const deleteCustomer = async (storeId: string, customerId: string) => {
    // Check if customer belongs to store
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, storeId },
    });

    if (!customer) {
        throw new Error('Customer not found');
    }

    return prisma.customer.delete({
        where: { id: customerId },
    });
};

export default {
    createCustomer,
    searchCustomers,
    getCustomerById,
    getCustomerByPhone,
    updateCustomer,
    deleteCustomer,
    getCustomerBills,
    getCustomerLastBillItems
};
