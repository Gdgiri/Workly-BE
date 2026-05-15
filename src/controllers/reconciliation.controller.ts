import { Request, Response } from 'express';
import reconciliationService from '../services/reconciliation.service';
import reconciliationAuditService from '../services/reconciliation-audit.service';
import { extractUserContext, extractIpAddress, extractUserAgent, extractRequestId } from '../utils/auth.utils';
import { emailService } from '../services/email.service';
import prisma from '../prisma';

class ReconciliationController {
    /**
     * Create a new reconciliation record
     * POST /api/v1/reconciliations
     */
    async createReconciliation(req: Request, res: Response) {
        const startTime = Date.now();

        try {
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

            if (systemTotal === undefined || countedTotal === undefined || difference === undefined || !status || !cashier || !paymentBreakdown) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Extract user context using utility
            const { authId, adminId, userName, userRole } = extractUserContext(req);

            console.log('📝 Creating reconciliation with context:', { authId, adminId });

            const reconciliation = await reconciliationService.createReconciliation({
                systemTotal,
                countedTotal,
                difference,
                status,
                notes,
                cashier,
                paymentBreakdown,
                authId: authId,
                adminId: adminId,
                totalExpenses,
            });

            // Trigger WhatsApp and Email Reports for all successful reconciliations (Balanced or Discrepancy)
            try {
                const { whatsappService } = require('../services/whatsapp/whatsapp.service');
                const { settingsService } = require('../services/settings.service');
                const settings = await settingsService.getOrCreateSettings(adminId);

                // Fetch Admin User to get businessEmail
                const adminUser = await prisma.user.findUnique({
                    where: { id: adminId }
                });

                const currencySymbol = settings.currency === 'SGD' ? '$' : (settings.currency === 'INR' ? '₹' : (settings.currency || ''));

                // 1. WhatsApp Report/Alert
                if (settings.whatsappNotifications && settings.salonPhone) {
                    whatsappService.sendReconciliationAlert({
                        adminId,
                        salonName: settings.salonName || adminUser?.businessName || 'Salon',
                        salonPhone: settings.salonPhone,
                        systemTotal,
                        countedTotal,
                        difference,
                        symbol: currencySymbol,
                        cashier,
                        notes,
                        status,
                        paymentBreakdown
                    }).catch((err: any) => console.error('WhatsApp Alert background error:', err));
                }

                // 2. Email Report/Alert
                if (adminUser?.businessEmail) {
                    emailService.sendReconciliationEmail({
                        adminId,
                        to: adminUser.businessEmail,
                        salonName: settings.salonName || adminUser.businessName || 'Salon',
                        systemTotal,
                        countedTotal,
                        difference,
                        symbol: currencySymbol,
                        cashier,
                        notes,
                        status,
                        paymentBreakdown
                    }).catch((err: any) => console.error('Email Alert background error:', err));
                }

            } catch (alertError) {
                console.error('Failed to trigger reconciliation alerts:', alertError);
            }
            // Log audit entry for successful reconciliation creation
            const duration = Date.now() - startTime;
            await reconciliationAuditService.logCalculationAttempt({
                authId,
                adminId,
                attemptType: 'SAVE',
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
                    id: reconciliation.id,
                    systemTotal: reconciliation.systemTotal,
                    countedTotal: reconciliation.countedTotal,
                    difference: reconciliation.difference,
                    status: reconciliation.status,
                    totalExpenses: reconciliation.totalExpenses,
                },
                reconciliationId: reconciliation.id,
                userName,
                userRole,
                ipAddress: extractIpAddress(req),
                userAgent: extractUserAgent(req),
                requestId: extractRequestId(req),
                duration,
            });

            res.status(201).json({
                success: true,
                reconciliation,
            });
        } catch (error: any) {
            console.error('Create reconciliation error:', error);

            // Log audit entry for failed reconciliation creation
            try {
                const { authId, adminId, userName, userRole } = extractUserContext(req);
                const duration = Date.now() - startTime;

                await reconciliationAuditService.logCalculationAttempt({
                    authId,
                    adminId,
                    attemptType: 'SAVE',
                    attemptStatus: 'FAILED',
                    errorMessage: error.message,
                    errorCode: error.code || 'UNKNOWN_ERROR',
                    inputData: req.body,
                    calculatedResults: {},
                    userName,
                    userRole,
                    ipAddress: extractIpAddress(req),
                    userAgent: extractUserAgent(req),
                    requestId: extractRequestId(req),
                    duration,
                });
            } catch (auditError) {
                console.error('Failed to log audit entry:', auditError);
            }

            res.status(500).json({ error: error.message || 'Failed to create reconciliation' });
        }
    }

    /**
     * Get all reconciliations with optional filters
     * GET /api/v1/reconciliations
     */
    async getReconciliations(req: Request, res: Response) {
        try {
            const { from, to, page, limit } = req.query;

            const filters: any = {};
            if (from) filters.from = new Date(from as string);
            if (to) filters.to = new Date(to as string);
            if (page) filters.page = parseInt(page as string);
            if (limit) filters.limit = parseInt(limit as string);

            const { authId, adminId } = extractUserContext(req);
            filters.filterId = adminId || authId; // Prioritize adminId

            const result = await reconciliationService.getReconciliations(filters);

            res.json(result);
        } catch (error: any) {
            console.error('Get reconciliations error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch reconciliations' });
        }
    }

    /**
     * Get today's expected totals from sales/payments
     * GET /api/v1/reconciliations/expected-totals
     */
    async getTodayExpectedTotals(req: Request, res: Response) {
        try {
            const { authId, adminId } = extractUserContext(req);
            const filterId = adminId || authId;

            const result = await reconciliationService.getTodayExpectedTotals(filterId);
            res.json(result);
        } catch (error: any) {
            console.error('Get expected totals error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch expected totals' });
        }
    }
}

export default new ReconciliationController();
