import prisma from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { resolveDefaultAdminId } from '../utils/user.utils';

export class SettingsService {
    // Get settings for an admin (create if doesn't exist)
    async getOrCreateSettings(adminId: string) {
        // Validate that adminId exists in User table to avoid FK violation
        const user = await prisma.user.findUnique({ where: { id: adminId } });
        if (!user) {
            console.warn(`⚠️ Attempted to get settings for non-existent user ID: ${adminId}. Resolving default admin.`);
            adminId = await resolveDefaultAdminId();
        }

        let settings = await prisma.settings.findUnique({
            where: { adminId },
        });

        if (!settings) {
            // Create default settings if they don't exist
            settings = await prisma.settings.create({
                data: {
                    adminId,
                    razorpayKeyId: null,
                    razorpayKeySecret: null,
                },
            });
        }

        return settings;
    }

    // Get the first available settings record (for public endpoints in single-tenant setup)
    async getFirstSettings() {
        const settings = await prisma.settings.findFirst();
        if (!settings) {
            // Create default settings if none exist
            return await prisma.settings.create({
                data: {
                    adminId: await resolveDefaultAdminId(),
                    razorpayKeyId: null,
                    razorpayKeySecret: null,
                },
            });
        }
        return settings;
    }

    // Get settings by business name (for multi-tenant public endpoints)
    async getSettingsByBusinessName(businessName: string) {
        console.log(`🔍 Looking up settings for business: ${businessName}`);

        // Find the admin user by businessName
        const admin = await prisma.user.findFirst({
            where: {
                businessName: businessName,
                role: { in: ['ADMIN', 'SUPER_ADMIN'] }
            }
        });

        if (!admin) {
            console.warn(`⚠️ Business not found: ${businessName}. Falling back to first settings.`);
            return this.getFirstSettings();
        }

        console.log(`✅ Found admin for business ${businessName}: ${admin.id}`);

        // Get settings for this admin
        return this.getOrCreateSettings(admin.id);
    }

