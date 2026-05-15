import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();

// Apply optional auth middleware to capture user info
router.use(optionalAuth);

// GET /api/v1/settings/public - Get public settings (no auth required)
router.get('/public', settingsController.getPublicSettings.bind(settingsController));

// GET /api/v1/settings - Get current admin's settings
router.get('/', settingsController.getSettings.bind(settingsController));

// PUT /api/v1/settings - Update settings
router.put('/', settingsController.updateSettings.bind(settingsController));

// PUT /api/v1/settings/payment-methods - Update payment methods
router.put('/payment-methods', settingsController.updatePaymentMethods.bind(settingsController));

// POST /api/v1/settings/generate-url - Generate user URL (short or long)
router.post('/generate-url', settingsController.generateUserURL.bind(settingsController));
export default router;
