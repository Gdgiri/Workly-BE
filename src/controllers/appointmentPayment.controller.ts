import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import paymentService from '../services/payment.service';
import { PaymentType } from '@prisma/client';
import { appointmentService } from '../services/appointment.service';

export class AppointmentPaymentController {
    /**
     * Process remaining payment (80%) for an appointment after service completion
     * POST /api/v1/appointments/:id/pay-remaining
     */
    async payRemainingAmount(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const {
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                amount
            } = req.body;

            console.log('💰 Processing remaining payment for appointment:', id);

            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
                return res.status(400).json({ error: 'Missing Razorpay payment details' });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({ error: 'Invalid payment amount' });
            }

            // Verify and create payment record
            const payment = await paymentService.verifyAndCreateRazorpayPayment({
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                amount,
                paymentType: PaymentType.REMAINING,
                appointmentId: id,
                notes: 'Remaining payment (80%) after service completion'
            });

            // Update appointment payment status
            const appointment = await appointmentService.processRemainingPayment(id, amount);

            console.log('✅ Remaining payment processed successfully');

            res.json({
                success: true,
                payment,
                appointment,
                message: 'Payment completed successfully'
            });

        } catch (error: any) {
            console.error('❌ Remaining payment error:', error);
            res.status(error.statusCode || 500).json({
                error: error.message || 'Failed to process remaining payment'
            });
        }
    }
}

export const appointmentPaymentController = new AppointmentPaymentController();
