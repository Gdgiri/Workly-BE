import { Request, Response } from 'express';
import reconciliationAuditService from '../services/reconciliation-audit.service';
import { extractUserContext, extractIpAddress, extractUserAgent, extractRequestId } from '../utils/auth.utils';
import { ReconciliationAuditType, AuditAttemptStatus } from '@prisma/client';

class ReconciliationAuditController {
    /**
     * Get all audit logs with filters
     * GET /api/v1/reconciliation-audits
     * ADMIN only
     */
    async getAuditLogs(req: Request, res: Response) {
        try {
            const { adminId } = extractUserContext(req);
            const { from, to, authId, attemptType, attemptStatus, page, limit } = req.query;

            const filters: any = {
                adminId, // Enforce multi-tenant isolation
            };

            // Parse date filters
            if (from) {
                filters.from = new Date(from as string);
            }
            if (to) {
                filters.to = new Date(to as string);
            }

            // Parse other filters
            if (authId) filters.authId = authId as string;
            if (attemptType) filters.attemptType = attemptType as ReconciliationAuditType;
            if (attemptStatus) filters.attemptStatus = attemptStatus as AuditAttemptStatus;
            if (page) filters.page = parseInt(page as string);
            if (limit) filters.limit = parseInt(limit as string);

            const result = await reconciliationAuditService.getAuditLogs(filters);

            res.json({
                success: true,
                ...result,
            });
        } catch (error: any) {
            console.error('Get audit logs error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch audit logs',
            });
        }
    }

    /**
     * Get audit statistics
     * GET /api/v1/reconciliation-audits/stats
     * ADMIN only
     */
    async getAuditStats(req: Request, res: Response) {
        try {
            const { adminId } = extractUserContext(req);
            const { from, to } = req.query;

            let dateRange: { from: Date; to: Date } | undefined;
            if (from && to) {
                dateRange = {
                    from: new Date(from as string),
                    to: new Date(to as string),
                };
            }

            const stats = await reconciliationAuditService.getAuditStats(adminId, dateRange);

            res.json({
                success: true,
                stats,
            });
        } catch (error: any) {
            console.error('Get audit stats error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch audit statistics',
            });
        }
    }

    /**
     * Get audit history for a specific reconciliation
     * GET /api/v1/reconciliation-audits/reconciliation/:id
     * ADMIN only
     */
    async getReconciliationAuditHistory(req: Request, res: Response) {
        try {
            const { adminId } = extractUserContext(req);
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Reconciliation ID is required',
                });
            }

            const history = await reconciliationAuditService.getReconciliationAuditHistory(id, adminId);

            res.json({
                success: true,
                history,
            });
        } catch (error: any) {
            console.error('Get reconciliation audit history error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch audit history',
            });
        }
    }

    /**
     * Log a calculation attempt
     * POST /api/v1/reconciliation-audits/log-calculation
     * Available to all authenticated users
     */
    async logCalculation(req: Request, res: Response) {
        const startTime = Date.now();

        try {
            const { authId, adminId, userName, userRole } = extractUserContext(req);
            const {
                systemTotal,
                countedTotal,
                difference,
                status,
                notes,
                cashier,
                paymentBreakdown,
                totalExpenses,
            } = req.body;

            // Log the calculation attempt
            const duration = Date.now() - startTime;
            await reconciliationAuditService.logCalculationAttempt({
                authId,
                adminId,
                attemptType: 'CALCULATE',
                attemptStatus: 'SUCCESS',
                inputData: {
                    systemTotal,
                    countedTotal,
                    difference,
                    status,
                    notes,
                    cashier,
                    paymentBreakdown,
                    totalExpenses,
                },
                calculatedResults: {
                    systemTotal,
                    countedTotal,
                    difference,
                    status,
                    totalExpenses,
                    discrepancy: difference,
                },
                userName,
                userRole,
                ipAddress: extractIpAddress(req),
                userAgent: extractUserAgent(req),
                requestId: extractRequestId(req),
                duration,
            });

            res.json({
                success: true,
                message: 'Calculation logged successfully',
            });
        } catch (error: any) {
            console.error('Log calculation error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to log calculation',
            });
        }
    }
}

export default new ReconciliationAuditController();
