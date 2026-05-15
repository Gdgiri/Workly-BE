import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /users/me - Get current user profile (any authenticated user)
router.get('/me', userController.getCurrentUser.bind(userController));

// GET /users/businesses - Get all businesses for this user (for store selection)
router.get('/businesses', userController.getMyBusinesses.bind(userController));

// PATCH /users/me - Update current user profile
router.patch('/me', userController.updateProfile.bind(userController));

// GET /users - List all users (admin only)
router.get('/', rbac(['ADMIN']), userController.getAllUsers.bind(userController));

// PATCH /users/:id/role - Update user role (admin only)
router.patch('/:id/role', rbac(['ADMIN']), userController.updateUserRole.bind(userController));

// PATCH /users/:id/deactivate - Deactivate user (admin only)
router.patch('/:id/deactivate', rbac(['ADMIN']), userController.deactivateUser.bind(userController));

export default router;
