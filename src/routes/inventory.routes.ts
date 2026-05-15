import { Router } from 'express';
import inventoryController from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply strict auth middleware to ensure adminId is fetched from DB
router.use(authenticate);

// All routes now have access to req.user if token is provided
router.get('/', inventoryController.getAllProducts);
router.get('/history', inventoryController.getGlobalHistory);
router.get('/:id/history', inventoryController.getProductHistory);
router.get('/:id', inventoryController.getProductById);
router.post('/bulk', inventoryController.bulkCreateProducts);
router.post('/', inventoryController.createProduct);
router.put('/:id', inventoryController.updateProduct);
router.delete('/:id', inventoryController.deleteProduct);
router.patch('/:id/stock', inventoryController.updateStock);

export default router;
