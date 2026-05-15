import { Router } from 'express';
import messageLogController from '../controllers/message-log.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication
router.use(authenticate);

router.post('/', messageLogController.createLog);
router.get('/', messageLogController.listLogs);
router.post('/:id/resend', messageLogController.resendMessage);

export default router;