    // Update settings for an admin
    async updateSettings(adminId: string, data: {
        authId?: string; // Track who modified settings
        razorpayKeyId?: string;
        razorpayKeySecret?: string;
        currency?: string;
        // Salon Information
        salonName?: string;
        salonPhone?: string;
        salonAddress?: string;
        // Booking Configuration
        openingTime?: string;
        closingTime?: string;
        maxAdvanceBookingDays?: number;
        cancellationPolicyHours?: number;
        whatsappNotifications?: boolean;
        // Payment Modes
        activePaymentMethods?: any; // JSON array of payment methods
        // New Fields
        salesIdPrefix?: string;
        invoiceStartNumber?: string;
        inventoryAdjustmentConfig?: string;
        enableInventoryAdjustment?: boolean;
        allowPartialPayment?: boolean;
        partialPaymentPercentage?: number;
        allowNoPayment?: boolean;
        allowFullPayment?: boolean;
        allowRazorpay?: boolean;
        fraudProtection?: boolean;
        apiIntegrations?: any; // JSON array
        enableVoucherOtp?: boolean;
    }) {
        // Check if settings exist
        const existing = await prisma.settings.findUnique({
            where: { adminId },
        });

        // Build update data - only include fields that are provided
        const updateData: any = {};
        if (data.authId !== undefined) {
            updateData.authId = data.authId;
        }
        if (data.razorpayKeyId !== undefined) {
            updateData.razorpayKeyId = data.razorpayKeyId;
        }
        if (data.razorpayKeySecret !== undefined) {
            updateData.razorpayKeySecret = data.razorpayKeySecret;
        }
        if (data.currency !== undefined) {
            // Validation: Only allow INR and SGD
            if (data.currency === 'INR' || data.currency === 'SGD') {
                updateData.currency = data.currency;
            } else {
                console.warn(`⚠️ Invalid currency provided: ${data.currency}. Defaulting to existing or INR.`);
                // If existing settings exist and have a currency, keep it; otherwise default to INR
                if (!existing?.currency) {
                    updateData.currency = 'INR';
                }
            }
        }
        // Salon Information
        if (data.salonName !== undefined) {
            updateData.salonName = data.salonName;
        }
        if (data.salonPhone !== undefined) {
            updateData.salonPhone = data.salonPhone;
        }
        if (data.salonAddress !== undefined) {
            updateData.salonAddress = data.salonAddress;
        }
        // Booking Configuration
        if (data.openingTime !== undefined) {
            updateData.openingTime = data.openingTime;
        }
        if (data.closingTime !== undefined) {
            updateData.closingTime = data.closingTime;
        }
        if (data.maxAdvanceBookingDays !== undefined) {
            updateData.maxAdvanceBookingDays = data.maxAdvanceBookingDays;
        }
        if (data.cancellationPolicyHours !== undefined) {
            updateData.cancellationPolicyHours = data.cancellationPolicyHours;
        }
        if (data.whatsappNotifications !== undefined) {
            updateData.whatsappNotifications = data.whatsappNotifications;
        }
        // Payment Modes
        if (data.activePaymentMethods !== undefined) {
            updateData.activePaymentMethods = data.activePaymentMethods;
        }
        // New Fields
        if (data.salesIdPrefix !== undefined) {
            updateData.salesIdPrefix = data.salesIdPrefix;
        }
        if (data.invoiceStartNumber !== undefined) {
            updateData.invoiceStartNumber = data.invoiceStartNumber;
        }
        if (data.inventoryAdjustmentConfig !== undefined) {
            updateData.inventoryAdjustmentConfig = data.inventoryAdjustmentConfig;
        }
        if (data.enableInventoryAdjustment !== undefined) {
            updateData.enableInventoryAdjustment = data.enableInventoryAdjustment;
        }
        if (data.allowPartialPayment !== undefined) {
            updateData.allowPartialPayment = data.allowPartialPayment;
        }
        if (data.partialPaymentPercentage !== undefined) {
            updateData.partialPaymentPercentage = data.partialPaymentPercentage;
        }
        if (data.allowNoPayment !== undefined) {
            updateData.allowNoPayment = data.allowNoPayment;
        }
        if (data.allowFullPayment !== undefined) {
            updateData.allowFullPayment = data.allowFullPayment;
        }
        if (data.allowRazorpay !== undefined) {
            updateData.allowRazorpay = data.allowRazorpay;
        }
        if (data.fraudProtection !== undefined) {
            updateData.fraudProtection = data.fraudProtection;
        }
        if (data.enableVoucherOtp !== undefined) {
            updateData.enableVoucherOtp = data.enableVoucherOtp;
        }
        // API/AI Configuration
        if (data.apiIntegrations !== undefined) {
            updateData.apiIntegrations = data.apiIntegrations;
        }

        if (existing) {
            // Update existing settings
            return await prisma.settings.update({
                where: { adminId },
                data: updateData,
            });
        } else {
            // Create new settings
            return await prisma.settings.create({
                data: {
                    adminId,
                    authId: data.authId,
                    razorpayKeyId: data.razorpayKeyId || null,
                    razorpayKeySecret: data.razorpayKeySecret || null,
                },
            });
        }
    }

    // Get Razorpay credentials for an admin (with fallback to env)
    async getRazorpayCredentials(adminId: string): Promise<{ keyId: string; keySecret: string }> {
        const settings = await this.getOrCreateSettings(adminId);

        // Find credentials in activePaymentMethods
        let jsonKeyId = '';
        let jsonKeySecret = '';

        let methods = settings.activePaymentMethods;
        if (typeof methods === 'string') {
            try {
                methods = JSON.parse(methods);
            } catch (e) {
                methods = null;
            }
        }

        if (methods && Array.isArray(methods)) {
            const razorpayMethod = (methods as any[]).find((m: any) =>
                m.name?.toLowerCase() === 'razorpay' || m.name?.toLowerCase() === 'razor'
            );
            if (razorpayMethod) {
                jsonKeyId = razorpayMethod.url || '';
                jsonKeySecret = razorpayMethod.secretKey || '';
            }
        }

        // Use JSON credentials first, then legacy settings, then env
        // Note: paymentRazorpayKeyId column is being removed.
        const keyId = jsonKeyId || settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '';
        const keySecret = jsonKeySecret || settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '';

        if (!keyId || !keySecret) {
            throw new AppError(400, 'Razorpay credentials not configured. Please configure in Settings.');
        }

        return { keyId, keySecret };
    }

    // Update payment methods array
    async updatePaymentMethods(adminId: string, paymentMethods: any[]) {
        return await prisma.settings.upsert({
            where: { adminId },
            update: {
                activePaymentMethods: paymentMethods,
            },
            create: {
                adminId,
                activePaymentMethods: paymentMethods,
            },
        });
    }
}

export const settingsService = new SettingsService();
