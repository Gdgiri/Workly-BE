import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import dashboardController from '../controllers/dashboard.controller';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Get dashboard statistics
router.get('/', dashboardController.getDashboard.bind(dashboardController));

export default router;
