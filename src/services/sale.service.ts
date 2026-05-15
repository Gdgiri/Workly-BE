import { PaymentStatus, SaleStatus, Prisma } from '@prisma/client';
import prisma from '../prisma';
import paymentService from './payment.service';
import { whatsappService } from './whatsapp/whatsapp.service';
import { settingsService } from './settings.service';
import { resolvePaymentMethod, DB_PAYMENT_METHODS, normalizePaymentMethod } from './payment.service';
import inventoryService from './inventory.service';


interface SaleItem {
    type: 'service' | 'product' | 'combo' | 'voucher';
    itemId: string;
    name: string;
    quantity: number;
    price: number;
    discount?: number;
    redeemedFromPackageId?: string;
    redeemedItemId?: string;
    redeemedQuantity?: number;
    specialistId?: string | number;
    specialistName?: string;
}

interface CreateSaleData {
    customerId?: string;
    customerName?: string;
    appointmentId?: string; // Link to appointment if sale originated from one
    items: SaleItem[];
    discount?: number;
    tax?: number;
    notes?: string;
    createdBy: string;
    authId?: string; // Track which user created this sale
    adminId?: string; // Admin ID for multi-tenancy
    payments?: Array<{
        amount: number;
        paymentMethod: any;
        paymentStatus?: any; // Add status to interface
        transactionId?: string;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
    }>;
    attachments?: any;
    cashierName?: string;
    specialistId?: string;
    voucherCode?: string;
    voucherDiscount?: number;
    vouchers?: Array<{
        code: string;
        amount: number;
    }>;
}



/**
 * Normalizes attachments to ensure they have a 'url' property
 */
const normalizeAttachments = (attachments: any): any => {
    if (!attachments) return attachments;
    if (Array.isArray(attachments)) {
        return attachments.map(att => ({
            ...att,
            url: att.url || att.imgUrl || att.img
        }));
    }
    if (typeof attachments === 'object') {
        return {
            ...attachments,
            url: (attachments as any).url || (attachments as any).imgUrl || (attachments as any).img
        };
    }
    return attachments;
};

class SaleService {


    private mapPaymentMethod(method: any): string {
        if (!method) return 'CASH';
        if (typeof method !== 'string') return String(method);

        const normalized = normalizePaymentMethod(method);
        return normalized;
    }

