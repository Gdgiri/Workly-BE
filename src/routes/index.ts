import { Router } from 'express';
import serviceRoutes from './service.routes';
import stylistRoutes from './stylist.routes';
import availabilityRoutes from './availability.routes';
import appointmentRoutes from './appointment.routes';
import { customerRoutes } from './customer.routes';
import inventoryRoutes from './inventory.routes';
import packageRoutes from './package.routes';
import customerPackageRoutes from './customer-package.routes';
import expenseRoutes from './expense.routes';
import paymentRoutes from './payment.routes';
import saleRoutes from './sale.routes';
import settingsRoutes from './settings.routes';
import userRoutes from './user.routes';
import superadminRoutes from './superadmin.routes';
import subscriptionPlanRoutes from './subscriptionPlan.routes';
import subscriptionRoutes from './subscription.routes';
import reconciliationRoutes from './reconciliation.routes';
import reconciliationAuditRoutes from './reconciliation-audit.routes';
import voucherRoutes from './voucher.routes';
import categoryRoutes from './category.routes';
import dashboardRoutes from './dashboard.routes';
import publicRoutes from './public.routes';
import messageLogRoutes from './message-log.routes';
import aiRoutes from './ai.routes';
import checklistRoutes from './checklist.routes';
import quotationRoutes from './quotation.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'Salon Backend', version: '1.1.0-discovery-fix-v1' });
});

router.get('/ping', (req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString(), version: '1.1.0-discovery-fix-v1' });
});

router.use('/public', publicRoutes); // Public unauthenticated routes

// Note: Authentication is handled by AuthService (separate microservice)
// No auth routes needed here - frontend calls AuthService directly
router.use('/services', serviceRoutes);
router.use('/stylists', stylistRoutes);
router.use('/availability', availabilityRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/customers', customerRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/packages', packageRoutes);
router.use('/', customerPackageRoutes); // Customer package routes (includes /customers/:id/packages and /customer-packages)
router.use('/expenses', expenseRoutes);
router.use('/payments', paymentRoutes);
router.use('/sales', saleRoutes);
router.use('/settings', settingsRoutes);
router.use('/users', userRoutes);  // User management routes
router.use('/superadmin', superadminRoutes);  // SuperAdmin routes
router.use('/subscription-plans', subscriptionPlanRoutes);  // Subscription plans
router.use('/subscriptions', subscriptionRoutes);  // Subscriptions
router.use('/reconciliations', reconciliationRoutes);  // Reconciliations
router.use('/reconciliation-audits', reconciliationAuditRoutes);  // Reconciliation Audits (ADMIN only)
router.use('/vouchers', voucherRoutes); // Vouchers & Claims
router.use('/categories', categoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/message-logs', messageLogRoutes);
router.use('/ai', aiRoutes);
router.use('/checklists', checklistRoutes);
router.use('/quotations', quotationRoutes);


export default router;
