import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();
// router.use(optionalAuth); // Removed global optionalAuth to be more granular

// Razorpay routes
router.post('/razorpay/create-order', optionalAuth, paymentController.createRazorpayOrder); // Can be public? Revisit if needed.
router.post('/razorpay/verify', optionalAuth, paymentController.verifyRazorpayPayment);
router.post('/razorpay/payment-link', authenticate, paymentController.createPaymentLink); // Restored authentication
router.post('/razorpay/payment-link/complete', optionalAuth, paymentController.completePaymentLink);
router.get('/razorpay/payment-link/:id', optionalAuth, paymentController.getPaymentLinkStatus);

// Payment routes
router.get('/specialists', authenticate, paymentController.getUniqueSpecialists);
router.get('/test-filter', optionalAuth, paymentController.testFilter);
router.get('/', authenticate, paymentController.getPayments); // Admin listing
router.get('/:id', optionalAuth, paymentController.getPaymentById);
router.post('/:id/refund', authenticate, paymentController.refundPayment); // Admin only

export default router;
