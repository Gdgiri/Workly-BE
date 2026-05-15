import { Router } from 'express';
import reconciliationAuditController from '../controllers/reconciliation-audit.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditRateLimit } from '../middleware/rate-limit';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All routes have rate limiting
router.use(auditRateLimit);

/**
 * POST /api/v1/reconciliation-audits/log-calculation
 * Log a calculation attempt (when user clicks Calculate & Verify)
 * Available to all authenticated users (ADMIN, MANAGER, STAFF)
 */
router.post('/log-calculation', reconciliationAuditController.logCalculation);

// ADMIN-only routes below
router.use(requireRole(['ADMIN']));

/**
 * GET /api/v1/reconciliation-audits
 * Get all audit logs with optional filters
 * Query params: from, to, authId, attemptType, attemptStatus, page, limit
 */
router.get('/', reconciliationAuditController.getAuditLogs);

/**
 * GET /api/v1/reconciliation-audits/stats
 * Get audit statistics
 * Query params: from, to
 */
router.get('/stats', reconciliationAuditController.getAuditStats);

/**
 * GET /api/v1/reconciliation-audits/reconciliation/:id
 * Get audit history for a specific reconciliation
 * Params: id (reconciliation ID)
 */
router.get('/reconciliation/:id', reconciliationAuditController.getReconciliationAuditHistory);

export default router;
