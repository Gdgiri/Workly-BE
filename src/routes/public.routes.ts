import express from 'express';
import { customerController } from '../controllers/customer.controller';
import { publicController } from '../controllers/public.controller';

const router = express.Router();

// Discovery Route (for Multi-Store Staff Login)
router.get('/staff/discover', publicController.discoverStaff);

// Register a new customer for a specific business
router.post('/:businessName/register', customerController.publicRegister);

// Public Data Routes (For Booking Page)
router.get('/:businessName/data', publicController.getStoreData);
router.get('/:businessName/services', publicController.getServices);
router.get('/:businessName/stylists', publicController.getStylists);

// Auth Proxy Routes (Unauthenticated)
router.post('/auth/forgot-password', publicController.forgotPassword);
router.post('/auth/reset-password', publicController.resetPassword);

// Internal Sync Route (Protected by network/CORS or shared secret ideally, but public for now)
import { userController } from '../controllers/user.controller';
router.post('/users/init', userController.initUser.bind(userController));

export default router;
