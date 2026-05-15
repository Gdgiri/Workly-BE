import express from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/public/register/:businessName', customerController.publicRegister);

// Apply authentication middleware to all customer routes
// This ensures req.user is populated with the authenticated admin's details
router.use(authenticate);

router.post('/', customerController.createCustomer);
router.post('/join', customerController.joinBusiness); // New route for users joining a business
// Validate if user is customer of a business (for login validation)
router.post('/validate-business', authenticate, customerController.validateBusiness);
router.get('/search', customerController.searchCustomers);
router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

// OTP Verification Routes
router.post('/:id/request-otp', customerController.requestOtp);
router.post('/:id/verify-otp', customerController.verifyOtp);



export const customerRoutes = router;
