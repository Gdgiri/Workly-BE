import { Router } from 'express';
import { serviceController } from '../controllers/service.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Secured routes (All service access requires auth for multi-tenancy)
router.get('/', authenticate, serviceController.getAllServices.bind(serviceController));
router.get('/:id', authenticate, serviceController.getServiceById.bind(serviceController));

// Protected routes (require authentication)
router.post('/bulk', authenticate, serviceController.bulkCreateServices.bind(serviceController));
router.post('/', authenticate, serviceController.createService.bind(serviceController));
router.put('/:id', authenticate, serviceController.updateService.bind(serviceController));
router.delete('/:id', authenticate, serviceController.deleteService.bind(serviceController));

export default router;
