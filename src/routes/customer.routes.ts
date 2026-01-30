import { Router } from 'express';
import customerController from '../controllers/customer.controller';
import { authenticate } from '../middleware/auth.middleware';
import { verifySubscription } from '../middleware/subscription.middleware';

const router = Router();

// All routes require authentication and active subscription
router.use(authenticate);
router.use(verifySubscription);

router.get('/search', customerController.searchCustomers);
router.get('/:id/bills', customerController.getCustomerBills);
router.get('/:id/last-bill-items', customerController.getCustomerLastBillItems);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

export default router;
