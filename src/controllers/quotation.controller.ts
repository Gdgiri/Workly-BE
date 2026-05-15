import { Request, Response } from 'express';
import prisma from '../prisma';
import { extractUserContext, getAppId } from '../utils/auth.utils';
import { QuotationStatus, SaleStatus, PaymentStatus } from '@prisma/client';

/**
 * Controller for Quotations (Estimates)
 * Strictly restricted to apps starting with 'workly-service'
 */
export const quotationController = {
    /**
     * Create a new Quotation
     */
    create: async (req: Request, res: Response) => {
        try {
            const context = extractUserContext(req);
            const appId = getAppId(req);

            // Feature Guard
            if (!appId.startsWith('workly-service')) {
                return res.status(403).json({ 
                    error: 'Quotations feature is only available for Service Segment applications.' 
                });
            }

            const { 
                customerId, 
                items, 
                subtotal, 
                discount, 
                tax, 
                totalAmount, 
                validUntil, 
                notes 
            } = req.body;

            // Generate Quote Number: QT-YYYY-XXXX
            const year = new Date().getFullYear();
            const count = await prisma.quotation.count({
                where: { adminId: context.adminId }
            });
            const quoteNumber = `QT-${year}-${(count + 1).toString().padStart(4, '0')}`;

            const quotation = await prisma.quotation.create({
                data: {
                    quoteNumber,
                    customerId,
                    adminId: context.adminId,
                    authId: context.authId,
                    items,
                    subtotal,
                    discount: discount || 0,
                    tax: tax || 0,
                    totalAmount,
                    validUntil: validUntil ? new Date(validUntil) : null,
                    notes,
                    status: QuotationStatus.DRAFT
                }
            });

            return res.status(201).json(quotation);
        } catch (error: any) {
            console.error('Error creating quotation:', error);
            return res.status(500).json({ error: error.message || 'Internal server error' });
        }
    },

    /**
     * List all quotations for the admin
     */
    list: async (req: Request, res: Response) => {
        try {
            const context = extractUserContext(req);
            const { status } = req.query;

            const quotations = await prisma.quotation.findMany({
                where: {
                    adminId: context.adminId,
                    ...(status && { status: status as QuotationStatus })
                },
                include: { negotiations: { orderBy: { createdAt: 'desc' } } },
                orderBy: { createdAt: 'desc' }
            });

            return res.json(quotations);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get a single quotation
     */
    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const context = extractUserContext(req);

            const quotation = await prisma.quotation.findFirst({
                where: { id, adminId: context.adminId },
                include: { negotiations: { orderBy: { createdAt: 'desc' } } }
            });

            if (!quotation) {
                return res.status(404).json({ error: 'Quotation not found' });
            }

            return res.json(quotation);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    },

    /**
     * Update quotation status (e.g., to APPROVED)
     */
    updateStatus: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const context = extractUserContext(req);

            if (!Object.values(QuotationStatus).includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const quotation = await prisma.quotation.update({
                where: { id, adminId: context.adminId },
                data: { status: status as QuotationStatus }
            });

            return res.json(quotation);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    },

    /**
     * Convert an approved quotation to a Sale (Invoice)
     */
    convertToSale: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const context = extractUserContext(req);

            const quotation = await prisma.quotation.findFirst({
                where: { id, adminId: context.adminId }
            });

            if (!quotation) {
                return res.status(404).json({ error: 'Quotation not found' });
            }

            if (quotation.status !== QuotationStatus.APPROVED) {
                return res.status(400).json({ 
                    error: `Only APPROVED quotations can be converted to an invoice. Current status: ${quotation.status}` 
                });
            }

            // Generate Sale (Invoice) Number
            const year = new Date().getFullYear();
            const saleCount = await prisma.sale.count({
                where: { adminId: context.adminId }
            });
            const saleNumber = `INV-${year}-${(saleCount + 1).toString().padStart(4, '0')}`;

            // Execute as transaction for atomicity
            const result = await prisma.$transaction(async (tx) => {
                // 3. Create Sale (The actual Invoice)
                // Map quotation items to standard SaleItem format
                const saleItems = (quotation.items as any[]).map((item: any) => ({
                    type: 'service',
                    name: item.name || item.description || 'Service',
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.total
                }));

                // Calculate the difference between the sum of items and the official totalAmount (Negotiated)
                const itemsSum = saleItems.reduce((sum, item) => sum + item.total, 0);
                const quotationTax = (quotation as any).tax || 0;
                
                // The total discount should be the difference between the items sum (+ tax) and the final target total
                // This ensures totalAmount matches exactly what was negotiated.
                const finalDiscount = Math.max(0, itemsSum + quotationTax - quotation.totalAmount);

                const sale = await tx.sale.create({
                    data: {
                        saleNumber,
                        customerId: quotation.customerId,
                        adminId: quotation.adminId,
                        authId: quotation.authId,
                        items: saleItems as any,
                        subtotal: itemsSum, // Use the real sum of items as subtotal
                        discount: finalDiscount, // Put the negotiation adjustment into discount
                        tax: quotation.tax,
                        totalAmount: quotation.totalAmount, // This remains the negotiated amount
                        paidAmount: 0,
                        balanceAmount: quotation.totalAmount,
                        paymentStatus: PaymentStatus.PENDING,
                        saleStatus: SaleStatus.COMPLETED, // Finalized Invoice
                        createdBy: context.userName || 'System (Quotation)',
                        notes: `Converted from Quotation ${quotation.quoteNumber}. ${quotation.notes || ''}`
                    }
                });

                // 2. Update Quotation status
                await tx.quotation.update({
                    where: { id: quotation.id },
                    data: { status: QuotationStatus.INVOICED }
                });

                return sale;
            });

            return res.status(201).json({
                message: 'Quotation successfully converted to Invoice',
                sale: result
            });
        } catch (error: any) {
            console.error('Error converting quotation to sale:', error);
            return res.status(500).json({ error: error.message });
        }
    },

    /**
     * Record a negotiation for a quotation
     */
    negotiate: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { negotiatedAmount, description } = req.body;
            const context = extractUserContext(req);

            const quotation = await prisma.quotation.findFirst({
                where: { id, adminId: context.adminId }
            });

            if (!quotation) {
                return res.status(404).json({ error: 'Quotation not found' });
            }

            if (quotation.status === QuotationStatus.INVOICED) {
                return res.status(400).json({ error: 'Cannot negotiate an already invoiced quotation' });
            }

            const previousAmount = quotation.totalAmount;

            // Execute as transaction
            const result = await prisma.$transaction(async (tx) => {
                // 1. Create negotiation record
                const negotiation = await tx.quotationNegotiation.create({
                    data: {
                        quotationId: id,
                        previousAmount,
                        negotiatedAmount,
                        description,
                    }
                });

                // 2. Update quotation amount
                const updatedQuotation = await tx.quotation.update({
                    where: { id },
                    data: {
                        totalAmount: negotiatedAmount,
                        // DO NOT update subtotal here. Subtotal should remain the sum of items.
                        status: QuotationStatus.APPROVED
                    }
                });

                return { negotiation, updatedQuotation };
            });

            return res.json(result);
        } catch (error: any) {
            console.error('Error in negotiation:', error);
            return res.status(500).json({ error: error.message });
        }
    }
};
