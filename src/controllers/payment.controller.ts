import { Request, Response } from 'express';
import paymentService from '../services/payment.service';
import { resolveDefaultAdminId } from '../utils/user.utils';

class PaymentController {
    /**
     * Create Razorpay order for payment
     * POST /api/v1/payments/razorpay/create-order
     */
    async createRazorpayOrder(req: Request, res: Response) {
        try {
            const { amount, notes } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({ error: 'Valid amount is required' });
            }

            // Determine adminId (DB ID)
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ where: { authId } });
                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }

            if (!adminId) {
                if (notes?.serviceId) {
                    try {
                        const { serviceService } = await import('../services/service.service');
                        const service = await serviceService.getServiceById(notes.serviceId);
                        adminId = service?.authId || await resolveDefaultAdminId();
                        console.log(`📌 Using service's admin: ${adminId} (from service: ${notes.serviceId})`);
                    } catch (error) {
                        console.error('Failed to fetch service:', error);
                        adminId = await resolveDefaultAdminId();
                    }
                } else {
                    adminId = await resolveDefaultAdminId();
                }
            }

            const order = await paymentService.createRazorpayOrder(
                amount,
                notes,
                adminId
            );

            return res.json({
                success: true,
                order,
            });
        } catch (error: any) {
            console.error('Create Razorpay order error:', error);
            return res.status(500).json({ error: error.message || 'Failed to create Razorpay order' });
        }
    }

    /**
     * Verify Razorpay payment
     * POST /api/v1/payments/razorpay/verify
     */
    async verifyRazorpayPayment(req: Request, res: Response) {
        try {
            const {
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                amount,
                appointmentId,
                saleId,
                notes,
            } = req.body;

            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
                return res.status(400).json({ error: 'Missing Razorpay payment details' });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({ error: 'Valid amount is required' });
            }

            if (!appointmentId && !saleId) {
                return res.status(400).json({ error: 'Either appointmentId or saleId is required' });
            }

            let adminId = (req as any).user?.adminId || await resolveDefaultAdminId();
            let finalAppointmentId = appointmentId;

            try {
                if (appointmentId) {
                    const { appointmentService } = await import('../services/appointment.service');
                    const appointment = await appointmentService.getAppointmentById(appointmentId);
                    if (appointment?.adminId) {
                        adminId = appointment.adminId;
                    }
                } else if (saleId) {
                    const saleService = (await import('../services/sale.service')).default;
                    const sale = await saleService.getSaleById(saleId);
                    if (sale) {
                        if (sale.appointmentId) finalAppointmentId = sale.appointmentId;
                        if (sale.adminId) adminId = sale.adminId;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Failed to resolve authId from context:', error);
            }

            const payment = await paymentService.verifyAndCreateRazorpayPayment({
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                amount,
                appointmentId: finalAppointmentId,
                saleId,
                notes,
                adminId,
                cashierName: (req as any).user?.name || (req as any).user?.email || 'Unknown',
            });

            res.json({
                success: true,
                payment,
            });
        } catch (error: any) {
            console.error('Verify Razorpay payment error:', error);
            return res.status(500).json({ error: error.message || 'Payment verification failed' });
        }
    }

    /**
     * Get all payments
     * GET /api/v1/payments
     */
    async getPayments(req: Request, res: Response) {
        try {
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;
            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ where: { authId } });
                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }
            const {
                page = '1',
                limit = '10',
                status,
                paymentMethod,
                startDate,
                endDate,
                minAmount,
                maxAmount,
                customerSearch,
            } = req.query;

            const result = await paymentService.getPayments({
                adminId,
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                status: status as string,
                paymentMethod: paymentMethod as string,
                startDate: startDate as string,
                endDate: endDate as string,
                minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
                maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,

                customerSearch: customerSearch as string,
                specialist: req.query.specialist as string,
            });

            return res.json(result);
        } catch (error: any) {
            console.error('Get payments error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch payments' });
        }
    }

    async testFilter(req: Request, res: Response) {
        try {
            const { minAmount = '500' } = req.query;
            const minNum = parseFloat(minAmount as string);
            const where: any = { amount: { gte: minNum } };
            const pendingSaleWhere: any = {
                paymentStatus: 'PENDING',
                paidAmount: { gte: minNum }
            };

            const [payments, sales] = await Promise.all([
                prisma.payment.findMany({ where, take: 20 }),
                prisma.sale.findMany({ where: pendingSaleWhere, take: 20 })
            ]);

            return res.json({
                params: { minAmount: minNum },
                where,
                pendingSaleWhere,
                paymentsCount: payments.length,
                salesCount: sales.length,
                payments: payments.map(p => ({ id: p.id, amount: p.amount })),
                sales: sales.map(s => ({ id: s.id, paidAmount: s.paidAmount }))
            });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get unique specialists
     * GET /api/v1/payments/specialists
     */
    async getUniqueSpecialists(req: Request, res: Response) {
        try {
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ where: { authId } });
                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }

            if (!adminId) {
                adminId = await resolveDefaultAdminId();
            }

            const specialists = await paymentService.getUniqueSpecialists(adminId);
            return res.json(specialists);
        } catch (error: any) {
            console.error('Get specialists error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch specialists' });
        }
    }

    /**
     * Get payment by ID
     * GET /api/v1/payments/:id
     */
    async getPaymentById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const payment = await paymentService.getPaymentById(id);
            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            return res.json(payment);
        } catch (error: any) {
            console.error('Get payment error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch payment' });
        }
    }

    /**
     * Refund a payment
     * POST /api/v1/payments/:id/refund
     */
    async refundPayment(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { amount } = req.body;
            const payment = await paymentService.refundPayment(id, amount);
            return res.json({
                success: true,
                payment,
            });
        } catch (error: any) {
            console.error('Refund payment error:', error);
            return res.status(500).json({ error: error.message || 'Failed to process refund' });
        }
    }

    /**
     * Create Razorpay Payment Link (QR)
     * POST /api/v1/payments/razorpay/payment-link
     */
    async createPaymentLink(req: Request, res: Response) {
        try {
            const { amount, notes } = req.body;
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ where: { authId } });
                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }
            if (notes?.serviceId) {
                try {
                    const { serviceService } = await import('../services/service.service');
                    const service = await serviceService.getServiceById(notes.serviceId);
                    if (service?.authId) adminId = service.authId;
                } catch (e) { }
            }

            // Enhanced Resolution: Check Sale or Appointment if adminId is still fallback or missing
            if (notes?.saleId || notes?.appointmentId) {
                const prisma = (await import('../prisma')).default;
                if (notes.saleId) {
                    const sale = await prisma.sale.findUnique({
                        where: { id: notes.saleId },
                        select: { adminId: true }
                    });
                    if (sale?.adminId) adminId = sale.adminId;
                } else if (notes.appointmentId) {
                    const appointment = await prisma.appointment.findUnique({
                        where: { id: notes.appointmentId },
                        select: { adminId: true }
                    });
                    if (appointment?.adminId) adminId = appointment.adminId;
                }
            }

            // Final safety check: if adminId is still missing, use default
            if (!adminId) adminId = await resolveDefaultAdminId();

            const result = await paymentService.createPaymentLink(amount, notes, adminId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get Payment Link Status
     * GET /api/v1/payments/razorpay/payment-link/:id
     */
    async getPaymentLinkStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            let adminId = (req as any).user?.adminId || await resolveDefaultAdminId();
            const result = await paymentService.getPaymentLinkStatus(id, adminId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async completePaymentLink(req: Request, res: Response) {
        try {
            const { linkId, saleId } = req.body;
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ where: { authId } });
                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }
            if (!adminId) adminId = await resolveDefaultAdminId();

            const result = await paymentService.completePaymentLink(linkId, saleId, adminId);
            res.json({ success: true, payment: result });
        } catch (error: any) {
            console.error('Complete payment link error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new PaymentController();
