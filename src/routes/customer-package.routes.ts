import { Router } from 'express';
import { customerPackageController } from '../controllers/customer-package.controller';

const router = Router();

// Customer package routes
router.post('/customers/:customerId/packages', customerPackageController.purchasePackage.bind(customerPackageController));
router.get('/customers/:customerId/packages', customerPackageController.getCustomerPackages.bind(customerPackageController));
router.get('/customers/:customerId/packages/active', customerPackageController.getActivePackages.bind(customerPackageController));

// Customer package management routes
router.get('/customer-packages/:id', customerPackageController.getPackageById.bind(customerPackageController));
router.patch('/customer-packages/:id/use', customerPackageController.usePackageService.bind(customerPackageController));
router.patch('/customer-packages/:id/cancel', customerPackageController.cancelPackage.bind(customerPackageController));
router.post('/customer-packages/expire', customerPackageController.expirePackages.bind(customerPackageController));

export default router;
