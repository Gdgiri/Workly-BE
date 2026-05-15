import { Router } from 'express';
import { quotationController } from '../controllers/quotation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all quotation routes
router.use(authenticate);

// CRUD Routes
router.post('/', quotationController.create);
router.get('/', quotationController.list);
router.get('/:id', quotationController.getById);
router.patch('/:id/status', quotationController.updateStatus);

// Special Logic Routes
router.post('/:id/negotiate', quotationController.negotiate);
router.post('/:id/convert-to-sale', quotationController.convertToSale);

export default router;
