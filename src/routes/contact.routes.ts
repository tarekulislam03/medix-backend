import { Router } from 'express';
import { submitContactForm } from '../controllers/contact.controller';

const router = Router();

// Rate limiting should be handled globally or specifically for this route if needed
// For now relying on global rate limiter

router.post('/', submitContactForm);

export default router;
