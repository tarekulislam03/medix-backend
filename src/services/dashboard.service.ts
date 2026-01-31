import prisma from '../config/database';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

// ============================================
// TYPES
// ============================================

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

    // Aggregate Today
    const todayStats = await prisma.bill.aggregate({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: { gte: today },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
    });

    // Aggregate Yesterday
    const yesterdayStats = await prisma.bill.aggregate({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: {
                gte: yesterday,
                lt: today,
            },
        },
        _sum: { totalAmount: true },
    });

    const todayTotal = Number(todayStats._sum.totalAmount || 0);
    const todayBillsCount = todayStats._count.id;
    const yesterdayTotal = Number(yesterdayStats._sum.totalAmount || 0);

    const amountChange = todayTotal - yesterdayTotal;
    const percentageChange = yesterdayTotal > 0
        ? Math.round((amountChange / yesterdayTotal) * 100)
        : todayTotal > 0 ? 100 : 0;

    return {
        totalAmount: todayTotal,
        totalBills: todayBillsCount,
        averageOrderValue: todayBillsCount > 0 ? Math.round(todayTotal / todayBillsCount) : 0,
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

    // This Month Stats
    const thisMonthStats = await prisma.bill.aggregate({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
    });

    // Last Month Stats
    const lastMonthStats = await prisma.bill.aggregate({
        where: {
            storeId,
            status: 'COMPLETED',
            billedAt: {
                gte: startOfLastMonth,
                lte: endOfLastMonth,
            },
        },
        _sum: { totalAmount: true },
    });

    const thisMonthTotal = Number(thisMonthStats._sum.totalAmount || 0);
    const thisMonthBillsCount = thisMonthStats._count.id;
    const lastMonthTotal = Number(lastMonthStats._sum.totalAmount || 0);

    // Optimized Top Selling Products (using GroupBy)
    // Prisma does not support joining in groupBy easily, usually require aggregation on BillItem directly
    // searching for items sold in the last 30 days/current month
    const topProductsRaw = await prisma.billItem.groupBy({
        by: ['productId', 'productName'],
        where: {
            storeId,
            bill: {
                status: 'COMPLETED',
                billedAt: { gte: startOfMonth },
            },
        },
        _sum: {
            totalAmount: true,
            quantity: true,
        },
        orderBy: {
            _sum: {
                totalAmount: 'desc',
            },
        },
        take: 5,
    });

    const topSellingProducts = topProductsRaw.map(item => ({
        productId: item.productId || 'unknown',
        productName: item.productName,
        quantity: item._sum.quantity || 0,
        revenue: Number(item._sum.totalAmount || 0),
    }));

    const amountChange = thisMonthTotal - lastMonthTotal;
    const percentageChange = lastMonthTotal > 0
        ? Math.round((amountChange / lastMonthTotal) * 100)
        : thisMonthTotal > 0 ? 100 : 0;

    return {
        totalAmount: thisMonthTotal,
        totalBills: thisMonthBillsCount,
        averageOrderValue: thisMonthBillsCount > 0 ? Math.round(thisMonthTotal / thisMonthBillsCount) : 0,
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
 * Optimized using Raw Query for PostgreSQL date_trunc
 */
export const getSalesGraphData = async (storeId: string): Promise<MonthlyGraphData[]> => {
    // 12 months ago
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    // Using raw query for efficiency
    // Group by month and year
    const result: any[] = await prisma.$queryRaw`
        SELECT 
            TO_CHAR("billedAt", 'Mon') as month_name,
            EXTRACT(MONTH FROM "billedAt") as month_num,
            EXTRACT(YEAR FROM "billedAt") as year,
            COUNT(id) as total_bills,
            SUM("totalAmount") as total_amount
        FROM "bills"
        WHERE "storeId" = ${storeId}::uuid
          AND "status" = 'COMPLETED'
          AND "billedAt" >= ${twelveMonthsAgo}
        GROUP BY year, month_num, month_name
        ORDER BY year ASC, month_num ASC
    `;

    // Map to required format & fill missing months if needed (optional, but good for UI)
    // The query returns only months with data. We should ensure all 12 months are present.

    const dataMap = new Map();
    result.forEach(r => {
        const key = `${r.month_num}-${r.year}`;
        dataMap.set(key, {
            month: r.month_name,
            year: Number(r.year),
            totalAmount: Number(r.total_amount || 0),
            totalBills: Number(r.total_bills || 0),
        });
    });

    const months: MonthlyGraphData[] = [];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getMonth() + 1}-${d.getFullYear()}`;

        if (dataMap.has(key)) {
            months.push(dataMap.get(key));
        } else {
            months.push({
                month: monthNames[d.getMonth()],
                year: d.getFullYear(),
                totalAmount: 0,
                totalBills: 0,
            });
        }
    }

    return months;
};

/**
 * Get recent bills
 */
export const getRecentBills = async (storeId: string, limit = 10): Promise<RecentBill[]> => {
    // Only select necessary fields
    const bills = await prisma.bill.findMany({
        where: { storeId },
        orderBy: { billedAt: 'desc' },
        take: limit,
        select: {
            id: true,
            billNumber: true,
            totalAmount: true,
            paymentMethod: true,
            status: true,
            billedAt: true,
            customer: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
            _count: {
                select: { billItems: true },
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
    const baseWhere: any = {
        storeId,
        status: 'UNREAD',
    };

    if (userId) {
        baseWhere.OR = [{ userId }, { userId: null }];
    }

    const [unreadCount, alertCount] = await Promise.all([
        prisma.notification.count({ where: baseWhere }),
        prisma.notification.count({
            where: {
                ...baseWhere,
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
 * Optimized to avoid filtering in JS
 */
export const getInventoryStats = async (storeId: string) => {
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    // Use aggregations for counts
    const totalProducts = await prisma.product.count({
        where: { storeId, isActive: true }
    });

    // Expiring Count (Database Filter)
    const expiringCount = await prisma.product.count({
        where: {
            storeId,
            isActive: true,
            expiryDate: {
                lte: ninetyDaysFromNow,
            },
        },
    });

    // Low Stock Count
    // Since we cannot compare fields easily in count(), we check database support.
    // Prisma usually doesn't support "quantity <= reorderLevel" in standard where.
    // We can use queryRaw for speed.
    const lowStockResult: any[] = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count 
        FROM "products" 
        WHERE "storeId" = ${storeId}::uuid
          AND "isActive" = true
          AND "quantity" <= "reorderLevel"
    `;
    const lowStockCount = lowStockResult[0]?.count || 0;

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
 * Implements Server-Side Caching
 */
export const getDashboardStats = async (storeId: string, userId?: string): Promise<DashboardStats> => {
    const cacheKey = `dashboard:${storeId}:${userId || 'all'}`;
    const cachedData = cache.get<DashboardStats>(cacheKey);

    if (cachedData) {
        return cachedData;
    }

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

    const stats: DashboardStats = {
        todaySales,
        monthlySummary,
        salesGraphData,
        recentBills,
        notifications,
        inventory,
        customers,
    };

    // Store in cache
    cache.set(cacheKey, stats);

    return stats;
};

/**
 * Get store settings
 */
export const getStoreSettings = async (storeId: string) => {
    // Basic query, no heavy optimization needed unless fields are huge
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

    // Invalidate cache when settings change (though stats might not rely on settings, better safe)
    const cacheKeyPattern = `dashboard:${storeId}:*`;
    const keys = cache.keys().filter(k => k.startsWith(`dashboard:${storeId}`));
    cache.del(keys);

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
