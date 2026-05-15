import prisma from '../prisma';

export class SubscriptionService {
    async getAllSubscriptions() {
        return await prisma.subscription.findMany({
            include: {
                plan: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getSubscriptionById(id: string) {
        return await prisma.subscription.findUnique({
            where: { id },
            include: {
                plan: true
            }
        });
    }

    async getSubscriptionByUserId(userId: string) {
        return await prisma.subscription.findUnique({
            where: { userId },
            include: {
                plan: true
            }
        });
    }

    async createSubscription(data: {
        authId?: string;
        userId: string;
        planId: string;
        billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
        startDate?: Date;
        endDate?: Date;
        maxStylists?: number;
        maxAppointments?: number;
        maxCustomers?: number;
        maxStaff?: number;
    }) {
        // Get plan details
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id: data.planId }
        });

        if (!plan) {
            throw new Error('Subscription plan not found');
        }

        // Calculate amount based on billing cycle
        let amount = plan.monthlyPrice;
        if (data.billingCycle === 'QUARTERLY') {
            amount = plan.quarterlyPrice;
        } else if (data.billingCycle === 'YEARLY') {
            amount = plan.yearlyPrice;
        }

        // Calculate end date if not provided
        let endDate = data.endDate;
        if (!endDate && data.startDate) {
            endDate = new Date(data.startDate);
            if (data.billingCycle === 'YEARLY') {
                endDate.setFullYear(endDate.getFullYear() + 1);
            } else if (data.billingCycle === 'QUARTERLY') {
                endDate.setMonth(endDate.getMonth() + 3);
            } else {
                endDate.setMonth(endDate.getMonth() + 1);
            }
        }

        return await prisma.subscription.create({
            data: {
                authId: data.authId,
                userId: data.userId,
                planId: data.planId,
                status: plan.isTrial ? 'TRIAL' : 'ACTIVE',
                billingCycle: data.billingCycle || 'MONTHLY',
                startDate: data.startDate || new Date(),
                endDate,
                amount,
                maxStylists: data.maxStylists || plan.maxStylists,
                maxAppointments: data.maxAppointments || plan.maxAppointments,
                maxCustomers: data.maxCustomers || plan.maxCustomers,
                maxStaff: data.maxStaff || plan.maxStaff
            },
            include: {
                plan: true
            }
        });
    }

    async updateSubscription(id: string, data: any) {
        return await prisma.subscription.update({
            where: { id },
            data,
            include: {
                plan: true
            }
        });
    }

    async cancelSubscription(id: string) {
        return await prisma.subscription.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                endDate: new Date()
            },
            include: {
                plan: true
            }
        });
    }
}

export const subscriptionService = new SubscriptionService();
