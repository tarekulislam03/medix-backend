import { Request, Response } from 'express';
import { BillStatus, PaymentMethod } from '@prisma/client';
import billingService from '../services/billing.service';

/**
 * Create a new bill
 * POST /api/v1/billing/bills
 */
export const createBill = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId || !req.user) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const {
            customerId, items, paymentMethod, amountPaid,
            discountAmount, doctorFees, otherCharges,
            doctorName, notes
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: 'Bill must have at least one item' });
            return;
        }

        const bill = await billingService.createBill(req.storeId, req.user.userId, {
            customerId,
            items,
            paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            amountPaid: Number(amountPaid),
            discountAmount: Number(discountAmount || 0),
            doctorFees: Number(doctorFees || 0),
            otherCharges: Number(otherCharges || 0),
            doctorName,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'Bill created successfully',
            data: bill,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create bill';
        res.status(400).json({
            success: false,
            message,
        });
    }
};

/**
 * Get bills list
 * GET /api/v1/billing/bills
 */
export const getBills = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const status = req.query.status ? (req.query.status as BillStatus) : undefined;

        const result = await billingService.getBills(
            req.storeId,
            { search, startDate, endDate, status },
            page,
            limit
        );

        res.status(200).json({
            success: true,
            data: result.bills,
            pagination: result.pagination,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch bills';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Get bill detail
 * GET /api/v1/billing/bills/:id
 */
export const getBillById = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const bill = await billingService.getBillById(req.storeId, String(id));

        if (!bill) {
            res.status(404).json({ success: false, message: 'Bill not found' });
            return;
        }

        res.status(200).json({
            success: true,
            data: bill,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch bill';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

/**
 * Search products for billing
 * GET /api/v1/billing/products/search?q=...
 */
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const query = req.query.q as string;
        if (!query || query.length < 2) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        const products = await billingService.searchProductsForBilling(req.storeId, query);
        res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to search products';
        res.status(500).json({
            success: false,
            message,
        });
    }
};

export default {
    createBill,
    getBills,
    getBillById,
    searchProducts,
};
