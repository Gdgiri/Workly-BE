import prisma from '../prisma';
import { PaymentStatus, PaymentType, SaleStatus } from '@prisma/client';
import razorpayService from './razorpay.service';
import * as fs from 'fs';


interface CreatePaymentData {
    amount: number;
    paymentMethod: string;
    paymentType?: PaymentType; // ADVANCE (20%), REMAINING (80%), or FULL (100%)
    appointmentId?: string;
    saleId?: string;
    authId?: string;
    notes?: string;
    transactionId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    adminId?: string;
    cashierName?: string;
    invoiceNumber?: string;
}

// Database-safe Payment Methods (Must match Prisma Enum)
export const DB_PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'WALLET', 'RAZORPAY', 'BANK_TRANSFER', 'PACKAGE', 'GPAY', 'PHONEPE', 'PAYTM', 'ONLINEPAY', 'GRAB', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'TRANSACTIONPAY'];

/**
 * Normalizes payment method string to match Prisma Enum
 */
export const normalizePaymentMethod = (method: any): string => {
    if (!method) return 'CASH';
    if (typeof method !== 'string') return String(method);

    const upper = method.toUpperCase().trim();

    // Keep legacy shorthand mappings for very common ones if they match exactly
    if (upper === 'GOOGLE PAY' || upper === 'GOOGLEPAY' || upper === 'GPAY') return 'GPAY';
    if (upper === 'PHONE PE' || upper === 'PHONEPE') return 'PHONEPE';
    if (upper === 'PAYTM') return 'PAYTM';
    if (upper === 'UPI') return 'UPI';
    if (upper === 'CASH') return 'CASH';

    // For everything else, including "Amazon Pay", "Net Banking", "Debit Card", etc.,
    // we preserve the distinct name but standardize formatting for report consistency.
    return upper.replace(/\s+/g, '_');
};

/**
 * Resolves input to a database-safe method name
 */
export const resolvePaymentMethod = (input: any): { method: string; notes?: string } => {
    const normalized = normalizePaymentMethod(input);
    return { method: normalized };
};


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
    return attachments;
};

