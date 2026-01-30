import { Request, Response } from 'express';
import customerService from '../services/customer.service';

/**
 * Create a new customer
 * POST /api/v1/customers
 */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { firstName, phone } = req.body;
        if (!firstName || !phone) {
            res.status(400).json({ success: false, message: 'Name and Phone are required' });
            return;
        }

        const customer = await customerService.createCustomer(req.storeId, req.body);
        res.status(201).json({
            success: true,
            data: customer,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create customer';
        res.status(400).json({ success: false, message });
    }
};

/**
 * Search customers
 * GET /api/v1/customers/search?q=...
 */
export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const query = (req.query.q as string) || '';
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        // Check if it looks like a full phone number search for exact match
        if (query && query.match(/^\d{10}$/)) {
            const exactMatch = await customerService.getCustomerByPhone(req.storeId, query);
            if (exactMatch) {
                res.status(200).json({ success: true, data: [exactMatch], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } });
                return;
            }
        }

        // Search with query (empty query returns all customers)
        const result = await customerService.searchCustomers(req.storeId, query, page, limit);
        res.status(200).json({
            success: true,
            data: result.customers,
            pagination: result.pagination,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to search customers';
        res.status(500).json({ success: false, message });
    }
};

/**
 * Get customer details
 * GET /api/v1/customers/:id
 */
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const customer = await customerService.getCustomerById(req.storeId, String(id));

        if (!customer) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }

        res.status(200).json({
            success: true,
            data: customer,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get customer';
        res.status(500).json({ success: false, message });
    }
};

/**
 * Update customer
 * PUT /api/v1/customers/:id
 */
export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const customer = await customerService.updateCustomer(req.storeId, String(id), req.body);

        res.status(200).json({
            success: true,
            data: customer,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update customer';
        res.status(400).json({ success: false, message });
    }
};

/**
 * Get customer bills
 * GET /api/v1/customers/:id/bills
 */
export const getCustomerBills = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await customerService.getCustomerBills(req.storeId, String(id), page, limit);

        res.status(200).json({
            success: true,
            data: result.bills,
            pagination: result.pagination
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get customer history';
        res.status(500).json({ success: false, message });
    }
}

/**
 * Get customer's last bill items (for auto-fill in POS)
 * GET /api/v1/customers/:id/last-bill-items
 */
export const getCustomerLastBillItems = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const items = await customerService.getCustomerLastBillItems(req.storeId, String(id));

        res.status(200).json({
            success: true,
            data: items
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get last bill items';
        res.status(500).json({ success: false, message });
    }
}

/**
 * Delete customer
 * DELETE /api/v1/customers/:id
 */
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        await customerService.deleteCustomer(req.storeId, String(id));

        res.status(200).json({
            success: true,
            message: 'Customer deleted successfully',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete customer';
        res.status(400).json({ success: false, message });
    }
};

export default {
    createCustomer,
    searchCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    getCustomerBills,
    getCustomerLastBillItems
};
