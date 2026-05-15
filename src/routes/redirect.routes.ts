import express from 'express';
import redirectController from '../controllers/redirect.controller';

const router = express.Router();

// Public route - no authentication required
router.get('/:shortCode', redirectController.redirectToUserSite);

export default router;