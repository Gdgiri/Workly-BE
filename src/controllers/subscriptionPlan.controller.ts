import { Request, Response } from 'express';
import { subscriptionPlanService } from '../services/subscriptionPlan.service';

export class SubscriptionPlanController {
    // GET /api/v1/subscription-plans - Get all subscription plans
    async getAllPlans(req: Request, res: Response) {
        try {
            const plans = await subscriptionPlanService.getAllPlans();
            return res.json(plans);
        } catch (error) {
            console.error('❌ Error fetching subscription plans:', error);
            return res.status(500).json({ error: 'Failed to fetch subscription plans' });
        }
    }

    // GET /api/v1/subscription-plans/:id - Get single plan
    async getPlanById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const plan = await subscriptionPlanService.getPlanById(id);

            if (!plan) {
                return res.status(404).json({ error: 'Subscription plan not found' });
            }

            return res.json(plan);
        } catch (error) {
            console.error('❌ Error fetching subscription plan:', error);
            return res.status(500).json({ error: 'Failed to fetch subscription plan' });
        }
    }

    // POST /api/v1/subscription-plans - Create new plan
    async createPlan(req: Request, res: Response) {
        try {
            const {
                name, description, monthlyPrice, quarterlyPrice, yearlyPrice,
                maxStylists, maxAppointments, maxCustomers, maxStaff,
                features, isActive, isDefault, isTrial, trialDays
            } = req.body;

            // Extract authId from authenticated user
            const authId = (req as any).user?.id || (req as any).user?.authId;

            console.log('📋 Creating subscription plan with authId:', authId);
            console.log('   req.user:', (req as any).user);
            console.log('   Plan name:', name);

            const plan = await subscriptionPlanService.createPlan({
                authId,
                name,
                description,
                monthlyPrice: parseFloat(monthlyPrice),
                quarterlyPrice: parseFloat(quarterlyPrice),
                yearlyPrice: parseFloat(yearlyPrice),
                maxStylists: parseInt(maxStylists),
                maxAppointments: parseInt(maxAppointments),
                maxCustomers: parseInt(maxCustomers),
                maxStaff: parseInt(maxStaff),
                features,
                isActive,
                isDefault,
                isTrial,
                trialDays: parseInt(trialDays) || 14
            });

            console.log('✅ Subscription plan created with authId:', plan.authId);
            return res.status(201).json(plan);
        } catch (error: any) {
            console.error('❌ Error creating subscription plan:', error);
            return res.status(500).json({ error: error.message || 'Failed to create subscription plan' });
        }
    }

    // PUT /api/v1/subscription-plans/:id - Update plan
    async updatePlan(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            console.log('📋 Updating subscription plan with authId:', authId);

            const plan = await subscriptionPlanService.updatePlan(id, {
                ...req.body,
                authId // Track who modified
            });

            console.log('✅ Subscription plan updated with authId:', plan.authId);
            return res.json(plan);
        } catch (error: any) {
            console.error('❌ Error updating subscription plan:', error);
            return res.status(500).json({ error: error.message || 'Failed to update subscription plan' });
        }
    }

    // DELETE /api/v1/subscription-plans/:id - Delete plan
    async deletePlan(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await subscriptionPlanService.deletePlan(id);
            return res.status(204).send();
        } catch (error: any) {
            console.error('❌ Error deleting subscription plan:', error);
            return res.status(500).json({ error: error.message || 'Failed to delete subscription plan' });
        }
    }
}

export const subscriptionPlanController = new SubscriptionPlanController();
