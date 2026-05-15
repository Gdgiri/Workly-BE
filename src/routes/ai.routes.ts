import { Router } from 'express';
import aiController from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All AI routes require authentication
router.post('/chat', authenticate, aiController.chat);

export default router;
