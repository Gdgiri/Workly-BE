import { Router } from 'express';
import saleController from '../controllers/sale.controller';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = Router();

// Apply strict auth middleware
router.use(authMiddleware);

// Sales analytics (must be before /:id route)
router.get('/analytics', saleController.getSalesAnalytics);

// Specialist service attendance stats (must be before /:id route)
router.get('/specialist-stats', saleController.getSpecialistServiceStats);

// Sale CRUD routes
router.post('/', saleController.createSale);
router.get('/', saleController.listSales);
router.get('/:id', saleController.getSaleById);

// Sale payment routes
router.post('/:id/payments', saleController.addPaymentToSale);

// Sale actions
router.post('/:id/cancel', saleController.cancelSale);

export default router;