class PaymentService {
    async generateInvoiceNumber(adminId?: string): Promise<string> {
        let prefix = 'INV-';
        let startNumber = 1;
        let invoicePrefixSetting = '';

        if (adminId) {
            try {
                const settings = await prisma.settings.findUnique({ where: { adminId } });
                if (settings) {
                    if (settings.invoiceStartNumber) {
                        invoicePrefixSetting = settings.invoiceStartNumber;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Failed to fetch invoice settings:', e);
            }
        }

        const now = new Date();
        const yearSuffix = String(now.getUTCFullYear()).slice(-2);
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const dateStr = `-${yearSuffix}${month}`; // Format: YYMM

        const effectivePrefix = invoicePrefixSetting || prefix;
        const pattern = `${effectivePrefix}${dateStr}-`;

        const lastPayment = await prisma.payment.findFirst({
            where: {
                adminId,
                invoiceNumber: {
                    startsWith: pattern
                }
            },
            orderBy: {
                invoiceNumber: 'desc'
            },
            select: {
                invoiceNumber: true
            }
        });

        let nextNumber = startNumber;

        if (lastPayment && lastPayment.invoiceNumber) {
            const parts = lastPayment.invoiceNumber.split('-');
            const lastNumStr = parts[parts.length - 1];
            const lastNum = parseInt(lastNumStr, 10);
            if (!isNaN(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }

        return `${pattern}${String(nextNumber).padStart(3, '0')}`;
    }

    /**
     * Create a new payment record
     */
    async createPayment(data: CreatePaymentData) {
        const { method, notes: methodNotes } = resolvePaymentMethod(data.paymentMethod);
        const finalNotes = methodNotes
            ? (data.notes ? `${data.notes} | ${methodNotes}` : methodNotes)
            : data.notes;

        const payment = await prisma.payment.create({
            data: {
                amount: data.amount,
                paymentMethod: method as any,
                paymentStatus: PaymentStatus.COMPLETED,
                paymentType: data.paymentType || PaymentType.FULL,
                appointmentId: data.appointmentId,
                saleId: data.saleId,
                authId: data.authId,
                adminId: data.adminId, // Save adminId for multi-tenancy
                notes: finalNotes,
                transactionId: data.transactionId,
                razorpayOrderId: data.razorpayOrderId,
                razorpayPaymentId: data.razorpayPaymentId,
                razorpaySignature: data.razorpaySignature,
                cashierName: data.cashierName,
                invoiceNumber: data.invoiceNumber,
            },
            include: {
                appointment: true,
                sale: true,
            },
        });


        return payment;
    }

    /**
     * Get all payments for an appointment
     */
    async getAppointmentPayments(appointmentId: string) {
        const payments = await prisma.payment.findMany({
            where: { appointmentId },
            orderBy: { createdAt: 'desc' },
        });

        const totalPaid = payments.reduce((sum, payment) => {
            if (payment.paymentStatus === PaymentStatus.COMPLETED) {
                return sum + payment.amount;
            }
            return sum;
        }, 0);

        return { payments, totalPaid };
    }

    /**
     * Get all payments for a sale
     */
    async getSalePayments(saleId: string) {
        const payments = await prisma.payment.findMany({
            where: { saleId },
            orderBy: { createdAt: 'desc' },
        });

        const totalPaid = payments.reduce((sum, payment) => {
            if (payment.paymentStatus === PaymentStatus.COMPLETED) {
                return sum + payment.amount;
            }
            return sum;
        }, 0);

        return { payments, totalPaid };
    }

    /**
     * Create Razorpay order for payment
     */
    async createRazorpayOrder(amount: number, notes?: Record<string, any>, adminId?: string) {
        console.log('🔵 createRazorpayOrder called with:', { amount, adminId, hasNotes: !!notes });

        // Fetch admin's Razorpay credentials
        let keyId: string | undefined;
        let keySecret: string | undefined;

        try {
            const settingsModule = await import('./settings.service');
            const settingsService = (settingsModule as any).settingsService || (settingsModule as any).default || settingsModule;

            if (adminId) {
                const creds = await settingsService.getRazorpayCredentials(adminId);
                keyId = creds.keyId;
                keySecret = creds.keySecret;
            } else {
                keyId = process.env.RAZORPAY_KEY_ID;
                keySecret = process.env.RAZORPAY_KEY_SECRET;
            }

            console.log('🔑 Credentials check:', {
                hasKeyId: !!keyId,
                hasKeySecret: !!keySecret,
                keyIdLength: keyId?.length,
                keySecretLength: keySecret?.length
            });

        } catch (error) {
            console.warn('⚠️ Failed to fetch Razorpay credentials from DB, falling back to ENV:', error);
            keyId = process.env.RAZORPAY_KEY_ID;
            keySecret = process.env.RAZORPAY_KEY_SECRET;
        }

        console.log('📞 Calling razorpayService.createOrder...');
        const result = await razorpayService.createOrder({
            amount,
            notes,
        }, keyId, keySecret);

        console.log('📥 razorpayService.createOrder result:', { success: result.success, hasOrder: !!result.order });

        if (!result.success) {
            console.error('❌ Order creation failed:', result.error);
            throw new Error(result.error || 'Failed to create Razorpay order');
        }

        console.log('✅ Order created successfully');
        console.log('📋 Full order object:', JSON.stringify(result.order, null, 2));
        console.log('💵 Order amount (paise):', result.order?.amount);
        console.log('🆔 Order ID:', result.order?.id);

        const response = {
            ...result.order,
            keyId: keyId || process.env.RAZORPAY_KEY_ID
        };

        console.log('📤 Returning to frontend:', JSON.stringify(response, null, 2));
        return response;
    }

    /**
     * Verify Razorpay payment and create payment record
     */
    async verifyAndCreateRazorpayPayment(data: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
        amount: number;
        paymentType?: PaymentType;
        appointmentId?: string;
        saleId?: string;
        notes?: string;
        adminId?: string; // Admin ID for multi-tenancy
        cashierName?: string;
    }) {
        // Fetch admin's Razorpay credentials if adminId provided
        // Fetch admin's Razorpay credentials
        let keySecret: string | undefined;
        try {
            const { settingsService } = await import('./settings.service');
            // Use adminId if provided, otherwise fallback to first (but adminId is usually provided now)
            const settings = data.adminId
                ? await settingsService.getOrCreateSettings(data.adminId)
                : await settingsService.getFirstSettings();

            // Try to find credentials in activePaymentMethods first (New Generic Way)
            if (settings.activePaymentMethods) {
                console.log('🔍 [DEBUG] Raw activePaymentMethods:', typeof settings.activePaymentMethods, settings.activePaymentMethods);

                // Parse if string (handling double stringification)
                let methods = settings.activePaymentMethods;
                if (typeof methods === 'string') {
                    try {
                        methods = JSON.parse(methods);
                        console.log('🔍 [DEBUG] Parsed activePaymentMethods (1st pass):', methods);
                        if (typeof methods === 'string') {
                            methods = JSON.parse(methods);
                            console.log('🔍 [DEBUG] Parsed activePaymentMethods (2nd pass):', methods);
                        }
                    } catch (e) {
                        console.error('Failed to parse activePaymentMethods JSON', e);
                        methods = [];
                    }
                }

                if (Array.isArray(methods)) {
                    console.log('🔍 [DEBUG] Searching for Razorpay in methods:', methods.map((m: any) => m.id));
                    const razorpayMethod = (methods as any[]).find(m =>
                        m.id === 'razorpay' ||
                        m.name.toLowerCase() === 'razorpay' ||
                        m.name.toLowerCase() === 'razor'
                    );

                    if (razorpayMethod) {
                        console.log('🔍 [DEBUG] Found Razorpay method:', { id: razorpayMethod.id, hasSecret: !!razorpayMethod.secretKey });
                    }

                    if (razorpayMethod && razorpayMethod.secretKey) {
                        keySecret = razorpayMethod.secretKey;
                        console.log('✅ Found Razorpay secret in activePaymentMethods for admin:', data.adminId);
                    }
                } else {
                    console.log('⚠️ [DEBUG] activePaymentMethods is not an array after parsing:', methods);
                }
            } else {
                console.log('⚠️ [DEBUG] No activePaymentMethods found in settings for admin:', data.adminId);
            }

            // Fallback to legacy columns or env var
            if (!keySecret) {
                keySecret = settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;
            }

            console.log(`✅ Fetched credentials for verification. KeySecret present: ${!!keySecret}`);
        } catch (error) {
            console.error('❌ Failed to fetch Razorpay credentials for verification:', error);
            keySecret = process.env.RAZORPAY_KEY_SECRET;
        }

        console.log(`🔐 Verifying signature with ${keySecret ? 'dynamic' : 'env'} credentials`);

        // Verify signature with dynamic or env credentials
        const isValid = razorpayService.verifyPaymentSignature({
            razorpayOrderId: data.razorpayOrderId,
            razorpayPaymentId: data.razorpayPaymentId,
            razorpaySignature: data.razorpaySignature,
        }, keySecret);

        console.log(`🔍 Signature verification result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);

        if (!isValid) {
            throw new Error('Invalid Razorpay payment signature');
        }

        // Generate a unique transaction ID
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(data.adminId);

        // Create payment record
        const payment = await this.createPayment({
            amount: data.amount,
            paymentMethod: 'RAZORPAY' as any,
            paymentType: data.paymentType || PaymentType.FULL,
            appointmentId: data.appointmentId,
            saleId: data.saleId,
            authId: undefined, // Don't misuse authId for adminId anymore
            adminId: data.adminId, // Correctly save adminId
            notes: data.notes,
            transactionId: transactionId,
            razorpayOrderId: data.razorpayOrderId,
            razorpayPaymentId: data.razorpayPaymentId,
            razorpaySignature: data.razorpaySignature,
            cashierName: data.cashierName,
            invoiceNumber: invoiceNumber, // Save the generated invoice number
        });

        // Update sale's paidAmount and paymentStatus if saleId is provided
        if (data.saleId) {
            try {
                const sale = await prisma.sale.findUnique({
                    where: { id: data.saleId }
                });

                if (sale) {
                    const newPaidAmount = sale.paidAmount + data.amount;
                    const balanceAmount = sale.totalAmount - newPaidAmount;

                    // Determine payment status (handle potential floating point issues)
                    let paymentStatus: PaymentStatus;
                    const epsilon = 0.01;

                    if (newPaidAmount >= sale.totalAmount - epsilon) {
                        paymentStatus = PaymentStatus.COMPLETED;
                    } else if (newPaidAmount > epsilon) {
                        paymentStatus = PaymentStatus.PARTIAL;
                    } else {
                        paymentStatus = PaymentStatus.PENDING;
                    }

                    await prisma.sale.update({
                        where: { id: data.saleId },
                        data: {
                            paidAmount: newPaidAmount,
                            balanceAmount: balanceAmount,
                            paymentStatus: paymentStatus,
                            // Ensure sale status is COMPLETED if fully paid
                            saleStatus: paymentStatus === PaymentStatus.COMPLETED ? SaleStatus.COMPLETED : sale.saleStatus
                        }
                    });

                    console.log(`✅ Updated sale ${data.saleId}: paidAmount=${newPaidAmount}, paymentStatus=${paymentStatus}`);
                }
            } catch (error) {
                console.error('⚠️ Failed to update sale payment status:', error);
                // Rethrow so the controller knows something went wrong, 
                // but strictly speaking the payment WAS recorded. 
                // Decide whether to fail the whole request or just warn.
                throw new Error('Payment recorded but failed to update sale status: ' + (error as Error).message);
            }
        }

        // Update appointment's paidAmount and paymentStatus if appointmentId is provided
        if (data.appointmentId) {
            try {
                const appointment = await prisma.appointment.findUnique({
                    where: { id: data.appointmentId }
                });

                if (appointment) {
                    const newPaidAmount = (appointment.paidAmount || 0) + data.amount;

                    // Determine payment status
                    let paymentStatus = appointment.paymentStatus;
                    const epsilon = 0.01;

                    // If paid amount covers the total (or close enough), marks as COMPLETED
                    if (newPaidAmount >= (appointment.totalAmount || 0) - epsilon && (appointment.totalAmount || 0) > 0) {
                        paymentStatus = 'COMPLETED';
                    }
                    // If some amount paid, mark as PARTIAL (Deposit Paid)
                    else if (newPaidAmount > epsilon) {
                        paymentStatus = 'PARTIAL';
                    }

                    await prisma.appointment.update({
                        where: { id: data.appointmentId },
                        data: {
                            paidAmount: newPaidAmount,
                            paymentStatus: paymentStatus
                        }
                    });
                    console.log(`✅ Updated appointment ${data.appointmentId}: paidAmount=${newPaidAmount}, paymentStatus=${paymentStatus}`);
                }
            } catch (error) {
                console.error('⚠️ Failed to update appointment payment status:', error);
                // Log error but generally don't block the success of payment recording if possible, 
                // though strictly we might want consistency.
                console.error('Payment recorded but failed to update appointment status: ' + (error as Error).message);
            }
        }

        // Handle Package Assignment
        if (data.notes && (data.notes as any).packageId && (data.notes as any).customerId) {
            try {
                const packageId = parseInt((data.notes as any).packageId);
                const customerId = (data.notes as any).customerId;
                console.log(`🎁 Assigning package ${packageId} to customer ${customerId}...`);

                const { customerPackageService } = await import('./customer-package.service');
                await customerPackageService.purchasePackage({
                    customerId,
                    packageId,
                    authId: data.adminId, // For consistency, though it's technically the adminId here
                    adminId: data.adminId
                });
                console.log('✅ Package assigned successfully');

            } catch (error) {
                console.error('❌ Failed to assign package after payment:', error);
                // We don't throw here to avoid rolling back the payment, but we should log/alert
            }
        }

        return payment;
    }

    /**
     * Process refund for a payment
     */
    async refundPayment(paymentId: string, amount?: number) {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.paymentStatus === PaymentStatus.REFUNDED) {
            throw new Error('Payment already refunded');
        }

        // If Razorpay payment, process refund through Razorpay
        if (payment.paymentMethod === 'RAZORPAY' && payment.razorpayPaymentId) {
            const refundResult = await razorpayService.refundPayment(
                payment.razorpayPaymentId,
                amount
            );

            if (!refundResult.success) {
                throw new Error(refundResult.error || 'Failed to process refund');
            }
        }

        // Update payment status
        const updatedPayment = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                paymentStatus: PaymentStatus.REFUNDED,
                notes: payment.notes
                    ? `${payment.notes}\nRefunded: ${amount || payment.amount} on ${new Date().toISOString()}`
                    : `Refunded: ${amount || payment.amount} on ${new Date().toISOString()}`,
            },
        });

        return updatedPayment;
    }
    /**
     * Get all payments with optional filtering and pagination
     */
    async getPayments(params: {
        page?: number;
        limit?: number;
        startDate?: string;
        endDate?: string;
        paymentMethod?: string;
        status?: string;
        paymentType?: string;
        authId?: string;
        adminId?: string;
        minAmount?: number;
        maxAmount?: number;
        customerSearch?: string;
        specialist?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;

        const where: any = {};

        // Auth Restriction
        if (params.authId) {
            where.authId = params.authId;
        }

        // Admin ID Restriction
        if (params.adminId) {
            where.adminId = params.adminId;
        }

        let customerIds: string[] = [];
        if (params.customerSearch) {
            const matchingCustomers = await prisma.customer.findMany({
                where: {
                    OR: [
                        { name: { contains: params.customerSearch } },
                        { phone: { contains: params.customerSearch } }
                    ]
                },
                select: { id: true }
            });

            customerIds = matchingCustomers.map(c => c.id);

            if (customerIds.length > 0) {
                // Match invoice or transaction ID directly
                where.OR = [
                    { invoiceNumber: { contains: params.customerSearch } },
                    { transactionId: { contains: params.customerSearch } },
                    { sale: { saleNumber: { contains: params.customerSearch } } }
                ];

                // Also match customers if any found
                if (customerIds.length > 0) {
                    where.OR.push(
                        { appointment: { userId: { in: customerIds } } },
                        { sale: { customerId: { in: customerIds } } }
                    );
                }
            } else {
                // No matching customers found, but we still search for invoice/sale numbers
                where.OR = [
                    { invoiceNumber: { contains: params.customerSearch } },
                    { transactionId: { contains: params.customerSearch } },
                    { sale: { saleNumber: { contains: params.customerSearch } } }
                ];
            }
        }


        // Specialist Filter
        if (params.specialist && params.specialist !== 'ALL') {
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { appointment: { stylist: { name: params.specialist } } },
                        { sale: { specialist: { name: params.specialist } } }
                    ]
                }
            ];
        }

        // Date Range Filter
        if (params.startDate || params.endDate) {
            where.createdAt = {};
            if (params.startDate) {
                where.createdAt.gte = new Date(params.startDate);
            }
            if (params.endDate) {
                // Ensure end date includes the full day if searching by date only
                const endDate = new Date(params.endDate);
                if (params.endDate.length === 10) { // YYYY-MM-DD
                    endDate.setHours(23, 59, 59, 999);
                }
                where.createdAt.lte = endDate;
            }
        }

        // Amount Range Filter
        const amountFilter: any = {};
        let hasAmountFilter = false;

        // Paranoid normalization to Number
        const normalizedMin = params.minAmount !== undefined ? Number(params.minAmount) : undefined;
        const normalizedMax = params.maxAmount !== undefined ? Number(params.maxAmount) : undefined;

        if (normalizedMin !== undefined || normalizedMax !== undefined) {
            hasAmountFilter = true;
            if (normalizedMin !== undefined && !isNaN(normalizedMin)) {
                amountFilter.gte = normalizedMin;
            }
            if (normalizedMax !== undefined && !isNaN(normalizedMax)) {
                amountFilter.lte = normalizedMax;
            }
            where.amount = amountFilter;
        }

        // Filters
        if (params.paymentMethod && params.paymentMethod !== 'ALL') {
            where.paymentMethod = params.paymentMethod;
        }

        if (params.status && params.status !== 'ALL') {
            if (params.status === 'COMPLETED') {
                // For COMPLETED, we only want rows from fully completed sales OR standalone completed payments
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { sale: { paymentStatus: 'COMPLETED' } },
                            { AND: [{ saleId: null }, { paymentStatus: 'COMPLETED' }] }
                        ]
                    }
                ];
            } else {
                // Include records where the payment status matches OR the sale status matches
                // This is crucial for PARTIAL and PENDING filters
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { paymentStatus: params.status },
                            { sale: { paymentStatus: params.status } }
                        ]
                    }
                ];
            }
        }

        if (params.paymentType) {
            where.paymentType = params.paymentType;
        }

        if (params.customerSearch) {
            where.OR = [
                { transactionId: { contains: params.customerSearch } },
                { invoiceNumber: { contains: params.customerSearch } },
                { sale: { saleNumber: { contains: params.customerSearch } } }
            ];
            // If customerSearch is provided, we'll search across all customers later
        }

        const pendingSaleWhere: any = {
            adminId: params.adminId,
            authId: params.authId,
            paymentStatus: PaymentStatus.PENDING,
            saleStatus: { not: SaleStatus.CANCELLED },
            createdAt: where.createdAt,
            // [ROBUST FIX] Explicitly apply amount filter
            paidAmount: hasAmountFilter ? amountFilter : undefined,
            OR: params.customerSearch ? [
                { saleNumber: { contains: params.customerSearch } },
                { customerId: { in: customerIds } }
            ] : undefined,
            AND: (params.specialist && params.specialist !== 'ALL') ? [
                {
                    OR: [
                        { appointment: { stylist: { name: params.specialist } } },
                        { specialist: { name: params.specialist } }
                    ]
                }
            ] : undefined
        };

        // Fetch counts for both (Initial count before manual filtering)
        const [paymentCount, saleCount] = await Promise.all([
            prisma.payment.count({ where }),
            (params.status === 'ALL' || params.status === 'PENDING' || !params.status) ? prisma.sale.count({
                where: pendingSaleWhere
            }) : Promise.resolve(0)
        ]);

        // Fetch records
        const [paymentsRes, pendingSales] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    appointment: {
                        include: {
                            customer: true,
                            service: true,
                            stylist: true
                        }
                    },
                    sale: {
                        include: {
                            appointment: {
                                include: {
                                    service: true,
                                    stylist: true
                                }
                            },
                            specialist: true,
                            payments: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: skip + limit + 50 // Fetch extra to allow for manual filtering while maintaining page size
            }),
            (params.status === 'ALL' || params.status === 'PENDING' || !params.status) ? prisma.sale.findMany({
                where: pendingSaleWhere,
                include: {
                    appointment: {
                        include: {
                            customer: true,
                            service: true,
                            stylist: true
                        }
                    },
                    specialist: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: skip + limit + 50
            }) : Promise.resolve([])
        ]);

        const synthesizedPayments = (pendingSales as any[]).map(sale => ({
            id: `pending-${sale.id}`,
            amount: sale.totalAmount || 0, // Show the total value of the pending sale/quotation
            paymentMethod: 'PENDING',
            paymentStatus: 'PENDING',
            paymentType: 'FULL',
            transactionId: sale.saleNumber,
            createdAt: sale.createdAt,
            saleId: sale.id,
            sale: {
                ...sale,
                customer: sale.appointment?.customer
            },
            appointmentId: sale.appointmentId,
            appointment: sale.appointment,
            cashierName: sale.createdBy,
            invoiceNumber: sale.saleNumber,
            notes: sale.notes,
            isPendingSale: true
        }));

        // Merge and Sort
        let allLoaded = [...paymentsRes, ...synthesizedPayments];

        // [FAIL-SAFE] Explicitly filter by amount again in memory with strict parsing
        if (hasAmountFilter) {
            const min = normalizedMin;
            const max = normalizedMax;

            allLoaded = allLoaded.filter(p => {
                // Paranoid parsing of row amount
                const amt = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount as any);
                if (isNaN(amt)) return true; // Keep only if we can't determine (safety)

                if (min !== undefined && !isNaN(min) && amt < min) return false;
                if (max !== undefined && !isNaN(max) && amt > max) return false;
                return true;
            });
        }

        allLoaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Recalculate totalCount based on the actual filtered set (best effort for now)
        // In a real production system with huge datasets, we'd need a more efficient way to count across joined tables
        const totalCount = (hasAmountFilter || params.customerSearch) ? allLoaded.length : (paymentCount + saleCount);

        const payments = allLoaded.slice(skip, skip + limit);

        // [FIX] Manually populate customer for Sales (since relation is missing in schema)
        const saleCustomerIds = payments
            .map(p => p.sale?.customerId)
            .filter((id): id is string => !!id);

        const customerDebugInfo: any = { saleCustomerIds };

        if (saleCustomerIds.length > 0) {
            const customers = await prisma.customer.findMany({
                where: { id: { in: saleCustomerIds } }
            });
            const customerMap = new Map(customers.map(c => [c.id, c]));

            customerDebugInfo.foundCustomers = customers.map(c => ({ id: c.id, name: c.name, phone: c.phone }));

            // [FIX] Resolve Cashier Names (User IDs)
            const userIds = [...new Set(payments.map(p => p.sale?.createdBy).filter(id => !!id))];
            let userMap = new Map<string, string>();

            if (userIds.length > 0) {
                const users = await prisma.user.findMany({
                    where: {
                        OR: [
                            { id: { in: userIds } },
                            { authId: { in: userIds } }
                        ]
                    },
                    select: { id: true, authId: true, businessName: true }
                });

                // Get stylist names for these users
                const authIds = users.map(u => u.authId);
                const stylists = await prisma.stylist.findMany({
                    where: { authId: { in: authIds } },
                    select: { authId: true, name: true }
                });

                const stylistMap = new Map(stylists.map(s => [s.authId, s.name]));

                users.forEach(u => {
                    let name = u.businessName;
                    if (!name && u.authId) {
                        name = stylistMap.get(u.authId);
                    }
                    const finalName = name || 'Admin';
                    userMap.set(u.id, finalName);
                    if (u.authId) userMap.set(u.authId, finalName);
                });
            }

            payments.forEach(p => {
                if (p.sale && p.sale.customerId) {
                    const customer = customerMap.get(p.sale.customerId);
                    if (customer) {
                        (p.sale as any).customer = customer;
                    }
                    // Normalize sale attachments
                    if (p.sale.attachments) {
                        p.sale.attachments = normalizeAttachments(p.sale.attachments);
                    }
                }

                // Resolve Cashier Name
                if (p.sale && p.sale.createdBy) {
                    const name = userMap.get(p.sale.createdBy);
                    // Only override if original cashierName is null/sys-gen or matches the raw UUID (synthesized)
                    if (name && (!p.cashierName || p.cashierName === p.sale.createdBy)) {
                        p.cashierName = name;
                    }
                }

                if (p.appointment && (p.appointment as any).attachments) {
                    (p.appointment as any).attachments = normalizeAttachments((p.appointment as any).attachments);
                }
            });
        }

        // Calculate Stats
        const allPayments = await prisma.payment.findMany({ where });
        const totalRevenue = allPayments.reduce((sum, p) =>
            p.paymentStatus === 'COMPLETED' ? sum + p.amount : sum, 0
        );

        const totalCash = allPayments.reduce((sum, p) =>
            p.paymentStatus === 'COMPLETED' && p.paymentMethod === 'CASH' ? sum + p.amount : sum, 0
        );

        const totalDigital = allPayments.reduce((sum, p) =>
            p.paymentStatus === 'COMPLETED' && p.paymentMethod !== 'CASH' ? sum + p.amount : sum, 0
        );

        // Calculate Balance Stats (from Sales matching the same basic filters)
        const saleWhere: any = {};
        if (params.authId) saleWhere.authId = params.authId;
        if (params.adminId) saleWhere.adminId = params.adminId;

        // Apply date filters to Sales (Optional: usually balance is a global figure)
        // if (params.startDate || params.endDate) {
        //     saleWhere.createdAt = {};
        //     if (params.startDate) saleWhere.createdAt.gte = new Date(params.startDate);
        //     if (params.endDate) {
        //         const endDate = new Date(params.endDate);
        //         if (params.endDate.length === 10) endDate.setHours(23, 59, 59, 999);
        //         saleWhere.createdAt.lte = endDate;
        //     }
        // }

        // Apply customer search to Sales if applicable
        if (params.customerSearch) {
            const matchingCustomers = await prisma.customer.findMany({
                where: {
                    OR: [
                        { name: { contains: params.customerSearch } },
                        { phone: { contains: params.customerSearch } }
                    ]
                },
                select: { id: true }
            });
            const customerIds = matchingCustomers.map(c => c.id);
            if (customerIds.length > 0) {
                saleWhere.customerId = { in: customerIds };
            } else {
                saleWhere.id = 'none'; // Force empty result
            }
        }

        const balanceStats = await prisma.sale.aggregate({
            where: {
                ...saleWhere,
                balanceAmount: { gt: 0 },
                saleStatus: { not: 'CANCELLED' }
            },
            _sum: { balanceAmount: true },
            _count: { id: true }
        });

        const stats = {
            totalRevenue,
            totalCash,
            totalDigital,
            totalTransactions: totalCount,
            averageTransaction: totalCount > 0 ? totalRevenue / totalCount : 0,
            totalBalanceAmount: balanceStats._sum.balanceAmount || 0,
            totalBalanceCount: balanceStats._count.id || 0
        };

        return {
            payments,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            },
            stats,
            customerDebugInfo: { ...customerDebugInfo, saleWhere, balanceStats }
        };
    }

    /**
     * Get payment by ID
     */
    async getPaymentById(id: string) {
        return await prisma.payment.findUnique({
            where: { id },
            include: {
                appointment: {
                    include: {
                        customer: true,
                        service: true
                    }
                },
                sale: {
                    include: {
                        appointment: {
                            include: {
                                service: true
                            }
                        },
                        payments: true // Include sibling payments
                    }
                }
            },
        });
    }

    async createPaymentLink(amount: number, notes: any, adminId: string) {
        let keyId, keySecret;
        try {
            console.log(`🔍 [createPaymentLink] Fetching settings for adminId: ${adminId}`);
            const { settingsService } = await import('./settings.service');
            const creds = await settingsService.getRazorpayCredentials(adminId);

            keyId = creds.keyId;
            keySecret = creds.keySecret;

            console.log(`🔑 [createPaymentLink] Final Keys - KeyId: ${keyId ? 'Yes' : 'No'}, KeySecret: ${keySecret ? 'Yes' : 'No'}`);
        } catch (error) {
            console.error('Failed to fetch settings for payment link:', error);
            keyId = process.env.RAZORPAY_KEY_ID;
            keySecret = process.env.RAZORPAY_KEY_SECRET;
        }

        return await razorpayService.createPaymentLink({ amount, notes }, keyId, keySecret);
    }

    async getPaymentLinkStatus(linkId: string, adminId: string) {
        let keyId, keySecret;
        try {
            const { settingsService } = await import('./settings.service');
            const creds = await settingsService.getRazorpayCredentials(adminId);
            keyId = creds.keyId;
            keySecret = creds.keySecret;
        } catch (error) {
            keyId = process.env.RAZORPAY_KEY_ID;
            keySecret = process.env.RAZORPAY_KEY_SECRET;
        }

        return await razorpayService.fetchPaymentLink(linkId, keyId, keySecret);
    }

    async completePaymentLink(linkId: string, saleId: string, adminId: string) {
        // 1. Fetch Link Status
        const linkRes = await this.getPaymentLinkStatus(linkId, adminId);
        if (!linkRes.success || !linkRes.paymentLink) throw new Error('Failed to fetch payment link');

        const link = linkRes.paymentLink;
        if (link.status !== 'paid') throw new Error('Payment link is not paid');
        // const paymentInfo = link.payments && link.payments.length > 0 ? link.payments[0] : null;
        // 2. Extract Payment info
        const paymentsArray = Array.isArray(link.payments) ? link.payments : (link.payments ? [link.payments] : []);
        const paymentInfo = paymentsArray.length > 0 ? paymentsArray[0] : null;

        const amount = Number(link.amount) / 100; // paise to units
        const razorpayPaymentId = paymentInfo?.payment_id || `pl_pay_${link.id}`;

        // 3. Record Payment in DB
        const existing = await prisma.payment.findFirst({ where: { transactionId: razorpayPaymentId } });
        if (existing) return existing;

        const payment = await prisma.payment.create({
            data: {
                paymentMethod: 'RAZORPAY' as any,
                amount,
                paymentStatus: 'COMPLETED',
                transactionId: razorpayPaymentId,
                saleId: saleId,
                notes: JSON.stringify({ linkId: link.id, method: paymentInfo?.method })
            }
        });

        // 4. Update Sale
        await prisma.sale.update({
            where: { id: saleId },
            data: {
                paymentStatus: 'COMPLETED',
                paidAmount: { increment: amount }
            }
        });

        return payment;
    }

    /**
     * Calculate payment status based on amounts
     */
    calculatePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
        if (totalAmount === 0 && paidAmount === 0) {
            return PaymentStatus.COMPLETED;
        } else if (paidAmount === 0) {
            return PaymentStatus.PENDING;
        } else if (paidAmount >= totalAmount - 0.01) { // Add epsilon for float safety
            return PaymentStatus.COMPLETED;
        } else {
            return PaymentStatus.PARTIAL;
        }
    }
    /**
     * Get all payments with optional filtering
     */
    async getAllPayments(filters: {
        startDate?: string;
        endDate?: string;
        paymentMethod?: string | 'ALL';
        status?: PaymentStatus | 'ALL';
        paymentType?: PaymentType | 'ALL';
        authId?: string; // Limit to specific business/admin
        adminId?: string;
        page?: number;
        limit?: number;
    }) {
        const { startDate, endDate, paymentMethod, status, paymentType, authId, adminId, page = 1, limit = 10 } = filters;
        const skip = (page - 1) * limit;
        const take = limit;

        const where: any = {};

        // Date Filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        // Method Filter
        if (paymentMethod && paymentMethod !== 'ALL') {
            where.paymentMethod = paymentMethod;
        }

        // Status Filter
        if (status && status !== 'ALL') {
            where.paymentStatus = status;
        }

        // Type Filter
        if (paymentType && paymentType !== 'ALL') {
            where.paymentType = paymentType;
        }

        // Auth/Business Filter
        if (authId) {
            where.authId = authId;
        }

        if (adminId) {
            where.adminId = adminId;
        }

        const [payments, totalCount] = await Promise.all([
            prisma.payment.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: {
                    appointment: {
                        include: {
                            customer: true, // Get customer via appointment
                            service: true
                        }
                    },
                    sale: {
                        include: {

                        }
                    },
                }
            }),
            prisma.payment.count({ where })
        ]);

        if (payments.length > 0) {
            console.log('DEBUG: First Payment Result:', JSON.stringify(payments[0], null, 2));
        }
        // Calculate Stats for ALL matching records (not just this page)
        const allMatchingPayments = await prisma.payment.findMany({
            where,
            select: {
                amount: true,
                paymentMethod: true,
                paymentStatus: true
            }
        });

        const stats = allMatchingPayments.reduce((acc, p) => {
            if (p.paymentStatus === 'COMPLETED' || p.paymentStatus === 'PARTIAL') {
                acc.totalRevenue += p.amount;
                if (p.paymentMethod === 'CASH') acc.totalCash += p.amount;
                else acc.totalDigital += p.amount;
            } else if (p.paymentStatus === 'REFUNDED') {
                acc.totalRevenue -= p.amount;
                if (p.paymentMethod === 'CASH') acc.totalCash -= p.amount;
                else acc.totalDigital -= p.amount;
            }
            return acc;
        }, { totalRevenue: 0, totalCash: 0, totalDigital: 0 });

        return {
            payments,
            stats,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            }
        };
    }


    /**
     * Get unique specialists from payments and sales
     */
    async getUniqueSpecialists(adminId?: string) {
        const where: any = {};
        if (adminId) where.adminId = adminId;

        // Fetch distinct specialists from payments (via appointment or sale)
        const payments = await prisma.payment.findMany({
            where: {
                ...where,
                OR: [
                    { appointment: { stylistId: { not: null } } },
                    { sale: { specialistId: { not: null } } }
                ]
            },
            select: {
                appointment: {
                    select: { stylist: { select: { name: true } } }
                },
                sale: {
                    select: { specialist: { select: { name: true } } }
                }
            }
        });

        // Fetch distinct specialists from pending sales
        const sales = await prisma.sale.findMany({
            where: {
                ...where,
                OR: [
                    { specialistId: { not: null } },
                    { appointment: { stylistId: { not: null } } }
                ]
            },
            select: {
                specialist: { select: { name: true } },
                appointment: { select: { stylist: { select: { name: true } } } }
            }
        });

        const specialistNames = new Set<string>();

        payments.forEach(p => {
            if (p.appointment?.stylist?.name) specialistNames.add(p.appointment.stylist.name);
            if (p.sale?.specialist?.name) specialistNames.add(p.sale.specialist.name);
        });

        sales.forEach(s => {
            if (s.specialist?.name) specialistNames.add(s.specialist.name);
            if (s.appointment?.stylist?.name) specialistNames.add(s.appointment.stylist.name);
        });

        return Array.from(specialistNames).sort();
    }
}

export default new PaymentService();
