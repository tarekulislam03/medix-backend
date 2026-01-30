import { Router } from 'express';
import { importBill, confirmImport } from '../controllers/billImport.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import multer from 'multer';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

router.post(
    '/import-bill',
    authenticate,
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
    upload.single('bill'),
    importBill
);

router.post(
    '/confirm-import',
    authenticate,
    authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
    confirmImport
);

export default router;
