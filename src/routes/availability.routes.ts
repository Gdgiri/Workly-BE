import { Router } from 'express';
import { availabilityController } from '../controllers/availability.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protected route - All authenticated users can check availability
router.get(
    '/',
    authenticate,
    availabilityController.getAvailableSlots.bind(availabilityController)
);

export default router;
