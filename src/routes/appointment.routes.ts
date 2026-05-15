import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { appointmentPaymentController } from '../controllers/appointmentPayment.controller';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = Router();

// Availability checking (Public)
router.get('/availability', appointmentController.getAvailability.bind(appointmentController));

// Customer routes - only authenticated users can access
router.use(authMiddleware); // Apply strict auth to all routes below

router.get('/', appointmentController.getUserAppointments.bind(appointmentController));
router.get('/upcoming', appointmentController.getUpcomingAppointment.bind(appointmentController));
router.post('/', appointmentController.createAppointment.bind(appointmentController));
router.put('/:id', appointmentController.updateAppointment.bind(appointmentController));
router.patch('/:id/cancel', appointmentController.cancelAppointment.bind(appointmentController));
router.patch('/:id/reschedule', appointmentController.rescheduleAppointment.bind(appointmentController));

// Payment routes
router.post('/:id/pay-remaining', appointmentPaymentController.payRemainingAmount.bind(appointmentPaymentController));

export default router;