    async generateSaleNumber(adminId?: string): Promise<string> {
        let prefix = 'SALE-';

        if (adminId) {
            try {
                const settings = await prisma.settings.findUnique({ where: { adminId } });
                if (settings?.salesIdPrefix) prefix = settings.salesIdPrefix;
            } catch (e) { }
        }

        const now = new Date();
        const dateStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        const pattern = `${prefix}${dateStr}-`;

        const lastSale = await prisma.sale.findFirst({
            where: { saleNumber: { startsWith: pattern } },
            orderBy: { saleNumber: 'desc' },
            select: { saleNumber: true }
        });

        let nextNumber = 1;
        if (lastSale) {
            const parts = lastSale.saleNumber.split('-');
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum)) nextNumber = lastNum + 1;
        }

        return `${pattern}${String(nextNumber).padStart(3, '0')}`;
    }

    /**
     * Calculate sale totals
     */
    calculateTotals(items: SaleItem[], discount: number = 0, tax: number = 0, voucherDiscount: number = 0, vouchers: Array<{ amount: number }> = []) {
        const subtotal = items.reduce((sum, item) => {
            const chargeableQty = item.redeemedQuantity ? Math.max(0, item.quantity - item.redeemedQuantity) : item.quantity;
            const itemTotal = item.price * chargeableQty;
            const itemDiscount = item.discount || 0;
            return sum + Math.max(0, itemTotal - itemDiscount);
        }, 0);

        const totalVoucherDiscount = (voucherDiscount || 0) + (vouchers?.reduce((sum, v) => sum + (v.amount || 0), 0) || 0);
        const totalDiscount = (discount || 0) + totalVoucherDiscount;

        // Ensure we don't discount more than the subtotal
        const effectiveDiscount = Math.min(subtotal, totalDiscount);

        const subtotalAfterDiscount = subtotal - effectiveDiscount;
        const taxAmount = (subtotalAfterDiscount * tax) / 100;
        const totalAmount = Math.max(0, subtotalAfterDiscount + taxAmount);

        return {
            subtotal,
            discount: effectiveDiscount,
            tax: taxAmount,
            totalAmount,
            baseDiscount: discount,
            voucherDiscount: totalVoucherDiscount,
            overriddenDiscount: totalDiscount > subtotal // Log if UI sent too much discount
        };
    }

    /**
     * Create a new sale
     */
    async createSale(data: CreateSaleData) {
        // Multi-tenancy verification (Senior Dev Security Guard)
        if (data.adminId) {
            if (data.customerId) {
                const customer = await prisma.customer.findUnique({
                    where: { id: data.customerId },
                    select: { adminId: true }
                });
                if (customer && customer.adminId !== data.adminId) {
                    console.error(`🚨 [TENANCY VIOLATION] Sale attempted for Customer ${data.customerId} in Business ${data.adminId}. Correct Admin is ${customer.adminId}.`);
                    throw new Error('Multi-tenancy violation: Customer does not belong to this business context.');
                }
            }

            if (data.appointmentId) {
                const appointment = await prisma.appointment.findUnique({
                    where: { id: data.appointmentId },
                    select: { adminId: true }
                });
                if (appointment && appointment.adminId !== data.adminId) {
                    console.error(`🚨 [TENANCY VIOLATION] Sale attempted for Appointment ${data.appointmentId} in Business ${data.adminId}. Correct Admin is ${appointment.adminId}.`);
                    throw new Error('Multi-tenancy violation: Appointment does not belong to this business context.');
                }
            }

            // Verify individual items (Services/Products)
            if (data.items && data.items.length > 0) {
                for (const item of data.items) {
                    if (item.type === 'service') {
                        const service = await prisma.service.findUnique({ where: { id: item.itemId }, select: { adminId: true } });
                        if (service && service.adminId && service.adminId !== data.adminId) {
                             throw new Error(`Multi-tenancy violation: Service ${item.name} belongs to a different business.`);
                        }
                    } else if (item.type === 'product') {
                        const product = await prisma.product.findUnique({ where: { id: item.itemId }, select: { adminId: true } });
                        if (product && product.adminId && product.adminId !== data.adminId) {
                             throw new Error(`Multi-tenancy violation: Product ${item.name} belongs to a different business.`);
                        }
                    }
                }
            }
        }

        // Prevent duplicate sales for the same appointment
        if (data.appointmentId) {
            const existingSale = await prisma.sale.findFirst({
                where: {
                    appointmentId: data.appointmentId,
                    saleStatus: { not: SaleStatus.CANCELLED }
                }
            });

            if (existingSale) {
                console.log(`⚠️ Sale already exists for Appointment ${data.appointmentId}. Adding payment.`);
                if (data.payments && data.payments.length > 0) {
                    for (const payment of data.payments) {
                        await this.addPaymentToSale(existingSale.id, {
                            amount: payment.amount,
                            paymentMethod: payment.paymentMethod,
                            transactionId: payment.transactionId,
                            razorpayOrderId: payment.razorpayOrderId,
                            razorpayPaymentId: payment.razorpayPaymentId,
                            razorpaySignature: payment.razorpaySignature,
                            adminId: data.adminId
                        });
                    }
                    return existingSale;
                }
                return existingSale;
            }
        }

        const totals = this.calculateTotals(data.items, data.discount, data.tax, data.voucherDiscount, data.vouchers);

        // Calculate paid amount from NEW payments
        let paidAmount = data.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

        // ✅ FIX: If the bill is $0 (full redemption), ensure no payment is recorded
        if (totals.totalAmount <= 0) {
            paidAmount = 0;
            if (data.payments) {
                data.payments = data.payments.map(p => ({ ...p, amount: 0 }));
            }
        }

        // Check for EXISTING payments on the appointment (e.g. Deposit)
        let existingPayments: any[] = [];
        if (data.appointmentId) {
            existingPayments = await prisma.payment.findMany({
                where: {
                    appointmentId: data.appointmentId,
                    paymentStatus: 'COMPLETED',
                    saleId: null
                }
            });
            const existingPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
            paidAmount += existingPaid;
        }

        const balanceAmount = totals.totalAmount - paidAmount;
        const paymentStatus = paymentService.calculatePaymentStatus(totals.totalAmount, paidAmount);

        // Retry logic for sale number collisions
        let retryCount = 0;
        const maxRetries = 3;
        let lastError;

        while (retryCount < maxRetries) {
            try {
                const saleNumber = await this.generateSaleNumber(data.adminId);
                const invoiceNumber = await paymentService.generateInvoiceNumber(data.adminId);


                let voucherRedemptions: any[] = [];

                // Create sale with payments in a transaction
                const result = await prisma.$transaction(async (tx) => {
                    // Create sale
                    const newSale = await tx.sale.create({
                        data: {
                            saleNumber,
                            // invoiceNumber, // Removed from schema

                            customerId: data.customerId,
                            appointmentId: data.appointmentId,
                            authId: data.authId,
                            adminId: data.adminId,
                            items: data.items as any,
                            subtotal: totals.subtotal,
                            discount: totals.discount,
                            tax: totals.tax,
                            totalAmount: totals.totalAmount,
                            paidAmount,
                            balanceAmount,
                            paymentStatus,
                            saleStatus: SaleStatus.COMPLETED,
                            notes: data.notes,
                            createdBy: data.createdBy,
                            attachments: data.attachments,
                            specialistId: data.specialistId,
                        },
                    });

                    // Link EXISTING payments to this sale
                    if (existingPayments.length > 0) {
                        await tx.payment.updateMany({
                            where: { id: { in: existingPayments.map(p => p.id) } },
                            data: {
                                saleId: newSale.id,
                                invoiceNumber: invoiceNumber // Update existing payments with invoice number

                            }
                        });
                    }

                    // Create NEW payment records
                    if (data.payments && data.payments.length > 0) {
                        for (const payment of data.payments) {
                            const { method, notes } = resolvePaymentMethod(payment.paymentMethod);

                            await tx.payment.create({
                                data: {
                                    amount: payment.amount,
                                    paymentMethod: method as any,
                                    // paymentMethod: this.mapPaymentMethod(payment.paymentMethod),
                                    paymentStatus: payment.paymentStatus || PaymentStatus.COMPLETED,
                                    sale: {
                                        connect: { id: newSale.id }
                                    },
                                    appointment: data.appointmentId ? {
                                        connect: { id: data.appointmentId }
                                    } : undefined,
                                    authId: data.authId,
                                    adminId: data.adminId,
                                    transactionId: payment.transactionId,
                                    razorpayOrderId: payment.razorpayOrderId,
                                    razorpayPaymentId: payment.razorpayPaymentId,
                                    razorpaySignature: payment.razorpaySignature,
                                    cashierName: data.cashierName,
                                    invoiceNumber: invoiceNumber, // Use the generated invoice number
                                    notes: notes ? (data.notes ? `${data.notes} | ${notes}` : notes) : undefined
                                },
                            });
                        }
                    }

                    // Handle Redemptions (Balance Deduction)
                    if (data.customerId && data.items && data.items.length > 0) {
                        const pkgModule = await import('./customer-package.service');
                        const customerPackageService = pkgModule.customerPackageService;

                        if (customerPackageService) {
                            for (const item of data.items) {
                                if ((item as any).redeemedFromPackageId) {
                                    const metadata = item as any;
                                    await customerPackageService.usePackageService(
                                        metadata.redeemedFromPackageId,
                                        metadata.redeemedItemId || item.itemId,
                                        metadata.redeemedQuantity || item.quantity || 1,
                                        tx
                                    );
                                }
                            }
                        }
                    }

                    // Auto-create Customer Packages for 'combo' items
                    if (data.customerId && data.items && data.items.length > 0) {
                        const { customerPackageService } = await import('./customer-package.service');
                        for (const item of data.items) {
                            if (item.type === 'combo') {
                                const packageId = Number(item.itemId);
                                if (!isNaN(packageId)) {
                                    await customerPackageService.purchasePackage({
                                        customerId: data.customerId!,
                                        packageId: packageId,
                                        authId: data.authId,
                                        adminId: data.adminId,
                                        tx
                                    });
                                }
                            }
                        }
                    }

                    // Handle Voucher Sales
                    if (data.customerId && data.items && data.items.length > 0) {
                        const { voucherService } = await import('./voucher.service');
                        for (const item of data.items) {
                            if (item.type === 'voucher') {
                                try {
                                    const quantity = item.quantity || 1;
                                    for (let i = 0; i < quantity; i++) {
                                        await voucherService.issueVoucher(
                                            item.itemId,
                                            data.customerId,
                                            data.customerName || 'Customer',
                                            data.authId,
                                            data.adminId,
                                            tx // Pass the transaction handle
                                        );
                                    }
                                } catch (error) {
                                    console.error('Voucher issuance failed during sale:', error);
                                    // We might want to decide if we fail the whole sale or just log it
                                    // For vouchers sold, it's safer to fail the transaction if issuance fails
                                    throw error;
                                }
                            }
                        }
                    }

                    if (data.appointmentId) {
                        await tx.appointment.update({
                            where: { id: data.appointmentId },
                            data: {
                                status: 'COMPLETED',  // Always complete the appointment
                                paymentStatus: paymentStatus,  // Track payment status separately
                                paidAmount: paidAmount
                            }
                        });
                    }

                    // Handle Voucher Redemption (Multiple Vouchers)
                    if (data.vouchers && Array.isArray(data.vouchers) && data.vouchers.length > 0 && data.customerId) {
                        const { voucherService } = await import('./voucher.service');
                        for (const v of data.vouchers) {
                            const result = await voucherService.redeemVoucher(
                                v.code,
                                data.customerId,
                                v.amount,
                                newSale.id,
                                newSale.saleNumber,
                                tx
                            );
                            if (result) {
                                voucherRedemptions.push(result);
                            }
                        }
                    }
                    // Handle Voucher Redemption (Legacy Single Voucher)
                    else if (data.voucherCode && data.customerId) {
                        const { voucherService } = await import('./voucher.service');
                        // Use voucherDiscount if provided, else fallback to total discount (legacy support)
                        const amountToRedeem = data.voucherDiscount !== undefined ? data.voucherDiscount : totals.discount;

                        const result = await voucherService.redeemVoucher(
                            data.voucherCode,
                            data.customerId,
                            amountToRedeem,
                            newSale.id,
                            newSale.saleNumber,
                            tx
                        );
                        // Make sure result is valid before pushing
                        if (result) {
                            voucherRedemptions.push(result);
                        }
                    }

                    // Handle Product Stock Reduction
                    if (data.items && data.items.length > 0) {
                        for (const item of data.items) {
                            if (item.type === 'product') {
                                try {
                                    await inventoryService.updateStock(
                                        item.itemId,
                                        item.quantity,
                                        'remove',
                                        `Sale created: ${saleNumber}`,
                                        data.authId,
                                        'ADJUSTMENT_REMOVE',
                                        data.adminId,
                                        tx
                                    );
                                } catch (error) {
                                    console.error(`Failed to reduce stock for product ${item.itemId}:`, error);
                                    // We continue despite stock errors to avoid failing the sale
                                }
                            }
                        }
                    }

                    return newSale;
                }, { timeout: 15000 });

                // Send WhatsApp payment reminder if there is a balance
                if (result.balanceAmount > 0 && result.customerId && result.adminId) {
                    this.sendWhatsAppPaymentReminder(result.id).catch(err =>
                        console.error('❌ WhatsApp Sale Reminder Error:', err)
                    );
                }

                // Fetch complete sale with payments and invoices
                const completeSale = await this.getSaleById(result.id);

                console.log('📦 Sale created:', completeSale.saleNumber);
                console.log('🎟️ Voucher Redemptions:', JSON.stringify(voucherRedemptions, null, 2));

                // Send WhatsApp sales receipt first, then voucher usage
                this.sendWhatsAppSalesNotification(completeSale.id)
                    .then(() => {
                        console.log('✅ Sales receipt sent (or promise resolved). Checking voucher redemptions...');
                        // Send WhatsApp voucher usage notifications ONLY after sales receipt is sent (or attempted)
                        if (voucherRedemptions.length > 0 && completeSale.customerId && completeSale.adminId) {
                            console.log('🚀 Triggering voucher usage notification...');
                            return this.sendWhatsAppVoucherUsage(completeSale, voucherRedemptions);
                        } else {
                            console.log('⚠️ No voucher usage notification to send. Redemptions:', voucherRedemptions.length);
                        }
                    })
                    .catch(err =>
                        console.error('❌ WhatsApp Notification Chain Error:', err)
                    );

                return { sale: completeSale, voucherRedemptions };

            } catch (error: any) {
                lastError = error;
                // Check for P2002 Unique constraint failed on saleNumber
                if (error.code === 'P2002' && error.meta?.target?.includes('saleNumber')) {
                    retryCount++;
                    console.warn(`🔄 Sale number collision detected, retrying... (${retryCount}/${maxRetries})`);
                    // Small delay to allow other transaction to potentially finish or just randomize timing
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                    continue;
                }
                throw error; // Re-throw if not a collision
            }
        }

        console.error('❌ Failed to create sale after max retries due to collisions');
        throw lastError || new Error('Failed to create sale due to repeated sale number collisions');
    }

    /**
     * Add payment to existing sale
     */
    async addPaymentToSale(
        saleId: string,
        paymentData: {
            amount: number;
            paymentMethod: any;
            transactionId?: string;
            razorpayOrderId?: string;
            razorpayPaymentId?: string;
            razorpaySignature?: string;
            notes?: string;
            adminId?: string;
            cashierName?: string;
        }
    ) {
        const sale = await prisma.sale.findUnique({ where: { id: saleId } });

        if (!sale) {
            throw new Error('Sale not found');
        }

        if (sale.saleStatus === SaleStatus.CANCELLED || sale.saleStatus === SaleStatus.REFUNDED) {
            throw new Error('Cannot add payment to cancelled or refunded sale');
        }

        // Create payment and update sale in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Get existing invoice number from previous payments if any
            const existingPayment = await tx.payment.findFirst({
                where: { saleId },
                select: { invoiceNumber: true }
            });

            // Create payment
            const { method, notes: methodNotes } = resolvePaymentMethod(paymentData.paymentMethod);
            const finalNotes = methodNotes
                ? (paymentData.notes ? `${paymentData.notes} | ${methodNotes}` : methodNotes)
                : paymentData.notes;

            const payment = await tx.payment.create({
                data: {
                    amount: paymentData.amount,
                    paymentMethod: method as any,
                    // paymentMethod: this.mapPaymentMethod(paymentData.paymentMethod),
                    paymentStatus: PaymentStatus.COMPLETED,
                    sale: { connect: { id: saleId } },
                    authId: sale.authId, // Inherit authId from sale
                    adminId: paymentData.adminId || sale.adminId, // Use provided adminId or fall back to sale's
                    transactionId: paymentData.transactionId,
                    razorpayOrderId: paymentData.razorpayOrderId,
                    razorpayPaymentId: paymentData.razorpayPaymentId,
                    razorpaySignature: paymentData.razorpaySignature,
                    notes: finalNotes,
                    cashierName: paymentData.cashierName,
                    invoiceNumber: await paymentService.generateInvoiceNumber(sale.adminId!), // Generate NEW invoice number for new payment
                },
            });

            // Update sale amounts
            const newPaidAmount = sale.paidAmount + paymentData.amount;
            const newBalanceAmount = sale.totalAmount - newPaidAmount;
            const newPaymentStatus = paymentService.calculatePaymentStatus(sale.totalAmount, newPaidAmount);

            const updatedSale = await tx.sale.update({
                where: { id: saleId },
                data: {
                    paidAmount: newPaidAmount,
                    balanceAmount: newBalanceAmount,
                    paymentStatus: newPaymentStatus,
                },
            });

            // ✅ Sync Appointment Status and Paid Amount
            // Always mark appointment as COMPLETED to support "Pay Later" workflow
            if (sale.appointmentId) {
                console.log(`📅 Updating linked Appointment ${sale.appointmentId}. Paid: ${newPaidAmount}, Status: ${newPaymentStatus}`);
                await tx.appointment.update({
                    where: { id: sale.appointmentId },
                    data: {
                        status: 'COMPLETED',  // ✅ Always complete the appointment
                        paymentStatus: newPaymentStatus,  // Track payment status separately
                        paidAmount: newPaidAmount
                    }
                });
            }

            return { payment, sale: updatedSale };
        });

        // Send WhatsApp payment reminder if balance remains
        if (result.sale.balanceAmount > 0 && result.sale.customerId && result.sale.adminId) {
            this.sendWhatsAppPaymentReminder(result.sale.id).catch(err =>
                console.error('❌ WhatsApp Payment Update Reminder Error:', err)
            );
        }

        return result;
    }

    /**
     * Get sale by ID with all details
     */
    async getSaleById(id: string) {
        const sale: any = await prisma.sale.findUnique({
            where: { id },
            include: {
                payments: {
                    orderBy: { createdAt: 'desc' },
                },

                appointment: {
                    include: {
                        service: true,
                        stylist: true
                    }
                }

            },
        });

        if (sale) {
            // Manually populate customer if missing in schema relation
            if (sale.customerId && !sale.customer) {
                sale.customer = await prisma.customer.findUnique({
                    where: { id: sale.customerId }
                });
            }

            // Normalize attachments
            sale.attachments = normalizeAttachments(sale.attachments);
        }

        return sale;
    }

    /**
     * List sales with filters
     */
    async listSales(filters: {
        status?: SaleStatus;
        paymentStatus?: PaymentStatus;
        customerId?: string;
        from?: Date;
        to?: Date;
        page?: number;
        limit?: number;
        authId?: string;
        adminId?: string;
    }) {
        const { status, paymentStatus, customerId, from, to, page = 1, limit = 50, authId, adminId } = filters;

        const where: Prisma.SaleWhereInput = {};

        // Multi-tenancy filtering
        if (adminId) {
            where.adminId = adminId;
        } else if (authId) {
            where.authId = authId;
        }

        if (status) where.saleStatus = status;
        if (paymentStatus) where.paymentStatus = paymentStatus;
        if (customerId) where.customerId = customerId;
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = from;
            if (to) where.createdAt.lte = to;
        }

        const [sales, total] = await Promise.all([
            prisma.sale.findMany({
                where,
                include: {
                    payments: true,
                    appointment: {
                        include: {
                            service: true
                        }
                    }

                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.sale.count({ where }),
        ]);

        // Fix N+1 by batch fetching customers
        const missingCustomerIds = [...new Set(sales
            .filter((s: any) => s.customerId && !s.customer)
            .map((s: any) => s.customerId))] as string[];

        const customerMap = new Map();
        if (missingCustomerIds.length > 0) {
            const customers = await prisma.customer.findMany({
                where: { id: { in: missingCustomerIds } }
            });
            customers.forEach(c => customerMap.set(c.id, c));
        }

        const enrichedSales = sales.map((sale: any) => {
            sale.attachments = normalizeAttachments(sale.attachments);
            if (sale.customerId && !sale.customer) {
                sale.customer = customerMap.get(sale.customerId) || null;
            }
            return sale;
        });

        const totalRevenue = await prisma.sale.aggregate({
            where,
            _sum: { totalAmount: true },
        });

        return {
            sales: enrichedSales,
            total,
            totalRevenue: totalRevenue._sum.totalAmount || 0,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Cancel a sale
     */
    async cancelSale(saleId: string, reason?: string) {
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { payments: true }
        });

        if (!sale) throw new Error('Sale not found');
        if (sale.saleStatus === SaleStatus.CANCELLED) throw new Error('Sale already cancelled');

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Sale Status
            const updatedSale = await tx.sale.update({
                where: { id: saleId },
                data: {
                    saleStatus: SaleStatus.CANCELLED,
                    notes: sale.notes
                        ? `${sale.notes}\n[CANCELLED]: ${reason || 'No reason provided'}`
                        : `[CANCELLED]: ${reason || 'No reason provided'}`,
                },
            });

            // 2. Restore Product Stock (Conditional on Settings)
            if (sale.adminId) {
                const settings = await tx.settings.findUnique({ where: { adminId: sale.adminId } });
                if (settings?.enableInventoryAdjustment !== false && sale.items && Array.isArray(sale.items)) {
                    for (const item of (sale.items as any)) {
                        if (item.type === 'product') {
                            try {
                                await inventoryService.updateStock(
                                    item.itemId,
                                    item.quantity,
                                    'add',
                                    `Sale cancelled: ${sale.saleNumber}`,
                                    sale.authId,
                                    'RECEIVED',
                                    sale.adminId,
                                    tx
                                );
                            } catch (error) {
                                console.error(`Failed to restore stock for ${item.itemId}:`, error);
                            }
                        }
                    }
                }
            }

            // 3. Revert Customer Package Redemptions
            if (sale.items && Array.isArray(sale.items)) {
                const { customerPackageService } = await import('./customer-package.service');
                for (const item of (sale.items as any)) {
                    if (item.redeemedFromPackageId) {
                        try {
                            await customerPackageService.revertPackageUsage(
                                item.redeemedFromPackageId,
                                item.redeemedItemId || item.itemId,
                                item.redeemedQuantity || item.quantity || 1,
                                tx
                            );
                        } catch (error) {
                            console.error('Failed to revert package usage:', error);
                        }
                    }
                }
            }

            // 4. Revert Voucher Redemptions
            const { voucherService } = await import('./voucher.service');
            try {
                await voucherService.revertRedemption(saleId, tx);
            } catch (error) {
                console.error('Failed to revert voucher redemption:', error);
            }

            // 5. Update Linked Payments to REFUNDED
            if (sale.payments && sale.payments.length > 0) {
                await tx.payment.updateMany({
                    where: { saleId: saleId },
                    data: { paymentStatus: PaymentStatus.REFUNDED }
                });
            }

            // 6. Reset Appointment Status (if sale was linked)
            if (sale.appointmentId) {
                await tx.appointment.update({
                    where: { id: sale.appointmentId },
                    data: {
                        status: 'CONFIRMED', // Set back to confirmed so they can re-bill
                        paymentStatus: PaymentStatus.PENDING,
                        paidAmount: 0 // Assume cancellation resets the bill state
                    }
                });
            }

            // 7. Cancel Purchased Packages (if any 'combo' items were in the sale)
            if (sale.customerId && sale.items && Array.isArray(sale.items)) {
                const { customerPackageService } = await import('./customer-package.service');
                for (const item of (sale.items as any)) {
                    if (item.type === 'combo') {
                        const packageId = Number(item.itemId);
                        if (!isNaN(packageId)) {
                            // Heuristic: Find package created for this customer/admin around the sale time
                            // We use a 5-minute window around the sale creation to be safe
                            const saleTime = new Date(sale.createdAt);
                            const startTime = new Date(saleTime.getTime() - 300000); // -5 mins
                            const endTime = new Date(saleTime.getTime() + 300000);   // +5 mins

                            const purchasedPackages = await tx.customerPackage.findMany({
                                where: {
                                    customerId: sale.customerId,
                                    packageId: packageId,
                                    adminId: sale.adminId,
                                    createdAt: {
                                        gte: startTime,
                                        lte: endTime
                                    },
                                    status: 'ACTIVE' // Only cancel if still active
                                }
                            });

                            for (const pkg of purchasedPackages) {
                                await customerPackageService.cancelPackage(pkg.id, tx);
                                console.log(`🚫 Cancelled purchased package ${pkg.id} linked to cancelled sale ${sale.saleNumber}`);
                            }
                        }
                    }
                }
            }

            return updatedSale;
        });

        return result;
    }

    /**
     * Get sales analytics
     */
    async getSalesAnalytics(from: Date, to: Date, authId: string, adminId?: string) {
        const whereClause: any = {
            createdAt: {
                gte: from,
                lte: to,
            },
            saleStatus: {
                not: SaleStatus.CANCELLED
            }
        };

        // Multi-tenancy filtering
        if (adminId) {
            whereClause.adminId = adminId;
        } else {
            whereClause.authId = authId;
        }

        const sales = await prisma.sale.findMany({
            where: whereClause,
            include: {
                payments: true,
            },
        });

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalPaid = sales.reduce((sum, sale) => sum + sale.paidAmount, 0);
        const totalOutstanding = sales.reduce((sum, sale) => sum + sale.balanceAmount, 0);

        // Payment method breakdown
        const paymentMethodBreakdown: Record<string, number> = {};
        sales.forEach(sale => {
            sale.payments.forEach(payment => {
                const method = payment.paymentMethod;
                paymentMethodBreakdown[method] = (paymentMethodBreakdown[method] || 0) + payment.amount;
            });
        });

        return {
            totalSales,
            totalRevenue,
            totalPaid,
            totalOutstanding,
            averageSaleValue: totalSales > 0 ? totalRevenue / totalSales : 0,
            paymentMethodBreakdown,
        };
    }

    /**
     * Get per-specialist service attendance stats
     * Reads the optional per-item specialistId/specialistName from each sale's items JSON.
     * Falls back to the sale-level specialistId if the item has no individual specialist.
     * This is a READ-ONLY analytics method — no data is modified.
     */
    async getSpecialistServiceStats(adminId: string, from?: Date, to?: Date, specialistId?: string) {
        const whereClause: any = {
            adminId,
            saleStatus: { not: SaleStatus.CANCELLED }
        };

        if (from || to) {
            whereClause.createdAt = {};
            if (from) whereClause.createdAt.gte = from;
            if (to) whereClause.createdAt.lte = to;
        }

        const sales = await prisma.sale.findMany({
            where: whereClause,
            select: {
                id: true,
                saleNumber: true,
                createdAt: true,
                specialistId: true,        // sale-level fallback
                specialist: {
                    select: { id: true, name: true }
                },
                items: true
            }
        });

        // Map: specialistKey -> { id, name, services: Map<serviceName, {count, totalRevenue}> }
        const specialistMap = new Map<string, {
            specialistId: string;
            specialistName: string;
            totalServicesAttended: number;
            totalRevenue: number;
            services: Map<string, { count: number; revenue: number }>;
        }>();

        for (const sale of sales) {
            const items = (sale.items as any[]) || [];

            for (const item of items) {
                // Per-item specialist takes priority, then fall back to sale-level specialist
                const itemSpecialistId: string | null =
                    item.specialistId?.toString() || sale.specialistId || null;
                const itemSpecialistName: string =
                    item.specialistName || sale.specialist?.name || 'Unassigned';

                if (!itemSpecialistId) continue; // skip items with no specialist at all

                // If filtering by a specific specialist
                if (specialistId && itemSpecialistId !== specialistId) continue;

                // Only count services and products (not vouchers/packages)
                if (item.type !== 'service' && item.type !== 'product') continue;

                const key = itemSpecialistId;
                if (!specialistMap.has(key)) {
                    specialistMap.set(key, {
                        specialistId: itemSpecialistId,
                        specialistName: itemSpecialistName,
                        totalServicesAttended: 0,
                        totalRevenue: 0,
                        services: new Map()
                    });
                }

                const entry = specialistMap.get(key)!;
                const qty = item.quantity || 1;
                const revenue = (item.price || 0) * qty - (item.discount || 0);

                entry.totalServicesAttended += qty;
                entry.totalRevenue += revenue;

                // Track per-service breakdown
                const serviceName = item.name || 'Unknown';
                if (!entry.services.has(serviceName)) {
                    entry.services.set(serviceName, { count: 0, revenue: 0 });
                }
                const svc = entry.services.get(serviceName)!;
                svc.count += qty;
                svc.revenue += revenue;
            }
        }

        // Convert Maps to plain arrays for JSON response
        const specialists = Array.from(specialistMap.values()).map(s => ({
            specialistId: s.specialistId,
            specialistName: s.specialistName,
            totalServicesAttended: s.totalServicesAttended,
            totalRevenue: s.totalRevenue,
            breakdown: Array.from(s.services.entries()).map(([name, data]) => ({
                serviceName: name,
                count: data.count,
                revenue: data.revenue
            })).sort((a, b) => b.count - a.count)
        })).sort((a, b) => b.totalServicesAttended - a.totalServicesAttended);

        return {
            from: from?.toISOString() || null,
            to: to?.toISOString() || null,
            totalSpecialistsFound: specialists.length,
            specialists
        };
    }

    /**
     * Send WhatsApp payment reminder for a sale
     */
    private async sendWhatsAppPaymentReminder(saleId: string) {
        try {
            const sale = await prisma.sale.findUnique({
                where: { id: saleId }
            });

            if (!sale || !sale.customerId || !sale.adminId) return;

            // Fetch customer manually to avoid Prisma relation issues if not generated
            const customer = await prisma.customer.findUnique({
                where: { id: sale.customerId }
            });

            if (!customer) return;

            // Get settings for currency
            const settings = await settingsService.getOrCreateSettings(sale.adminId);
            const currency = settings.currency || 'S$';

            // Format date
            const formattedDate = new Date(sale.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Send message
            const sent = await whatsappService.sendPaymentReminder({
                adminId: sale.adminId,
                customerPhone: customer.phone || '', // Use phone from customer record
                customerName: customer.name,
                amount: sale.balanceAmount,
                currency: currency,
                date: formattedDate
            });

            if (sent) {
                console.log(`✅ WhatsApp payment reminder sent to ${customer.name} for Sale ${sale.saleNumber}`);
            }
        } catch (error) {
            console.error('❌ Error in sendWhatsAppPaymentReminder:', error);
        }
    }

    /**
     * Send comprehensive WhatsApp sales notification (Sale / Package / Both)
     */
    /**
     * Send WhatsApp voucher usage notifications
     */
    private async sendWhatsAppVoucherUsage(sale: any, redemptions: any[]) {
        try {
            if (!sale.customer || !redemptions || redemptions.length === 0) return;

            // Get settings for currency
            const settings = await settingsService.getOrCreateSettings(sale.adminId);
            const currency = settings.currency || 'S$';

            for (const redemption of redemptions) {
                // redemption object structure from voucherService.redeemVoucher:
                // { claim, voucher, redeemedAmount }

                await whatsappService.sendVoucherUsageNotification({
                    adminId: sale.adminId,
                    customerPhone: sale.customer.phone || '',
                    customerName: sale.customer.name,
                    voucherName: redemption.voucher.name,
                    saleNumber: sale.saleNumber,
                    redeemedAmount: redemption.redeemedAmount,
                    remainingBalance: redemption.claim.balance, // This is the NEW balance after redemption
                    currency: currency
                });

                console.log(`✅ WhatsApp voucher usage sent for ${redemption.voucher.name}`);
            }
        } catch (error) {
            console.error('❌ Error in sendWhatsAppVoucherUsage:', error);
        }
    }

    /**
     * Send comprehensive WhatsApp sales notification (Sale / Package / Both)
     */
    private async sendWhatsAppSalesNotification(saleId: string) {
        try {
            const sale = await this.getSaleById(saleId);
            if (!sale || !sale.customerId || !sale.adminId) return;

            const customer = sale.customer;
            if (!customer || !customer.phone) return;

            const settings = await settingsService.getOrCreateSettings(sale.adminId);
            const currency = settings.currency || 'S$';
            const formattedDate = new Date(sale.createdAt).toLocaleDateString();

            // Prepare items summary
            const items = sale.items as any[];
            const itemsSummary = items.map(i => `${i.name} x${i.quantity}`).join(', ');

            // Check if any item is a package purchase or redemption
            const hasPackageItem = items.some(i => i.type === 'combo' || i.redeemedFromPackageId);
            const hasRegularItem = items.some(i => i.type !== 'combo' && !i.redeemedFromPackageId);

            let sent = false;

            // Fetch actual package balance grouped by service
            let packageBalanceStr = '0';
            try {
                const { customerPackageService } = await import('./customer-package.service');
                const activePackages = await customerPackageService.getActivePackages(sale.customerId);

                const balanceMap: Record<string, number> = {};
                activePackages.forEach(pkg => {
                    const usageDetails = pkg.usageDetails as any[];
                    if (Array.isArray(usageDetails)) {
                        usageDetails.forEach(item => {
                            if (item.remainingQuantity > 0) {
                                balanceMap[item.name] = (balanceMap[item.name] || 0) + item.remainingQuantity;
                            }
                        });
                    }
                });

                if (Object.keys(balanceMap).length > 0) {
                    packageBalanceStr = Object.entries(balanceMap)
                        .map(([name, count]) => `${name}: ${count}`)
                        .join(', ');
                }
            } catch (err) {
                console.error('⚠️ Could not fetch real package balance:', err);
            }

            if (hasPackageItem && hasRegularItem) {
                // Combined Receipt
                sent = await whatsappService.sendSalesAndPackageReceipt({
                    adminId: sale.adminId,
                    customerPhone: customer.phone,
                    customerName: customer.name,
                    saleNumber: sale.saleNumber,
                    totalAmount: sale.totalAmount,
                    currency,
                    date: formattedDate,
                    itemsSummary,
                    packageBalance: packageBalanceStr
                });
            } else if (hasPackageItem && !hasRegularItem) {
                // Package Only Receipt (Purchased or Used)
                sent = await whatsappService.sendSalesReceipt({
                    adminId: sale.adminId,
                    customerPhone: customer.phone,
                    customerName: customer.name,
                    saleNumber: sale.saleNumber,
                    totalAmount: sale.totalAmount,
                    currency,
                    date: formattedDate,
                    itemsSummary,
                    packageBalance: packageBalanceStr
                });
            } else {
                // Regular Sales Receipt
                sent = await whatsappService.sendSalesReceipt({
                    adminId: sale.adminId,
                    customerPhone: customer.phone,
                    customerName: customer.name,
                    saleNumber: sale.saleNumber,
                    totalAmount: sale.totalAmount,
                    currency,
                    date: formattedDate,
                    itemsSummary,
                    packageBalance: packageBalanceStr
                });
            }

            if (sent) {
                console.log(`✅ WhatsApp sales notification sent to ${customer.name} for Sale ${sale.saleNumber}`);
            }
        } catch (error) {
            console.error('❌ Error in sendWhatsAppSalesNotification:', error);
        }
    }
}

export default new SaleService();
