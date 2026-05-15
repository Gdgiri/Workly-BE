import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service';

export class SubscriptionController {
    // GET /api/v1/subscriptions - Get all subscriptions
    async getAllSubscriptions(req: Request, res: Response) {
        try {
            const subscriptions = await subscriptionService.getAllSubscriptions();
            return res.json(subscriptions);
        } catch (error) {
            console.error('❌ Error fetching subscriptions:', error);
            return res.status(500).json({ error: 'Failed to fetch subscriptions' });
        }
    }

    // GET /api/v1/subscriptions/:id - Get single subscription
    async getSubscriptionById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const subscription = await subscriptionService.getSubscriptionById(id);

            if (!subscription) {
                return res.status(404).json({ error: 'Subscription not found' });
            }

            return res.json(subscription);
        } catch (error) {
            console.error('❌ Error fetching subscription:', error);
            return res.status(500).json({ error: 'Failed to fetch subscription' });
        }
    }

    // GET /api/v1/subscriptions/user/:userId - Get user's subscription
    async getSubscriptionByUserId(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const subscription = await subscriptionService.getSubscriptionByUserId(userId);

            if (!subscription) {
                return res.status(404).json({ error: 'No subscription found for this user' });
            }

            return res.json(subscription);
        } catch (error) {
            console.error('❌ Error fetching user subscription:', error);
            return res.status(500).json({ error: 'Failed to fetch user subscription' });
        }
    }

    // POST /api/v1/subscriptions - Create new subscription
    async createSubscription(req: Request, res: Response) {
        try {
            const {
                userId, planId, billingCycle, startDate, endDate,
                maxStylists, maxAppointments, maxCustomers, maxStaff
            } = req.body;

            // Extract authId from authenticated user
            const authId = (req as any).user?.id || (req as any).user?.authId;

            console.log('💳 Creating subscription with authId:', authId);
            console.log('   req.user:', (req as any).user);
            console.log('   User ID:', userId, 'Plan ID:', planId);

            const subscription = await subscriptionService.createSubscription({
                authId,
                userId,
                planId,
                billingCycle,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                maxStylists,
                maxAppointments,
                maxCustomers,
                maxStaff
            });

            console.log('✅ Subscription created with authId:', subscription.authId);
            return res.status(201).json(subscription);
        } catch (error: any) {
            console.error('❌ Error creating subscription:', error);
            return res.status(500).json({ error: error.message || 'Failed to create subscription' });
        }
    }

    // PUT /api/v1/subscriptions/:id - Update subscription
    async updateSubscription(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            console.log('💳 Updating subscription with authId:', authId);

            const subscription = await subscriptionService.updateSubscription(id, {
                ...req.body,
                authId // Track who modified
            });

            console.log('✅ Subscription updated with authId:', subscription.authId);
            return res.json(subscription);
        } catch (error: any) {
            console.error('❌ Error updating subscription:', error);
            return res.status(500).json({ error: error.message || 'Failed to update subscription' });
        }
    }

    // DELETE /api/v1/subscriptions/:id - Cancel subscription
    async cancelSubscription(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const subscription = await subscriptionService.cancelSubscription(id);
            return res.json(subscription);
        } catch (error: any) {
            console.error('❌ Error cancelling subscription:', error);
            return res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
        }
    }
}

export const subscriptionController = new SubscriptionController();
