import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { superAdminController } from '../controllers/superadmin.controller';

const router = Router();

// Get pending business accounts (ADMIN users awaiting approval)
router.get('/businesses/pending',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    superAdminController.getPendingBusinesses.bind(superAdminController)
);

// Get all businesses
router.get('/businesses',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    superAdminController.getAllBusinesses.bind(superAdminController)
);

// Approve business
router.post('/businesses/:userId/approve',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    superAdminController.approveBusiness.bind(superAdminController)
);

// Reject business
router.post('/businesses/:userId/reject',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    superAdminController.rejectBusiness.bind(superAdminController)
);

// Suspend business
router.post('/businesses/:userId/suspend',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    superAdminController.suspendBusiness.bind(superAdminController)
);

export default router;
