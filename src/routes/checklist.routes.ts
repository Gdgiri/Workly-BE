import { Router } from 'express';
import { checklistController } from '../controllers/checklist.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// TEMPLATES (Admin only usually, but let's keep it authenticated for now)
router.post('/templates', authenticate, checklistController.createTemplate);
router.get('/templates', authenticate, checklistController.getAllTemplates);
router.get('/templates/:id', authenticate, checklistController.getTemplateById);
router.patch('/templates/:id', authenticate, checklistController.updateTemplate);
router.delete('/templates/:id', authenticate, checklistController.deleteTemplate);

// SUBMISSIONS
router.post('/submit', authenticate, checklistController.submitChecklist);
router.get('/submission/appointment/:id', authenticate, checklistController.getSubmissionByAppointment);

// SERVICE ATTACHMENT
router.post('/attach', authenticate, checklistController.attachToService);

export default router;
