import prisma from '../prisma';

export class SubscriptionPlanService {
    async getAllPlans() {
        return await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { monthlyPrice: 'asc' }
        });
    }

    async getPlanById(id: string) {
        return await prisma.subscriptionPlan.findUnique({
            where: { id }
        });
    }

    async createPlan(data: {
        authId?: string;
        name: string;
        description?: string;
        monthlyPrice: number;
        quarterlyPrice: number;
        yearlyPrice: number;
        maxStylists: number;
        maxAppointments: number;
        maxCustomers: number;
        maxStaff: number;
        features: any;
        isActive?: boolean;
        isDefault?: boolean;
        isTrial?: boolean;
        trialDays?: number;
    }) {
        return await prisma.subscriptionPlan.create({
            data: {
                authId: data.authId,
                name: data.name,
                description: data.description,
                monthlyPrice: data.monthlyPrice,
                quarterlyPrice: data.quarterlyPrice,
                yearlyPrice: data.yearlyPrice,
                maxStylists: data.maxStylists,
                maxAppointments: data.maxAppointments,
                maxCustomers: data.maxCustomers,
                maxStaff: data.maxStaff,
                features: data.features,
                isActive: data.isActive ?? true,
                isDefault: data.isDefault ?? false,
                isTrial: data.isTrial ?? false,
                trialDays: data.trialDays ?? 14
            }
        });
    }

    async updatePlan(id: string, data: any) {
        return await prisma.subscriptionPlan.update({
            where: { id },
            data
        });
    }

    async deletePlan(id: string) {
        // Check if plan has active subscriptions
        const activeSubscriptions = await prisma.subscription.count({
            where: { planId: id, status: { in: ['ACTIVE', 'TRIAL'] } }
        });

        if (activeSubscriptions > 0) {
            throw new Error('Cannot delete plan with active subscriptions');
        }

        return await prisma.subscriptionPlan.delete({
            where: { id }
        });
    }
}

export const subscriptionPlanService = new SubscriptionPlanService();
