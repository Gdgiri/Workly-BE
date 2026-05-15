import { Router } from 'express';
import reconciliationController from '../controllers/reconciliation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All reconciliation routes require authentication
router.use(authenticate);

// Get today's expected totals (must be before /:id routes)
router.get('/expected-totals', reconciliationController.getTodayExpectedTotals);

// Create a new reconciliation
router.post('/', reconciliationController.createReconciliation);

// Get all reconciliations with filters
router.get('/', reconciliationController.getReconciliations);

export default router;
