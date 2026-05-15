import prisma from '../prisma';

class ReconciliationService {
    /**
     * Create a new reconciliation record
     */
    async createReconciliation(data: {
        systemTotal: number;
        countedTotal: number;
        difference: number;
        status: string;
        notes?: string;
        cashier: string;
        paymentBreakdown: Record<string, number>;
        authId?: string;
        adminId?: string;
        totalExpenses?: number;
    }) {
        return await prisma.reconciliation.create({
            data: {
                systemTotal: data.systemTotal,
                countedTotal: data.countedTotal,
                difference: data.difference,
                totalExpenses: data.totalExpenses || 0,
                status: data.status,
                notes: data.notes,
                cashier: data.cashier,
                paymentBreakdown: data.paymentBreakdown as any,
                authId: data.authId,
                adminId: data.adminId, // Store adminId
            },
        });
    }

    /**
     * Get all reconciliations with pagination
     */
    async getReconciliations(filters?: {
        from?: Date;
        to?: Date;
        page?: number;
        limit?: number;
        filterId?: string; // adminId or authId
    }) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (filters?.filterId) {
            where.OR = [
                { authId: filters.filterId },
                { adminId: filters.filterId }
            ];
        } else {
            // Strict multi-tenancy: return nothing if no context
            return { reconciliations: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }

        if (filters?.from || filters?.to) {
            where.date = where.date || {};
            if (filters.from) where.date.gte = filters.from;
            if (filters.to) where.date.lte = filters.to;
        }

        const [reconciliations, total] = await Promise.all([
            prisma.reconciliation.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: limit,
            }),
            prisma.reconciliation.count({ where }),
        ]);

        return {
            reconciliations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get today's expected totals from sales/payments
     */
    async getTodayExpectedTotals(filterId?: string) {
        if (!filterId) return { total: 0, totalExpenses: 0, breakdown: {} };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fetch all payments for today
        const payments = await prisma.payment.findMany({
            where: {
                createdAt: {
                    gte: today,
                    lt: tomorrow,
                },
                paymentStatus: 'COMPLETED',
                OR: [
                    { authId: filterId },
                    { adminId: filterId }
                ]
            },
        });

        const standardizeMethod = (method: string): string => {
            if (!method) return 'CASH';
            // Simple standardization for consistent grouping (casing and spaces)
            return method.toUpperCase().trim().replace(/\s+/g, '_');
        };

        // Group by payment method
        const breakdown: Record<string, number> = {};
        let total = 0;

        for (const payment of payments) {
            const standardized = standardizeMethod(payment.paymentMethod);
            breakdown[standardized] = (breakdown[standardized] || 0) + payment.amount;
            total += payment.amount;
        }

        // Fetch expenses for today
        const expenses = await prisma.expense.findMany({
            where: {
                date: {
                    gte: today,
                    lt: tomorrow,
                },
                OR: [
                    { authId: filterId },
                    { adminId: filterId }
                ]
            },
        });

        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        return {
            total,
            totalExpenses,
            breakdown,
        };
    }
}

export default new ReconciliationService();
