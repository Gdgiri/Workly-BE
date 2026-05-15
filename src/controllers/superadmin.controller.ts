import { Request, Response } from 'express';
import { PrismaClient, ApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class SuperAdminController {
    /**
     * Get all pending business accounts (ADMIN users awaiting approval)
     */
    async getPendingBusinesses(req: Request, res: Response) {
        try {
            const pendingBusinesses = await prisma.user.findMany({
                where: {
                    role: 'ADMIN',
                    approvalStatus: ApprovalStatus.PENDING
                },
                select: {
                    id: true,
                    authId: true,
                    businessName: true,
                    businessEmail: true,
                    businessPhone: true,
                    businessAddress: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                count: pendingBusinesses.length,
                businesses: pendingBusinesses
            });
        } catch (error) {
            console.error('Error fetching pending businesses:', error);
            res.status(500).json({ error: 'Failed to fetch pending businesses' });
        }
    }

    /**
     * Get all businesses with optional status filter
     */
    async getAllBusinesses(req: Request, res: Response) {
        try {
            const { status } = req.query;

            const where: any = { role: 'ADMIN' };
            if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status as string)) {
                where.approvalStatus = status;
            }

            const businesses = await prisma.user.findMany({
                where,
                include: {
                    subscription: {
                        include: { plan: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                count: businesses.length,
                businesses
            });
        } catch (error) {
            console.error('Error fetching businesses:', error);
            res.status(500).json({ error: 'Failed to fetch businesses' });
        }
    }

    /**
     * Approve a business and assign subscription
     */
    async approveBusiness(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { subscriptionPlanId, trialPeriod } = req.body;
            const superAdmin = req.user;

            // Verify user is ADMIN
            const business = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            if (business.role !== 'ADMIN') {
                return res.status(400).json({ error: 'User is not a business account' });
            }

            if (business.approvalStatus !== ApprovalStatus.PENDING) {
                return res.status(400).json({ error: 'Business is not pending approval' });
            }

            // Get plan (default to trial if not specified)
            let planId = subscriptionPlanId;
            if (!planId) {
                const trialPlan = await prisma.subscriptionPlan.findFirst({
                    where: { isTrial: true }
                });
                planId = trialPlan?.id;
            }

            if (!planId) {
                return res.status(400).json({ error: 'No subscription plan specified and no trial plan available' });
            }

            const plan = await prisma.subscriptionPlan.findUnique({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({ error: 'Subscription plan not found' });
            }

            // Calculate trial/subscription end date
            const trialDays = trialPeriod || plan.trialDays || 14;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + trialDays);

            // Approve and create subscription in transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create subscription
                const subscription = await tx.subscription.create({
                    data: {
                        userId,
                        planId,
                        status: plan.isTrial ? 'TRIAL' : 'ACTIVE',
                        billingCycle: 'MONTHLY',
                        amount: plan.monthlyPrice,
                        maxStylists: plan.maxStylists,
                        maxAppointments: plan.maxAppointments,
                        maxCustomers: plan.maxCustomers,
                        maxStaff: plan.maxStaff,
                        endDate: plan.isTrial ? endDate : null,
                        nextBillingDate: endDate,
                    }
                });

                // Update business user
                const updatedBusiness = await tx.user.update({
                    where: { id: userId },
                    data: {
                        approvalStatus: ApprovalStatus.APPROVED,
                        approvedBy: superAdmin?.id,
                        approvedAt: new Date(),
                        subscriptionId: subscription.id,
                    },
                    include: {
                        subscription: {
                            include: { plan: true }
                        }
                    }
                });

                return updatedBusiness;
            });

            console.log(`✅ Business approved: ${business.businessName} (${userId})`);
            console.log(`   Plan: ${plan.name}, Status: ${plan.isTrial ? 'TRIAL' : 'ACTIVE'}`);

            // TODO: Send approval email notification

            res.json({
                success: true,
                message: 'Business approved successfully',
                business: result
            });
        } catch (error) {
            console.error('Error approving business:', error);
            res.status(500).json({ error: 'Failed to approve business' });
        }
    }

    /**
     * Reject a business application
     */
    async rejectBusiness(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const superAdmin = req.user;

            if (!reason) {
                return res.status(400).json({ error: 'Rejection reason is required' });
            }

            const business = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            if (business.role !== 'ADMIN') {
                return res.status(400).json({ error: 'User is not a business account' });
            }

            const updatedBusiness = await prisma.user.update({
                where: { id: userId },
                data: {
                    approvalStatus: ApprovalStatus.REJECTED,
                    approvedBy: superAdmin?.id,
                    approvedAt: new Date(),
                    rejectionReason: reason,
                    isActive: false,
                }
            });

            console.log(`❌ Business rejected: ${business.businessName} (${userId})`);
            console.log(`   Reason: ${reason}`);

            // TODO: Send rejection email notification

            res.json({
                success: true,
                message: 'Business rejected',
                business: updatedBusiness
            });
        } catch (error) {
            console.error('Error rejecting business:', error);
            res.status(500).json({ error: 'Failed to reject business' });
        }
    }

    /**
     * Suspend a business (deactivate subscription)
     */
    async suspendBusiness(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;

            const business = await prisma.user.findUnique({
                where: { id: userId },
                include: { subscription: true }
            });

            if (!business || business.role !== 'ADMIN') {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Suspend subscription
            if (business.subscription) {
                await prisma.subscription.update({
                    where: { id: business.subscription.id },
                    data: { status: 'SUSPENDED' }
                });
            }

            // Deactivate business
            await prisma.user.update({
                where: { id: userId },
                data: { isActive: false }
            });

            console.log(`⏸️  Business suspended: ${business.businessName} (${userId})`);
            if (reason) console.log(`   Reason: ${reason}`);

            // TODO: Send suspension email notification

            res.json({
                success: true,
                message: 'Business suspended',
                reason
            });
        } catch (error) {
            console.error('Error suspending business:', error);
            res.status(500).json({ error: 'Failed to suspend business' });
        }
    }
}

export const superAdminController = new SuperAdminController();
