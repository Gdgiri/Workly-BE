import { Router } from 'express';
import { packageController } from '../controllers/package.controller';
import { optionalAuth } from '../middleware/optionalAuth';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply optional auth middleware to capture user info
// Public routes (or partially public)
router.get('/active', optionalAuth, packageController.getActivePackages.bind(packageController));
router.get('/', optionalAuth, packageController.getAllPackages.bind(packageController));

// Protected routes - REQUIRE strict authentication/adminId
router.post('/', authenticate, packageController.createPackage.bind(packageController));
router.put('/:id', authenticate, packageController.updatePackage.bind(packageController));
router.delete('/:id', authenticate, packageController.deletePackage.bind(packageController));

export default router;
