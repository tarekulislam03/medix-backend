import prisma from '../config/database';


// ============================================
// TYPES
// ============================================

interface BillWithAmount {
    totalAmount: any;
}

export interface TodaySales {
    totalAmount: number;
    totalBills: number;
    averageOrderValue: number;
    comparedToYesterday: {
        amountChange: number;
        percentageChange: number;
        trend: 'up' | 'down' | 'same';
    };
}

export interface MonthlySummary {
    totalAmount: number;
    totalBills: number;
    averageOrderValue: number;
    topSellingProducts: Array<{
        productId: string;
        productName: string;
        quantity: number;
        revenue: number;
    }>;
    comparedToLastMonth: {
        amountChange: number;
        percentageChange: number;
        trend: 'up' | 'down' | 'same';
    };
}

export interface MonthlyGraphData {
    month: string;
    year: number;
    totalAmount: number;
    totalBills: number;
}

export interface RecentBill {
    id: string;
    billNumber: string;
    customerName: string | null;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    billedAt: Date;
    itemCount: number;
}

export interface DashboardStats {
    todaySales: TodaySales;
    monthlySummary: MonthlySummary;
    salesGraphData: MonthlyGraphData[];
    recentBills: RecentBill[];
    notifications: {
        unreadCount: number;
        alertCount: number;
    };
    inventory: {
        lowStockCount: number;
        expiringCount: number;
        totalProducts: number;
    };
    customers: {
        totalCustomers: number;
        newThisMonth: number;
    };
}

// ============================================
// DASHBOARD SERVICE
// ============================================

/**
 * Get today's sales summary
 */
export const getTodaySales = async (storeId: string): Promise<TodaySales> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's sales
    const todayBills = await prisma.bill.findMany({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: { gte: today },
        },
        select: {
            totalAmount: true,
        },
    });

    // Yesterday's sales
    const yesterdayBills = await prisma.bill.findMany({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: {
                gte: yesterday,
                lt: today,
            },
        },
        select: {
            totalAmount: true,
        },
    });

    const todayTotal = todayBills.reduce((sum: number, bill: BillWithAmount) => sum + Number(bill.totalAmount), 0);
    const yesterdayTotal = yesterdayBills.reduce((sum: number, bill: BillWithAmount) => sum + Number(bill.totalAmount), 0);

    const amountChange = todayTotal - yesterdayTotal;
    const percentageChange = yesterdayTotal > 0
        ? Math.round((amountChange / yesterdayTotal) * 100)
        : todayTotal > 0 ? 100 : 0;

    return {
        totalAmount: todayTotal,
        totalBills: todayBills.length,
        averageOrderValue: todayBills.length > 0 ? Math.round(todayTotal / todayBills.length) : 0,
        comparedToYesterday: {
            amountChange,
            percentageChange,
            trend: amountChange > 0 ? 'up' : amountChange < 0 ? 'down' : 'same',
        },
    };
};

/**
 * Get monthly sales summary
 */
export const getMonthlySummary = async (storeId: string): Promise<MonthlySummary> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // This month's bills
    const thisMonthBills = await prisma.bill.findMany({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: { gte: startOfMonth },
        },
        include: {
            billItems: true,
        },
    });

    // Last month's bills
    const lastMonthBills = await prisma.bill.findMany({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: {
                gte: startOfLastMonth,
                lte: endOfLastMonth,
            },
        },
        select: {
            totalAmount: true,
        },
    });

    const thisMonthTotal = thisMonthBills.reduce((sum: number, bill: any) => sum + Number(bill.totalAmount), 0);
    const lastMonthTotal = lastMonthBills.reduce((sum: number, bill: BillWithAmount) => sum + Number(bill.totalAmount), 0);

    // Calculate top selling products
    const productSales = new Map<string, { productId: string; productName: string; quantity: number; revenue: number }>();

    for (const bill of thisMonthBills) {
        for (const item of bill.billItems) {
            const existing = productSales.get(item.productSku);
            if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += Number(item.totalAmount);
            } else {
                productSales.set(item.productSku, {
                    productId: item.productId || '',
                    productName: item.productName,
                    quantity: item.quantity,
                    revenue: Number(item.totalAmount),
                });
            }
        }
    }

    const topSellingProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    const amountChange = thisMonthTotal - lastMonthTotal;
    const percentageChange = lastMonthTotal > 0
        ? Math.round((amountChange / lastMonthTotal) * 100)
        : thisMonthTotal > 0 ? 100 : 0;

    return {
        totalAmount: thisMonthTotal,
        totalBills: thisMonthBills.length,
        averageOrderValue: thisMonthBills.length > 0 ? Math.round(thisMonthTotal / thisMonthBills.length) : 0,
        topSellingProducts,
        comparedToLastMonth: {
            amountChange,
            percentageChange,
            trend: amountChange > 0 ? 'up' : amountChange < 0 ? 'down' : 'same',
        },
    };
};

