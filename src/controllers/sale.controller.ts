import { Request, Response } from 'express';
import saleService from '../services/sale.service';
import { SaleStatus, PaymentStatus } from '@prisma/client';
import { resolveDefaultAdminId } from '../utils/user.utils';
import prisma from '../prisma';


class SaleController {

    /**
     * Create a new sale
     * POST /api/v1/sales
     */
    async createSale(req: Request, res: Response) {
        try {
            const { customerId, appointmentId, items, discount, tax, notes, payments, attachments, specialistId, voucherCode, voucherDiscount, vouchers } = req.body;

            // Extract authId and adminId from authenticated user (Resolved by AuthMiddleware)
            const authId = (req as any).user?.id || (req as any).user?.authId;
            const adminId = (req as any).user?.adminId;

            if (!adminId) {
                console.error(`🚨 [ACCESS DENIED] No business context found for user ${authId}`);
                return res.status(403).json({ error: 'Business context required to create a sale' });
            }

            // Get createdBy from authenticated user (you can modify this based on your auth setup)
            const createdBy = (req as any).user?.id || 'admin';

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Items are required' });
            }

            const result = await saleService.createSale({
                customerId,
                appointmentId, // Pass appointmentId to service
                items,
                discount: discount || 0,
                tax: tax || 0,
                notes,
                createdBy,
                authId, // Add authId to track which user created this sale
                adminId, // Add adminId for multi-tenancy
                payments,
                attachments,
                specialistId,
                voucherCode,
                voucherDiscount,
                vouchers, // Pass vouchers array
                cashierName: (req as any).user?.name || (req as any).user?.email || 'Unknown',
            });

            const { sale, voucherRedemptions } = (result as any);

            return res.status(201).json({
                success: true,
                sale,
                balanceAmount: sale?.balanceAmount || 0,
                vouchers: voucherRedemptions // Include redemption status and NEW balances for frontend
            });
        } catch (error: any) {
            console.error('Create sale error:', error);
            return res.status(500).json({ error: error.message || 'Failed to create sale' });
        }
    }

    /**
     * Add payment to existing sale
     * POST /api/v1/sales/:id/payments
     */
    async addPaymentToSale(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                amount,
                paymentMethod,
                transactionId,
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                notes,
            } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({ error: 'Valid amount is required' });
            }

            if (!paymentMethod) {
                return res.status(400).json({ error: 'Payment method is required' });
            }

            // Strict Admin ID resolution
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;
            
            if (!adminId && authId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ 
                    where: { authId },
                    select: { id: true, role: true, businessEmail: true }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else {
                        // Look for Stylist profile (By AuthID or Email)
                        const stylist = await prisma.stylist.findFirst({
                            where: {
                                OR: [
                                    { authId: authId },
                                    { email: dbUser.businessEmail || (req as any).user?.email }
                                ]
                            },
                            select: { adminId: true }
                        });
                        
                        if (stylist) {
                            adminId = stylist.adminId;
                        } else if (dbUser.role === 'CUSTOMER') {
                            const customer = await prisma.customer.findFirst({
                                where: {
                                    OR: [
                                        { authId: authId },
                                        { email: dbUser.businessEmail || (req as any).user?.email }
                                    ]
                                },
                                select: { adminId: true }
                            });
                            adminId = customer?.adminId;
                        }
                    }
                }
            }

            // Fallback to default only if no authenticated identity or no associations found
            if (!adminId) {
                console.warn(`⚠️ [SaleController] No specific business context for user ${authId || 'Guest'}. Using default.`);
                adminId = await resolveDefaultAdminId();
            }

            const result = await saleService.addPaymentToSale(id, {
                amount,
                paymentMethod,
                transactionId,
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,

                notes,
                adminId,
                cashierName: (req as any).user?.name || (req as any).user?.email || 'Unknown',
            });

            return res.json({
                success: true,
                payment: result.payment,
                sale: result.sale,
                remainingBalance: result.sale.balanceAmount,
            });
        } catch (error: any) {
            console.error('Add payment to sale error:', error);
            return res.status(500).json({ error: error.message || 'Failed to add payment' });
        }
    }

    /**
     * Get sale by ID
     * GET /api/v1/sales/:id
     */
    async getSaleById(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const sale = await saleService.getSaleById(id);

            if (!sale) {
                return res.status(404).json({ error: 'Sale not found' });
            }

            return res.json(sale);
        } catch (error: any) {
            console.error('Get sale error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch sale' });
        }
    }

    /**
     * List sales with filters
     * GET /api/v1/sales
     */
    async listSales(req: Request, res: Response) {
        try {
            const {
                status,
                paymentStatus,
                customerId,
                from,
                to,
                page,
                limit,
            } = req.query;

            // Extract authId for multi-tenant filtering
            const authId = (req as any).user?.id;
            if (!authId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const filters: any = {
                authId,
                adminId: (req as any).user?.adminId || (req as any).user?.id // Pass adminId
            };

            if (status) filters.status = status as SaleStatus;
            if (paymentStatus) filters.paymentStatus = paymentStatus as PaymentStatus;
            if (customerId) filters.customerId = customerId as string;
            if (from) filters.from = new Date(from as string);
            if (to) filters.to = new Date(to as string);
            if (page) filters.page = parseInt(page as string);
            if (limit) filters.limit = parseInt(limit as string);

            const result = await saleService.listSales(filters);

            return res.json(result);
        } catch (error: any) {
            console.error('List sales error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch sales' });
        }
    }

    /**
     * Cancel a sale
     * POST /api/v1/sales/:id/cancel
     */
    async cancelSale(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const sale = await saleService.cancelSale(id, reason);

            return res.json({
                success: true,
                sale,
            });
        } catch (error: any) {
            console.error('Cancel sale error:', error);
            return res.status(500).json({ error: error.message || 'Failed to cancel sale' });
        }
    }

    /**
     * Get sales analytics
     * GET /api/v1/sales/analytics
     */
    async getSalesAnalytics(req: Request, res: Response) {
        try {
            const { from, to } = req.query;

            if (!from || !to) {
                return res.status(400).json({ error: 'From and to dates are required' });
            }

            // Extract authId for multi-tenant filtering
            const authId = (req as any).user?.id;
            if (!authId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const analytics = await saleService.getSalesAnalytics(
                new Date(from as string),
                new Date(to as string),
                authId, // Pass authId for tenant filtering
                (req as any).user?.adminId || (req as any).user?.id // Pass adminId
            );

            return res.json(analytics);
        } catch (error: any) {
            console.error('Get sales analytics error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch analytics' });
        }
    }

    async getMySales(req: Request, res: Response) {
        try {
            const authId = (req as any).user?.id || (req as any).user?.authId;
            const adminId = (req as any).user?.adminId;
            if (!authId) return res.status(401).json({ error: 'Unauthorized' });
            const customer = await prisma.customer.findFirst({ where: { authId, adminId } });
            if (!customer) return res.status(404).json({ error: 'Customer profile not found' });
            const filters = { customerId: customer.id, adminId: adminId || undefined, authId: authId, page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 50 };
            const result = await saleService.listSales(filters);
            return res.json(result);
        } catch (error: any) {
            console.error('Get my sales error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch your usage history' });
        }
    }
    /**
     * Get per-specialist service attendance stats
     * GET /api/v1/sales/specialist-stats
     * Query params: from, to (optional dates), specialistId (optional filter)
     */
    async getSpecialistServiceStats(req: Request, res: Response) {
        try {
            const adminId = (req as any).user?.adminId;
            if (!adminId) {
                return res.status(403).json({ error: 'Business context required' });
            }

            const { from, to, specialistId } = req.query;

            const stats = await saleService.getSpecialistServiceStats(
                adminId,
                from ? new Date(from as string) : undefined,
                to   ? new Date(to as string)   : undefined,
                specialistId as string | undefined
            );

            return res.json(stats);
        } catch (error: any) {
            console.error('Specialist stats error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch specialist stats' });
        }
    }
}

export default new SaleController();
