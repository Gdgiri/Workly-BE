import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();

// Apply optional auth middleware to capture user info
router.use(optionalAuth);

router.get('/', subscriptionController.getAllSubscriptions.bind(subscriptionController));
router.get('/:id', subscriptionController.getSubscriptionById.bind(subscriptionController));
router.get('/user/:userId', subscriptionController.getSubscriptionByUserId.bind(subscriptionController));
router.post('/', subscriptionController.createSubscription.bind(subscriptionController));
router.put('/:id', subscriptionController.updateSubscription.bind(subscriptionController));
router.delete('/:id', subscriptionController.cancelSubscription.bind(subscriptionController));

export default router;