/**
 * Get sales per month graph data (last 12 months)
 */
export const getSalesGraphData = async (storeId: string): Promise<MonthlyGraphData[]> => {
    const months: MonthlyGraphData[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

        const bills = await prisma.bill.findMany({
            where: {
                storeId,
                status: 'COMPLETED',
                billedAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            select: {
                totalAmount: true,
            },
        });

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        months.push({
            month: monthNames[monthDate.getMonth()],
            year: monthDate.getFullYear(),
            totalAmount: bills.reduce((sum: number, bill: BillWithAmount) => sum + Number(bill.totalAmount), 0),
            totalBills: bills.length,
        });
    }

    return months;
};

/**
 * Get recent bills
 */
export const getRecentBills = async (storeId: string, limit = 10): Promise<RecentBill[]> => {
    const bills = await prisma.bill.findMany({
        where: { storeId },
        orderBy: { billedAt: 'desc' },
        take: limit,
        include: {
            customer: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
            _count: {
                select: {
                    billItems: true,
                },
            },
        },
    });

    return bills.map((bill: any) => ({
        id: bill.id,
        billNumber: bill.billNumber,
        customerName: bill.customer
            ? `${bill.customer.firstName} ${bill.customer.lastName || ''}`.trim()
            : null,
        totalAmount: Number(bill.totalAmount),
        paymentMethod: bill.paymentMethod,
        status: bill.status,
        billedAt: bill.billedAt,
        itemCount: bill._count.billItems,
    }));
};

/**
 * Get notification counts
 */
export const getNotificationCounts = async (storeId: string, userId?: string) => {
    const baseWhere = {
        storeId,
        status: 'UNREAD' as const,
    };

    const where = userId
        ? { ...baseWhere, OR: [{ userId }, { userId: null }] }
        : baseWhere;

    const [unreadCount, alertCount] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({
            where: {
                ...where,
                type: { in: ['ALERT', 'WARNING', 'EXPIRY', 'LOW_STOCK'] },
            },
        }),
    ]);

    return {
        unreadCount,
        alertCount,
    };
};

/**
 * Get inventory stats
 */
export const getInventoryStats = async (storeId: string) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Get all active products to calculate low stock
    const products = await prisma.product.findMany({
        where: { storeId, isActive: true },
        select: {
            quantity: true,
            reorderLevel: true,
            expiryDate: true,
        },
    });

    const totalProducts = products.length;
    const lowStockCount = products.filter((p: any) => p.quantity <= p.reorderLevel).length;
    const expiringCount = products.filter((p: any) =>
        p.expiryDate &&
        p.expiryDate >= now &&
        p.expiryDate <= thirtyDaysFromNow
    ).length;

    return {
        totalProducts,
        lowStockCount,
        expiringCount,
    };
};

/**
 * Get customer stats
 */
export const getCustomerStats = async (storeId: string) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalCustomers, newThisMonth] = await Promise.all([
        prisma.customer.count({
            where: { storeId, isActive: true },
        }),
        prisma.customer.count({
            where: {
                storeId,
                createdAt: { gte: startOfMonth },
            },
        }),
    ]);

    return {
        totalCustomers,
        newThisMonth,
    };
};

/**
 * Get complete dashboard data
 */
export const getDashboardStats = async (storeId: string, userId?: string): Promise<DashboardStats> => {
    const [
        todaySales,
        monthlySummary,
        salesGraphData,
        recentBills,
        notifications,
        inventory,
        customers,
    ] = await Promise.all([
        getTodaySales(storeId),
        getMonthlySummary(storeId),
        getSalesGraphData(storeId),
        getRecentBills(storeId),
        getNotificationCounts(storeId, userId),
        getInventoryStats(storeId),
        getCustomerStats(storeId),
    ]);

    return {
        todaySales,
        monthlySummary,
        salesGraphData,
        recentBills,
        notifications,
        inventory,
        customers,
    };
};

/**
 * Get store settings
 */
export const getStoreSettings = async (storeId: string) => {
    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            gstNumber: true,
        },
    });
    return store;
};

/**
 * Update store settings
 */
export const updateStoreSettings = async (storeId: string, data: {
    storeName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstNumber?: string;
}) => {
    const updateData: any = {};
    if (data.storeName) updateData.name = data.storeName;
    if (data.email) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.pincode !== undefined) updateData.postalCode = data.pincode;
    if (data.gstNumber !== undefined) updateData.gstNumber = data.gstNumber;

    const store = await prisma.store.update({
        where: { id: storeId },
        data: updateData,
    });

    return store;
};

export default {
    getTodaySales,
    getMonthlySummary,
    getSalesGraphData,
    getRecentBills,
    getNotificationCounts,
    getInventoryStats,
    getCustomerStats,
    getDashboardStats,
    getStoreSettings,
    updateStoreSettings,
};
