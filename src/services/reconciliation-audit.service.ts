import prisma from '../prisma';
import { ReconciliationAuditType, AuditAttemptStatus } from '@prisma/client';

interface AuditLogData {
    authId: string;
    adminId: string;
    attemptType: ReconciliationAuditType;
    inputData: any;
    calculatedResults: any;
    reconciliationId?: string;
    attemptStatus?: AuditAttemptStatus;
    errorMessage?: string;
    errorCode?: string;
    userName?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    duration?: number;
}

interface AuditFilters {
    adminId: string;
    from?: Date;
    to?: Date;
    authId?: string;
    attemptType?: ReconciliationAuditType;
    attemptStatus?: AuditAttemptStatus;
    page?: number;
    limit?: number;
}

class ReconciliationAuditService {
    /**
     * Log a reconciliation calculation attempt
     * Creates an immutable audit record
     */
    async logCalculationAttempt(data: AuditLogData) {
        // Validate required fields
        if (!data.authId || !data.adminId) {
            throw new Error('authId and adminId are required for audit logging');
        }

        // Validate attemptType
        const validTypes: ReconciliationAuditType[] = ['CALCULATE', 'SAVE', 'UPDATE', 'DELETE'];
        if (!validTypes.includes(data.attemptType)) {
            throw new Error(`Invalid attemptType: ${data.attemptType}`);
        }

        // Sanitize input data (remove sensitive fields)
        const sanitizedInput = this.sanitizeInputData(data.inputData);
        const sanitizedResults = this.sanitizeInputData(data.calculatedResults);

        // Extract discrepancy information for easy querying
        const discrepancyInfo = this.extractDiscrepancyInfo(data.calculatedResults);

        try {
            const auditLog = await prisma.reconciliationAudit.create({
                data: {
                    authId: data.authId,
                    adminId: data.adminId,
                    attemptType: data.attemptType,
                    attemptStatus: data.attemptStatus || 'SUCCESS',
                    errorMessage: data.errorMessage,
                    errorCode: data.errorCode,
                    inputData: sanitizedInput,
                    calculatedResults: sanitizedResults,
                    discrepancyAmount: discrepancyInfo.amount,
                    discrepancyType: discrepancyInfo.type,
                    reconciliationId: data.reconciliationId,
                    userName: data.userName,
                    userRole: data.userRole,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    sessionId: data.sessionId,
                    requestId: data.requestId,
                    duration: data.duration,
                },
            });

            console.log('✅ Audit log created:', {
                id: auditLog.id,
                type: auditLog.attemptType,
                status: auditLog.attemptStatus,
                adminId: auditLog.adminId,
            });

            return auditLog;
        } catch (error: any) {
            console.error('❌ Failed to create audit log:', error);
            // Don't throw - audit logging failure should not break the main operation
            // But log the error for monitoring
            return null;
        }
    }

    /**
     * Get audit logs with filters and pagination
     * Enforces multi-tenant isolation
     */
    async getAuditLogs(filters: AuditFilters) {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 100); // Max 100 per page
        const skip = (page - 1) * limit;

        const where: any = {
            adminId: filters.adminId, // Strict multi-tenant filtering
            isDeleted: false, // Don't show soft-deleted records
        };

        // Filter by specific user
        if (filters.authId) {
            where.authId = filters.authId;
        }

        // Filter by attempt type
        if (filters.attemptType) {
            where.attemptType = filters.attemptType;
        }

        // Filter by attempt status
        if (filters.attemptStatus) {
            where.attemptStatus = filters.attemptStatus;
        }

        // Filter by date range
        if (filters.from || filters.to) {
            where.attemptTimestamp = {};
            if (filters.from) where.attemptTimestamp.gte = filters.from;
            if (filters.to) where.attemptTimestamp.lte = filters.to;
        }

        const [logs, total] = await Promise.all([
            prisma.reconciliationAudit.findMany({
                where,
                orderBy: { attemptTimestamp: 'desc' },
                skip,
                take: limit,
                include: {
                    reconciliation: {
                        select: {
                            id: true,
                            date: true,
                            status: true,
                            difference: true,
                        },
                    },
                },
            }),
            prisma.reconciliationAudit.count({ where }),
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get audit statistics for a specific admin
     * Provides insights into reconciliation patterns
     */
    async getAuditStats(adminId: string, dateRange?: { from: Date; to: Date }) {
        const where: any = {
            adminId,
            isDeleted: false,
        };

        if (dateRange) {
            where.attemptTimestamp = {
                gte: dateRange.from,
                lte: dateRange.to,
            };
        }

        // Get total counts
        const [totalAttempts, successfulAttempts, failedAttempts] = await Promise.all([
            prisma.reconciliationAudit.count({ where }),
            prisma.reconciliationAudit.count({ where: { ...where, attemptStatus: 'SUCCESS' } }),
            prisma.reconciliationAudit.count({ where: { ...where, attemptStatus: 'FAILED' } }),
        ]);

        // Get unique users
        const uniqueUsers = await prisma.reconciliationAudit.findMany({
            where,
            select: {
                authId: true,
                userName: true,
            },
            distinct: ['authId'],
        });

        // Get attempts by user
        const attemptsByUser = await prisma.reconciliationAudit.groupBy({
            by: ['authId', 'userName'],
            where,
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: 'desc',
                },
            },
        });

        // Get attempts by day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const attemptsByDay = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(attemptTimestamp) as date,
        COUNT(*) as count,
        SUM(CASE WHEN attemptStatus = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN attemptStatus = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM reconciliation_audits
      WHERE adminId = ${adminId}
        AND isDeleted = 0
        AND attemptTimestamp >= ${thirtyDaysAgo}
      GROUP BY DATE(attemptTimestamp)
      ORDER BY date DESC
    `;

        return {
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            partialAttempts: totalAttempts - successfulAttempts - failedAttempts,
            uniqueUsers: uniqueUsers.length,
            attemptsByUser: attemptsByUser.map(item => ({
                authId: item.authId,
                userName: item.userName || 'Unknown',
                count: item._count.id,
            })),
            attemptsByDay: attemptsByDay.map(item => ({
                date: item.date,
                total: Number(item.count),
                successful: Number(item.successful),
                failed: Number(item.failed),
            })),
        };
    }

    /**
     * Get audit history for a specific reconciliation
     */
    async getReconciliationAuditHistory(reconciliationId: string, adminId: string) {
        return await prisma.reconciliationAudit.findMany({
            where: {
                reconciliationId,
                adminId, // Ensure multi-tenant isolation
                isDeleted: false,
            },
            orderBy: { attemptTimestamp: 'desc' },
        });
    }

    /**
     * Sanitize input data by removing sensitive fields
     * @private
     */
    private sanitizeInputData(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        // Create a copy to avoid mutating original
        const sanitized = { ...data };

        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
        sensitiveFields.forEach(field => {
            delete sanitized[field];
        });

        return sanitized;
    }

    /**
     * Extract discrepancy information from calculated results
     * @private
     */
    private extractDiscrepancyInfo(calculatedResults: any): {
        amount: number | null;
        type: string | null;
    } {
        if (!calculatedResults || typeof calculatedResults !== 'object') {
            return { amount: null, type: null };
        }

        const difference = calculatedResults.difference || calculatedResults.discrepancy || 0;

        let type: string | null = null;
        if (difference > 0) {
            type = 'OVER';
        } else if (difference < 0) {
            type = 'SHORT';
        } else {
            type = 'BALANCED';
        }

        return {
            amount: Math.abs(difference),
            type,
        };
    }
}

export default new ReconciliationAuditService();
