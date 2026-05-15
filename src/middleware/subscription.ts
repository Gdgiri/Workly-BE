import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to check subscription limits for ADMIN users
 * Only applies to business accounts, CUSTOMER users bypass this
 */
export const checkSubscriptionLimit = (feature: 'stylists' | 'appointments' | 'customers' | 'staff') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        // Only check limits for ADMIN users
        if (user?.role !== 'ADMIN') {
            return next();
        }

        if (!user?.subscription) {
            return res.status(403).json({
                error: 'No active subscription',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        const subscription = user.subscription;
        let currentCount = 0;

        try {
            switch (feature) {
                case 'stylists':
                    currentCount = await prisma.stylist.count({
                        where: { authId: user.id }
                    });
                    if (currentCount >= subscription.maxStylists) {
                        return res.status(403).json({
                            error: 'Subscription limit reached',
                            code: 'LIMIT_REACHED',
                            feature: 'stylists',
                            limit: subscription.maxStylists,
                            current: currentCount,
                            message: `You have reached your plan limit of ${subscription.maxStylists} stylists. Upgrade your plan to add more.`
                        });
                    }
                    break;

                case 'staff':
                    currentCount = await prisma.user.count({
                        where: {
                            role: { in: ['MANAGER', 'STAFF'] },
                            // TODO: Add business/tenant filtering when multi-tenancy is implemented
                        }
                    });
                    if (currentCount >= subscription.maxStaff) {
                        return res.status(403).json({
                            error: 'Staff limit reached',
                            code: 'LIMIT_REACHED',
                            feature: 'staff',
                            limit: subscription.maxStaff,
                            current: currentCount,
                            message: `You have reached your plan limit of ${subscription.maxStaff} staff members. Upgrade your plan to add more.`
                        });
                    }
                    break;

                case 'appointments':
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);

                    currentCount = await prisma.appointment.count({
                        where: {
                            authId: user.id,
                            createdAt: { gte: startOfMonth }
                        }
                    });
                    if (currentCount >= subscription.maxAppointments) {
                        return res.status(403).json({
                            error: 'Monthly appointment limit reached',
                            code: 'LIMIT_REACHED',
                            feature: 'appointments',
                            limit: subscription.maxAppointments,
                            current: currentCount,
                            message: `You have reached your monthly limit of ${subscription.maxAppointments} appointments. Upgrade your plan for more.`
                        });
                    }
                    break;

                case 'customers':
                    currentCount = await prisma.customer.count({
                        where: { authId: user.id }
                    });
                    if (currentCount >= subscription.maxCustomers) {
                        return res.status(403).json({
                            error: 'Customer limit reached',
                            code: 'LIMIT_REACHED',
                            feature: 'customers',
                            limit: subscription.maxCustomers,
                            current: currentCount,
                            message: `You have reached your plan limit of ${subscription.maxCustomers} customers. Upgrade your plan to add more.`
                        });
                    }
                    break;
            }

            // Limit not reached, proceed
            next();
        } catch (error) {
            console.error('Error checking subscription limit:', error);
            res.status(500).json({ error: 'Failed to check subscription limit' });
        }
    };
};
