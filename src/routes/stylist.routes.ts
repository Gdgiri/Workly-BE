import { Router } from 'express';
import { stylistController } from '../controllers/stylist.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Stylist routes (all require authentication)
router.get('/', stylistController.getAllStylists.bind(stylistController));
router.post('/', stylistController.createStylist.bind(stylistController));
router.get('/:id', stylistController.getStylistById.bind(stylistController));
router.put('/:id', stylistController.updateStylist.bind(stylistController));
router.delete('/:id', stylistController.deleteStylist.bind(stylistController));
router.patch('/:id/roster', stylistController.updateRoster.bind(stylistController));

export default router;

