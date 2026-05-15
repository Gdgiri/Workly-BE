import { Router } from 'express';
import { subscriptionPlanController } from '../controllers/subscriptionPlan.controller';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();

// Apply optional auth middleware to capture user info
router.use(optionalAuth);

router.get('/', subscriptionPlanController.getAllPlans.bind(subscriptionPlanController));
router.get('/:id', subscriptionPlanController.getPlanById.bind(subscriptionPlanController));
router.post('/', subscriptionPlanController.createPlan.bind(subscriptionPlanController));
router.put('/:id', subscriptionPlanController.updatePlan.bind(subscriptionPlanController));
router.delete('/:id', subscriptionPlanController.deletePlan.bind(subscriptionPlanController));

export default router;
